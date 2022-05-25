from contextlib import AbstractContextManager
import logging
from os import mkdir, path, remove, rmdir, scandir
import tempfile
from typing import Any, Dict
import uuid
from zipfile import ZipFile

import boto3
from shennong.audio import Audio
from shennong.processor.spectrogram import SpectrogramProcessor
from shennong.processor.filterbank import FilterbankProcessor
from shennong.processor.mfcc import MfccProcessor
from shennong.processor.plp import PlpProcessor
from shennong.processor.pitch_kaldi import KaldiPitchProcessor, KaldiPitchPostProcessor
from shennong.processor.pitch_crepe import CrepePitchProcessor, CrepePitchPostProcessor
from shennong.processor.energy import EnergyProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.vad import VadPostProcessor
from shennong import FeaturesCollection

from app.settings import settings as app_settings

logger = logging.getLogger(__name__)


def resolve_processor(processor_name: str, settings: Dict[str, Any]):
    if processor_name == "spectrogram":
        return SpectrogramProcessor(**settings)
    if processor_name == "filterbank":
        return FilterbankProcessor(**settings)
    if processor_name == "mfcc":
        return MfccProcessor(**settings)
    if processor_name == "plp":
        return PlpProcessor(**settings)
    if processor_name == "p_kaldi":
        return KaldiPitchProcessor(**settings)
    if processor_name == "p_crepe":
        return CrepePitchProcessor(**settings)
    if processor_name == "energy":
        return EnergyProcessor(**settings)


class CmvnWrapper:
    """A wrapper for this postprocessor, so that it implements our simplified API"""

    def __init__(self, ndims: int):
        self.processor = CmvnPostProcessor(ndims)

    def process(self, features):
        self.processor.accumulate(features)
        return self.processor.process(features)


def resolve_postprocessor(processor_name: str, features=None):
    postprocessor = None
    if processor_name == "delta":
        postprocessor = DeltaPostProcessor()
    if processor_name == "cmvn":
        postprocessor = CmvnWrapper(features.ndims)
    if processor_name == "vad":
        postprocessor = VadPostProcessor()
    if processor_name == "kaldi":
        postprocessor = KaldiPitchPostProcessor()
    if processor_name == "crepe":
        postprocessor = CrepePitchPostProcessor()

    if not postprocessor:
        raise ValueError(f"{processor_name} is not defined!")

    return postprocessor


class Analyser:
    """Resolve processors and postprocessors from config and run analyses"""

    def __init__(
        self,
        filepath: str,
        channel: int,
        collection: FeaturesCollection,
    ):
        self.collection = collection
        self.filepath = filepath

        if not self.filepath:
            raise ValueError("File path not set!")
        sound = Audio.load(self.filepath)
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

    def process(self, processor_type: str, settings: Dict[str, Any]):
        postprocessors = settings["postprocessors"] or []
        if settings["init_args"].get("sample_rate"):
            settings["init_args"]["sample_rate"] = self.sound.sample_rate
        if processor_type == "p_kaldi":
            postprocessors.append("kaldi")
        if processor_type == "p_crepe":
            settings = settings.copy()
            postprocessors.append("crepe")
        processor = resolve_processor(processor_type, settings["init_args"])
        self.collection[processor_type] = processor.process(self.sound)
        if postprocessors:
            for pp in postprocessors:
                key = f"{processor_type}_{pp}"
                logger.info(f"starting {key} postprocessor")
                self.collection[key] = self.postprocess(pp, processor_type)
                logger.info(f"finished {key} postprocessor")


class LocalFileManager(AbstractContextManager):
    """Local filesystem provider.
    Handles temporary file storage and, if we're not using s3, result storage.
    """

    def __init__(self):
        """Where to save results when storing analyses on the container's filesystem (typically dev env)"""
        self.results_dir = "/srv/results"
        """ Storage location of intermediate files """
        self.tmp_dir = tempfile.gettempdir()
        """ We keep track of these dirs so we can remove them once the analysis has finished """
        self.result_dirs = []
        self.input_paths = []

    def __exit__(self, exc_type, exc_value, traceback):
        self.remove_temps()

    def load(self, filepath: str):
        """Check existence, then queue for removal"""
        if not path.exists(filepath):
            raise ValueError("File does not exist")
        self.input_paths.append(filepath)
        return filepath

    def make_tmp_dir(self):
        """Create a temporary directory on the local filesystem"""
        dirpath = path.join(self.tmp_dir, uuid.uuid4().hex)
        mkdir(dirpath)
        return dirpath

    def register_result_dir(self):
        """return a valid path for a temporary directory and store for later cleanup"""
        dirpath = path.join(self.tmp_dir, uuid.uuid4().hex)
        self.result_dirs.append(dirpath)
        return dirpath

    def register_result_path(self, filepath: str, extension: str):
        """Create a directory and return the name of a valid filepath for an intermediate file"""
        dir_name = self.register_result_dir()
        mkdir(dir_name)
        result_path = path.join(
            dir_name, f"{path.splitext(path.basename(filepath))[0]}-features{extension}"
        )
        return result_path

    def remove_temps(self):
        """Remove directory and contents from registered temp files"""
        for filepath in [*self.result_dirs, *self.input_paths]:
            dirpath = path.dirname(filepath) if path.isfile(filepath) else filepath
            with scandir(dirpath) as it:
                for entry in it:
                    try:
                        """can run into errors if path doesn't contain file yet"""
                        remove(path.join(dirpath, entry.name))
                    except Exception as e:
                        logger.error(
                            f"Caught exception {e} while trying to remove result path"
                        )
            rmdir(dirpath)

        return True

    def store(self):
        """Store results in the static directory and return url"""
        result_dir = path.join(self.results_dir, uuid.uuid4().hex)
        mkdir(result_dir)
        zip_path = self.zip_tmp_files(result_dir)
        spl = zip_path.split("/")
        return f"{app_settings.STATIC_ASSET_URL}/{spl[3]}/{spl[4]}"

    def zip_tmp_files(self, save_dir: str):
        """Zip intermediate files"""
        zip_path = path.join(save_dir, f"{uuid.uuid4().hex}.zip")

        with ZipFile(
            zip_path,
            "x",
        ) as zipped:
            for dirpath in self.result_dirs:
                with scandir(dirpath) as it:
                    for entry in it:
                        # avoid infinite loop if zip is also stored in tmp dir
                        if path.join(dirpath, entry.name) != zip_path:
                            zipped.write(path.join(dirpath, entry.name), entry.name)
        return zip_path


class S3FileManager(LocalFileManager):
    """S3 client provider that employs and overrides local methods as necessary."""

    def __init__(self):
        super().__init__()
        self.resource = boto3.resource("s3")
        self.client = boto3.client("s3")
        self.bucket = app_settings.BUCKET_NAME
        """ store a list of keys that we can remove when we're done """
        self.removable_keys = []

    def load(self, key):
        """Download file from s3 and store both key and local temp path for cleanup"""
        basename = path.basename(key)
        save_path = path.join(self.make_tmp_dir(), basename)
        self.input_paths.append(save_path)
        self.resource.Bucket(self.bucket).download_file(key, save_path)
        self.removable_keys.append(key)
        return save_path

    def remove_temps(self):
        """Wipe out local temp files and remote upload files"""
        super().remove_temps()
        for removable_key in self.removable_keys:
            """For now we'll keep our test files so we can perform multiple tasks with them without needing
            to reupload every time.
            """
            if not removable_key.startswith("tests/"):
                self.client.delete_object(Bucket=self.bucket, Key=removable_key)

    def store(self):
        """Zip up results, upload to bucket, and queue local zip file for removal"""
        tmp_dir = self.make_tmp_dir()
        self.input_paths.append(tmp_dir)
        zip_path = self.zip_tmp_files(tmp_dir)
        key = path.basename(zip_path)
        self.resource.meta.client.upload_file(zip_path, self.bucket, key)
        # default expiration is an hour
        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=60 * 60 * 168,
        )
        return url


def process_data(
    file_paths: str, analysis_settings: Dict[str, Dict], res_type: str, channel: int
) -> str:
    """Process each file passed for analysis"""

    storage_manager = (
        S3FileManager() if app_settings.STORAGE_DRIVER == "s3" else LocalFileManager()
    )

    with storage_manager as manager:
        # shennong the devil outta them:
        for file_path in file_paths:
            collection = FeaturesCollection()
            local_path = manager.load(file_path)
            analyser = Analyser(local_path, channel, collection)
            logger.info(f"starting {file_path}")

            for k, v in analysis_settings.items():
                logger.info(f"starting {k}")
                analyser.process(k, v)
                logger.info(f"finished {k}")
            """ csv serializers save a csv and a json file,
                so they must be passed a directory path rather than a file path
                https://github.com/bootphon/shennong/blob/master/shennong/serializers.py#L35  
            """
            if res_type == ".csv":
                serializer = "csv"
                outpath = manager.register_result_dir()
            else:
                # if not a csv, let shennong resolve the serializer
                serializer = None
                outpath = manager.register_result_path(local_path, res_type)
            analyser.collection.save(outpath, serializer=serializer)
            logger.info(f"saved {file_path}")

        # storeManager has kept track of temp result paths
        url = manager.store()

    return url
