from dataclasses import dataclass, field
import inspect
from json import dumps
from sys import path as syspath
from typing import List, Type, Union

# make sure the app module in in the python path
syspath.insert(0, ".")


from shennong.processor.base import FeaturesProcessor
from shennong.processor.bottleneck import BottleneckProcessor
from shennong.processor.energy import EnergyProcessor
from shennong.processor.filterbank import FilterbankProcessor
from shennong.processor.mfcc import MfccProcessor
from shennong.processor.pitch_crepe import CrepePitchProcessor, CrepePitchPostProcessor
from shennong.processor.pitch_kaldi import KaldiPitchProcessor, KaldiPitchPostProcessor
from shennong.processor.plp import PlpProcessor
from shennong.processor.spectrogram import SpectrogramProcessor
from shennong.processor.ubm import DiagUbmProcessor
from shennong.processor.vtln import VtlnProcessor

from shennong.postprocessor.base import FeaturesPostProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.vad import VadPostProcessor

processor_class_map = {
    "bottleneck": BottleneckProcessor,
    "crepe": CrepePitchProcessor,
    "energy": EnergyProcessor,
    "filterbank": FilterbankProcessor,
    "kaldi_pitch": KaldiPitchProcessor,
    "mfcc": MfccProcessor,
    "plp": PlpProcessor,
    "spectrogram": SpectrogramProcessor,
    "ubm": DiagUbmProcessor,
    "vtln": VtlnProcessor,
}

window_options = ["hamming", "hanning", "povey", "rectangular", "blackman"]

processor_options = {
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/bottleneck.py#L509
    "bottleneck": {"weights": ["BabelMulti", "FisherMono", "FisherMulti"]},
    "crepe": {"model_capacity": ["full", "large", "medium", "small", "tiny"]},
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/energy.py#L26
    "energy": {"window_type": window_options, "compression": ["log", "sqrt", "off"]},
    "filterbank": {
        "window_type": window_options,
    },
    "mfcc": {
        "window_type": window_options,
    },
    "plp": {
        "window_type": window_options,
    },
    "spectrogram": {
        "window_type": window_options,
    },
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/vtln.py#L156
    "vtln": {"norm_type": ["offset", "none", "diag"]},
}

postprocessor_class_map = {
    "cmvn": CmvnPostProcessor,
    "delta": DeltaPostProcessor,
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
    class_key: str
    init_args: List[Arg] = field(default_factory=list)
    process_args: List[Arg] = field(default_factory=list)
    required_postprocessors: List[str] = field(default_factory=list)

    def toschema(self):
        return (
            {
                "class_key": self.class_key,
                "class_name": self.processor_class.__name__,
                "init_args": [a.toschema() for a in self.init_args],
                "process_args": [a.toschema() for a in self.process_args],
                "required_postprocessors": [s for s in self.required_postprocessors],
            },
        )


@dataclass
class PostProcessorSpec:
    base_class: FeaturesPostProcessor
    init_args: List[Arg] = field(default_factory=list)
    process_args: List[Arg] = field(default_factory=list)


""" factory function for building a processor spec """


def build_processor_spec(class_key: str, Processor: FeaturesProcessor):
    processor = ProcessorSpec(
        class_key=class_key,
        processor_class=Processor,
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
    "processors": [],
    "postprocessors": [],
}


def build_schema():
    schema = spec_skel.copy()
    for k, v in processor_class_map.items():
        processor = build_processor_spec(k, v)
        schema["processors"].extend(processor.toschema())

    for k, v in postprocessor_class_map.items():
        processor = build_processor_spec(k, v)
        schema["postprocessors"].extend(processor.toschema())

    return schema


def save_schema(pth: str):
    schema = build_schema()
    with open(pth, "w") as f:
        f.write(dumps(schema))
