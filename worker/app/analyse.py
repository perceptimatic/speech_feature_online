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
from shennong.processor import KaldiPitchPostProcessor
from shennong.processor import CrepePitchProcessor
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
        return KaldiPitchPostProcessor(**settings)
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
    if processor_name == "delta":
        return DeltaPostProcessor()
    if processor_name == "cmvn":
        return CmvnWrapper(features.ndims)
    if processor_name == "vad":
        return VadPostProcessor()


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
        postprocessors = settings.pop("postprocessors")
        settings["sample_rate"] = self.sound.sample_rate
        processor = resolve_processor(processor_type, settings)
        self.collection[processor_type] = processor.process(self.sound)
        if postprocessors:
            for pp in postprocessors:
                key = f"{processor_type}_{pp}"
                self.collection[key] = self.postprocess(pp, processor_type)


class LocalFileManager:
    """Local filesystem provider.
    Handles temporary file storage and, if we're not using s3, result storage
    """

    def __init__(self):
        """Where to save results when storing analyses on the container's filesystem (typically dev env)"""
        self.results_dir = "/srv/results"
        """ Storage location of intermediate files """
        self.temp_dir = tempfile.gettempdir()
        """ We keep track of these dirs so we can remove them once the analysis has finished """
        self.result_dirs = []
        self.input_paths = []

    def load(self, filepath: str):
        """Check existence, then queue for removal"""
        if not path.exists(filepath):
            raise ValueError("File does not exist")
        self.input_paths.append(filepath)
        return filepath

    def make_tmp_dir(self):
        """Create a temporary directory on the local filesystem"""
        dirpath = path.join(self.temp_dir, uuid.uuid4().hex)
        mkdir(dirpath)
        return dirpath

    def register_result_dir(self):
        """return a valid path for a temporary directory and store for later cleanup"""
        dirpath = path.join(self.temp_dir, uuid.uuid4().hex)
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
        for pth in [*self.result_dirs, *self.input_paths]:
            dirpath = path.dirname(pth) if path.isfile(pth) else pth
            with scandir(dirpath) as it:
                for entry in it:
                    remove(path.join(dirpath, entry.name))
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

    def load(self, _key):
        """Download file from s3 and store both key and local temp path for cleanup"""
        key = path.basename(_key)
        save_path = path.join(self.make_tmp_dir(), key)
        self.input_paths.append(save_path)
        self.resource.Bucket(self.bucket).download_file(key, save_path)
        self.removable_keys.append(key)
        return save_path

    def remove_temps(self):
        """Wipe out local temp files and remote upload files"""
        super().remove_temps()
        for removable_key in self.removable_keys:
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
            "get_object", Params={"Bucket": self.bucket, "Key": key}
        )
        return url


class FileManager:
    """A facade that provides either the local or s3 filemanager depending on environment
    as well as a simplified interface exposing only methods needed by the worker
    """

    def __init__(self):
        self.Manager = (
            S3FileManager()
            if app_settings.STORAGE_DRIVER == "s3"
            else LocalFileManager()
        )

    def load(self, path: str) -> str:
        """download file from s3 if necessary and return the local path"""
        return self.Manager.load(path)

    def register_result_dir(self) -> str:
        """return a valid path for a local directory that shennong can use to store results
        and store path for later cleanup
        """
        return self.Manager.register_result_dir()

    def register_result_path(self, local_path: str, extension: str) -> str:
        """create a directory and return a valid filepath to store a file
        internally registers the tmp parent directory for removal
        """
        return self.Manager.register_result_path(local_path, extension)

    def remove_temps(self):
        """remove temporary files and directories"""
        return self.Manager.remove_temps()

    def store(self):
        """save the results to a local file and optionally push to s3"""
        return self.Manager.store()


def process_data(
    file_paths: str, settings: Dict[str, Dict], res_type: str, channel: int
) -> str:
    """Process each file passed for analysis"""

    storage_manager = FileManager()

    # todo: use context manager

    # shennong the devil outta them:
    for file_path in file_paths:
        collection = FeaturesCollection()
        local_path = storage_manager.load(file_path)
        analyser = Analyser(local_path, channel, collection)

        for k, v in settings.items():
            analyser.process(k, v)
        # note that csv serializers saves a directory with a csv and json file inside
        # https://github.com/bootphon/shennong/blob/master/shennong/serializers.py#L35
        if res_type == ".csv":
            serializer = "csv"
            outpath = storage_manager.register_result_dir()
        else:
            # let shennong resolve the serializer
            serializer = None
            outpath = storage_manager.register_result_path(local_path, res_type)
        analyser.collection.save(outpath, serializer=serializer)

    # storeManager has kept track of temp result paths
    url = storage_manager.store()
    # with url successfully created, remove the intermediate files
    storage_manager.remove_temps()

    return url
