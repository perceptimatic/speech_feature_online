from dataclasses import dataclass, field
import inspect
from json import dumps
from sys import path as syspath
from typing import List, Type, Union

# make sure the app module is in the python path
syspath.insert(0, "../app.py")

from shennong.processor.base import FeaturesProcessor
from shennong.processor.bottleneck import BottleneckProcessor
from shennong.processor.energy import EnergyProcessor
from shennong.processor.filterbank import FilterbankProcessor
from shennong.processor.mfcc import MfccProcessor
from shennong.processor.pitch_crepe import CrepePitchProcessor, CrepePitchPostProcessor
from shennong.processor.pitch_kaldi import KaldiPitchProcessor, KaldiPitchPostProcessor
from shennong.processor.plp import PlpProcessor
from shennong.processor.spectrogram import SpectrogramProcessor

from shennong.postprocessor.base import FeaturesPostProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.vad import VadPostProcessor


processor_class_map = {
    "bottleneck": {
        "class_name": BottleneckProcessor,
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "energy": {
        "class_name": EnergyProcessor,
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "filterbank": {
        "class_name": FilterbankProcessor,
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "mfcc": {
        "class_name": MfccProcessor,
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "pitch_crepe": {
        "class_name": CrepePitchProcessor,
        # only arg is output of processor
        "valid_postprocessors": ["cmvn", "delta", "pitch_crepe", "vad"],
        "required_postprocessors": ["pitch_crepe"],
    },
    "pitch_kaldi": {
        "class_name": KaldiPitchProcessor,
        "valid_postprocessors": ["cmvn", "delta", "pitch_kaldi", "vad"],
        "required_postprocessors": ["pitch_kaldi"],
    },
    "plp": {
        "class_name": PlpProcessor,
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "spectrogram": {
        "valid_postprocessors": ["cmvn", "delta", "vad"],
        "class_name": SpectrogramProcessor,
    },
}

window_options = ["hamming", "hanning", "povey", "rectangular", "blackman"]

processor_options = {
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/bottleneck.py#L509
    "bottleneck": {"weights": ["BabelMulti", "FisherMono", "FisherMulti"]},
    "pitch_crepe": {"model_capacity": ["full", "large", "medium", "small", "tiny"]},
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/energy.py#L26
    "energy": {"window_type": window_options, "compression": ["log", "sqrt", "off"]},
    "filterbank": {"window_type": window_options,},
    "mfcc": {"window_type": window_options,},
    "plp": {"window_type": window_options,},
    "spectrogram": {"window_type": window_options,},
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/vtln.py#L156
    "vtln": {"norm_type": ["offset", "none", "diag"]},
}

postprocessor_class_map = {
    "cmvn": CmvnPostProcessor,
    "delta": DeltaPostProcessor,
    "pitch_crepe": CrepePitchPostProcessor,
    "pitch_kaldi": KaldiPitchPostProcessor,
    "vad": VadPostProcessor,
}


def stringify_type(t: Union[Type, None]):
    if t == None:
        return None
    elif t == str:
        return "string"
    elif t == bool:
        return "boolean"
    elif t == float:
        return "number"
    elif t == int:
        return "integer"
    raise ValueError(f"Unknown type {t}!")


class Arg:
    """class for extracting properties from inspect.Parameter objects"""

    def __init__(self, name: str = None):
        self.name = name

    def __repr__(self):
        return f"{{name: {self.name}, default: {self._default}, type: {self._type}}}"

    def toschema(self):
        attrs = {
            "name": self.name,
            "type": stringify_type(self.type),
            "default": self.default,
            "required": True,
        }

        if hasattr(self, "options"):
            attrs["options"] = self.options

        return attrs

    @property
    def default(self):
        return self._default

    @default.setter
    def default(self, value):
        self._default = value if not value == inspect._empty else None
        self._type = type(self._default) if self._default is not None else None

    @property
    def type(self):
        return self._type


@dataclass
class ProcessorSpec:
    processor_class: FeaturesProcessor
    init_args: List[Arg] = field(default_factory=list)
    process_args: List[Arg] = field(default_factory=list)
    required_postprocessors: List[str] = field(default_factory=list)
    valid_postprocessors: List[str] = field(default_factory=list)

    def toschema(self):
        return {
            "class_name": self.processor_class.__name__,
            "init_args": [a.toschema() for a in self.init_args],
            "process_args": [a.toschema() for a in self.process_args],
            "required_postprocessors": self.required_postprocessors,
            "valid_postprocessors": self.valid_postprocessors,
        }


@dataclass
class PostProcessorSpec:
    base_class: FeaturesPostProcessor
    init_args: List[Arg] = field(default_factory=list)
    process_args: List[Arg] = field(default_factory=list)


""" factory function for building a processor spec """


def build_processor_spec(
    class_key: str,
    Processor: FeaturesProcessor,
    _valid_postprocessors: List[str] = None,
    _required_postprocessors: List[str] = None,
):
    required_postprocessors = (
        _required_postprocessors if _required_postprocessors else []
    )

    valid_postprocessors = _valid_postprocessors if _valid_postprocessors else []

    processor = ProcessorSpec(
        processor_class=Processor,
        required_postprocessors=required_postprocessors,
        valid_postprocessors=valid_postprocessors,
    )

    # todo: may be simpler to use native introspection:
    # https://github.com/bootphon/shennong/blob/master/shennong/base.py#L86
    for p in inspect.signature(Processor).parameters.values():
        arg = Arg(p.name)
        arg.default = p.default
        if arg.type == str:
            try:
                arg.options = processor_options[class_key][arg.name]
            except KeyError:
                arg.options = []

        processor.init_args.append(arg)

    for k, v in inspect.signature(Processor.process).parameters.items():
        if k == "self":
            continue
        arg = Arg(v.name)
        arg.default = v.default
        processor.process_args.append(arg)

    return processor


spec_skel = {
    "title": "Shennong processor and postprocessor classes",
    "description": "This schema is intended as a blueprint for **generating** forms, validators, and instances. It should not be used to validate a document.",
    "processors": {},
    "postprocessors": {},
}


def build_schema():
    """Reading classes from class_map, dynamically build the schema using instrospection"""
    schema = spec_skel.copy()
    for k, v in processor_class_map.items():
        processor = build_processor_spec(
            k,
            v["class_name"],
            v["valid_postprocessors"],
            v.get("required_postprocessors"),
        )
        schema["processors"][k] = processor.toschema()

    for k, v in postprocessor_class_map.items():
        processor = build_processor_spec(k, v)
        schema["postprocessors"][k] = processor.toschema()

    return schema


if __name__ == "__main__":
    print(dumps(build_schema()))
