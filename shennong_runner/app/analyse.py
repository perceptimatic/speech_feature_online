from contextlib import AbstractContextManager
from dataclasses import dataclass
from importlib import import_module
import json
import logging
from os import mkdir, path
from pathlib import Path
from shutil import make_archive
import tempfile
from typing import Any, Dict, List, Union
import uuid

import boto3
import numpy as np
import pandas as pd
from shennong import FeaturesCollection
from shennong.audio import Audio

# this is here to prevent a circular dependency
from shennong.processor.pitch_kaldi import KaldiPitchPostProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor

from app.settings import settings as app_settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(message)s")
ch.setFormatter(formatter)
logger.addHandler(ch)


with open(path.join(app_settings.PROJECT_ROOT, "processor-schema.json")) as f:
    shennong_schema = json.loads(f.read())


def resolve_processor(class_key: str, init_args: Dict[str, Any]):
    class_name = shennong_schema["processors"][class_key]["class_name"]
    cls = getattr(import_module(f"shennong.processor"), class_name)
    return cls(**init_args)


@dataclass
class JobArgs:
    bucket: str
    config_path: str


@dataclass
class JobConfig:
    analyses: Dict[str, Any]
    channel: int
    files: List[str]
    save_path: str
    res: str


class CmvnWrapper:
    """A wrapper for this postprocessor, so that it implements our simplified API"""

    def __init__(self, ndims: int):
        self.processor = CmvnPostProcessor(ndims)

    def process(self, features):
        self.processor.accumulate(features)
        return self.processor.process(features)


def resolve_postprocessor(class_key: str, features=None):
    if class_key == "cmvn":
        return CmvnWrapper(features.ndims)
    class_name = shennong_schema["postprocessors"][class_key]["class_name"]
    # we don't allow user to change init args but it is possible to override defaults ourselves in the schema
    init_args = {
        v["name"]: v["default"]
        for v in shennong_schema["postprocessors"][class_key]["init_args"]
    }
    try:
        module = import_module(f"shennong.postprocessor.{class_key}")
        return module.__dict__[class_name](**init_args)
    except ImportError:
        # For crepe and kaldi, postprocessors are located in respective processor module
        module = import_module(f"shennong.processor.{class_key}")
        return module.__dict__[class_name](**init_args)


def get_delta_cols(feature_cols: np.array):
    """
    Define delta postprocessor columns
    https://github.com/bootphon/shennong/blob/master/shennong/postprocessor/delta.py#L24-L36
    """
    # first n cols are original features, next n-cols are first-order derivatives, next n cols are second-order derivatives
    original_cols = list(feature_cols)
    first_order_cols = [f"{col}_d_1" for col in original_cols]
    second_order_cols = [f"{col}_d_2" for col in original_cols]
    return original_cols + first_order_cols + second_order_cols


def get_column_names(
    processor: str, main_cols: np.array = None
) -> Union[List[Any], None]:
    """
    If we have feature column names set for the processor, return them.

    Parameters
    ----------
    processor : str, required
        The string key of the processor, corresponds to processor-schema.json.
    main_cols : optional
        The column names produced by the main processor, needed only for postprocessors who result structure
        depends on on the structure of the main processor output
    """

    main_cols = main_cols if main_cols is not None else np.array([])

    return {
        "energy": ["energy"],
        # hard-coding these in for now, but note that raw_log_pitch is also possible, if enabled
        # since we're not allowing users to change postprocessor settings and instead using the defaults
        # and because the pitch processors are effectively postprocessors, we won't expect these values to change
        # but if users gain more control over postprocessor settings, we'll want a more flexible approach
        "pitch_crepe": [
            "pov_feature",
            "normalized_log_pitch",
            "delta_pitch",
            "raw_log_pitch",
        ],
        "pitch_kaldi": [
            "pov_feature",
            "normalized_log_pitch",
            "delta_pitch",
            "raw_log_pitch",
        ],
        "vad": ["voiced"],
        "delta": get_delta_cols(main_cols),
    }.get(processor)


def get_times_and_data_cols(feature_item):
    """Extract time columns and result columns from shennong collection"""
    # https://github.com/bootphon/shennong/blob/master/shennong/serializers.py#L230
    results = feature_item._to_dict(with_properties=False)
    return (results["times"], results["data"])


def get_feature_col_names(
    processor_name: str, data: np.array, main_cols: np.array = None
) -> List[str]:

    col_names = get_column_names(processor_name, main_cols)

    if col_names is not None:
        assert (
            len(col_names) == data.shape[1]
        ), f"Feature column names for {processor_name} are a different size than feature columns!"

    feature_col_names = (
        col_names if col_names is not None else [f"f_{i}" for i in range(data.shape[1])]
    )

    return feature_col_names


def save_result(
    processor_result, save_path: str, res_type: str, feature_col_names: list
):

    process_times, process_data = get_times_and_data_cols(processor_result)

    df = pd.DataFrame(np.hstack((process_times, process_data)))

    timecols = ["start", "end"]

    df.columns = [
        f"time_{timecols[i]}" for i in range(process_times.shape[1])
    ] + feature_col_names

    out_path = f"{save_path}{res_type}"

    mode = "wb" if res_type == ".pkl" else "w"

    with open(out_path, mode) as f:
        df.to_pickle(f) if res_type == ".pkl" else df.to_csv(f, index=False)


def save_results(
    primary_processor: str,
    collection: FeaturesCollection,
    base_save_path: str,
    res_type: str,
):
    """Iterate over results from processor and postprocessors and save files individually"""
    _, data = get_times_and_data_cols(collection[primary_processor])
    main_processor_column_names = get_feature_col_names(primary_processor, data)
    save_result(
        collection[primary_processor],
        f"{base_save_path}_{primary_processor}",
        res_type,
        main_processor_column_names,
    )

    for processor, v in collection.items():
        # postprocessors only
        if processor == primary_processor:
            continue
        _, data = get_times_and_data_cols(v)
        feature_col_names = get_feature_col_names(
            processor, data, main_processor_column_names
        )
        save_result(
            v,
            f"{base_save_path}_{primary_processor}_{processor}",
            res_type,
            feature_col_names,
        )

    return True


class Analyser:
    """Resolve processors and postprocessors from config and run analyses"""

    def __init__(
        self, filepath: str, channel: int, collection: FeaturesCollection,
    ):
        self.collection = collection
        sound = Audio.load(filepath)
        if (
            sound.nchannels > 1
        ):  # converting to mono; user-set or default channel chosen:
            sound = sound.channel(channel - 1)
        self.sound = sound

    def postprocess(self, postprocessor: str, processor_type: str):
        postprocessor = resolve_postprocessor(
            postprocessor, self.collection[processor_type]
        )
        return postprocessor.process(self.collection[processor_type])

    def process(self, key: str, settings: Dict[str, Any]):
        postprocessors = settings["postprocessors"] or []

        # make sure that, if present, the 'eponymous' postprocessor runs first,
        # as its result is the "base result" that should be passed on to downstream processors
        postprocessors.sort(key=lambda pp: -1 if pp == key else 0)

        if settings["init_args"].get("sample_rate"):
            settings["init_args"]["sample_rate"] = self.sound.sample_rate
        processor = resolve_processor(key, settings["init_args"])
        self.collection[key] = processor.process(self.sound)
        if postprocessors:
            for pp in postprocessors:
                # if processor and postprocessor have the same name (e.g., crepe & kaldi), we will overwrite
                # processor output with postprocessor output in collection
                logger.info(f"starting {pp} postprocessor")
                self.collection[pp] = self.postprocess(pp, key)
                logger.info(f"finished {pp} postprocessor")


class LocalFileManager(AbstractContextManager):
    """Local filesystem provider.
    Handles temporary file storage and, if we're not using s3, result storage.
    """

    def __init__(self, tmp_dir: str = None):
        """Where to save results when storing analyses on the container's filesystem (typically dev env).
        Normally tmp_dir can be ignored; it is used mostly for testing.
        """

        # Root dir for temp files
        self.tmp_dir = (
            tmp_dir if tmp_dir else path.join(tempfile.gettempdir(), uuid.uuid4().hex)
        )

        # Outer dir so user doesn't spill files everywhere when unzipping
        self.outer_results_dir = path.join(self.tmp_dir, uuid.uuid4().hex)
        # Where to store results before zipping
        self.results_dir = path.join(self.outer_results_dir, "sfo-results")
        # Where to store downloads before processing """
        self.tmp_download_dir = path.join(self.tmp_dir, uuid.uuid4().hex)
        mkdir(self.tmp_dir)
        mkdir(self.outer_results_dir)
        mkdir(self.results_dir)
        mkdir(self.tmp_download_dir)
        self.error_log_path = path.join(self.results_dir, "error-log.txt")

    def __exit__(self, exc_type, exc_value, traceback):
        pass

    def log_error(self, error: str):
        with open(self.error_log_path, "a+") as f:
            f.write(f"{error}\n")

    def zip_tmp_files(self):
        """Zip intermediate files"""
        return make_archive(
            path.join(self.tmp_dir, "sfo-results"), "zip", self.outer_results_dir,
        )


class S3FileManager(LocalFileManager):
    """S3 client provider that employs and overrides local methods as necessary."""

    def __init__(self, bucket_name: str):
        super().__init__()
        self.resource = boto3.resource("s3")
        self.client = boto3.client("s3")
        self.bucket = bucket_name

    def load(self, key):
        """Download file from s3 and store both key and local temp path for cleanup"""
        save_path = path.join(self.tmp_download_dir, path.basename(key))
        self.resource.Bucket(self.bucket).download_file(key, save_path)
        return save_path

    def store(self, save_path: str):
        """Zip up results, upload to bucket, and queue local zip file for removal"""
        zip_path = self.zip_tmp_files()
        self.resource.meta.client.upload_file(zip_path, self.bucket, save_path)
        return True


def process_data(job_args: JobArgs,):
    """Process each file passed for analysis"""

    storage_manager = S3FileManager(job_args.bucket)

    config_path = storage_manager.load(job_args.config_path)

    with open(config_path) as f:
        jobconfig = JobConfig(**json.load(f))

    file_paths = jobconfig.files
    res_type = jobconfig.res
    channel = jobconfig.channel
    analysis_settings = jobconfig.analyses

    with storage_manager as manager:
        # shennong the devil outta them:
        for file_path in file_paths:

            audio_file = manager.load(file_path)
            logger.info(f"starting {file_path}")

            for processor, settings in analysis_settings.items():
                logger.info(f"starting {processor}")
                analyser = Analyser(audio_file, channel, FeaturesCollection())
                try:
                    analyser.process(processor, settings)
                except Exception as e:
                    logger.error(e)
                    storage_manager.log_error(
                        f"Failed: {path.basename(file_path)}-{processor}"
                    )
                    continue

                save_results(
                    processor,
                    analyser.collection,
                    path.join(manager.results_dir, f"{Path(file_path).stem}"),
                    res_type,
                )

                logger.info(f"saved {file_path} {processor}")

        with open(path.join(manager.results_dir, "settings.json"), "w") as f:
            json.dump(jobconfig.analyses, f)

        manager.store(jobconfig.save_path)

    return True


if __name__ == "__main__":
    from sys import argv

    args = json.loads(argv[1])
    process_data(JobArgs(**args))
