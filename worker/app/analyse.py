from contextlib import AbstractContextManager
from importlib import import_module
from json import loads
import logging
from os import mkdir, path, remove, rmdir, scandir
import tempfile
from typing import Any, Dict
import uuid
from zipfile import ZipFile

import boto3

from shennong import FeaturesCollection
from shennong.audio import Audio
# this is here to prevent a circular dependency
from shennong.processor.pitch_kaldi import KaldiPitchPostProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor

from app.settings import settings as app_settings

logger = logging.getLogger(__name__)

with open(path.join(app_settings.PROJECT_ROOT, "processor-schema.json")) as f:
    config = loads(f.read())


def resolve_processor(class_key: str, init_args: Dict[str, Any]):
    class_name = config["processors"][class_key]["class_name"]
    module = import_module(f"shennong.processor.{class_key}")
    cls = module.__dict__[class_name]
    return cls(**init_args)


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
    class_name = config["postprocessors"][class_key]["class_name"]
    try:
        module = import_module(f"shennong.postprocessor.{class_key}")
        return module.__dict__[class_name]()
    except ImportError:
        module = import_module(f"shennong.processor.{class_key}")
        return module.__dict__[class_name]()


class Analyser:
    """Resolve processors and postprocessors from config and run analyses"""

    def __init__(
        self,
        filepath: str,
        channel: int,
        collection: FeaturesCollection,
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
        if settings["init_args"].get("sample_rate"):
            settings["init_args"]["sample_rate"] = self.sound.sample_rate
        processor = resolve_processor(key, settings["init_args"])
        self.collection[key] = processor.process(self.sound)
        if postprocessors:
            for pp in postprocessors:
                pp_key = f"{key}_{pp}"
                logger.info(f"starting {pp_key} postprocessor")
                self.collection[pp_key] = self.postprocess(pp, key)
                logger.info(f"finished {pp_key} postprocessor")


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
