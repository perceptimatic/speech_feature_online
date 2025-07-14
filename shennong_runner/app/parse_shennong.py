from dataclasses import dataclass, field
import inspect
from json import dumps
from sys import path as syspath
from typing import Any, Dict, List, Type, Union

# make sure the app module is in the python path
syspath.insert(0, "../app.py")

from shennong.processor.base import FeaturesProcessor
from shennong.processor.bottleneck import BottleneckProcessor
from shennong.processor.energy import EnergyProcessor
from shennong.processor.filterbank import FilterbankProcessor
from shennong.processor.hubert import HubertProcessor
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
    "hubert_large_ls960_ft": {
        "class_name": HubertProcessor,
        "default_overrides": {"model_path": "facebook/hubert-large-ls960-ft"},
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "mfcc": {
        "class_name": MfccProcessor,
        "valid_postprocessors": ["cmvn", "delta", "vad"],
    },
    "mHuBERT_147": {
        "class_name": HubertProcessor,
        "default_overrides": {"model_path": "utter-project/mHuBERT-147"},
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
    "hubert_large_ls960_ft": {"layer_info": [("convolutional" , str(x)) for x in range(1, 8)] + [("encoder", str(x)) for x in range(1, 25)],},
    "mfcc": {"window_type": window_options,},
    "mHuBERT_147": {"layer_info": [("convolutional" , str(x)) for x in range(1, 8)] + [("encoder", str(x)) for x in range(1, 13)],},
    "plp": {"window_type": window_options,},
    "spectrogram": {"window_type": window_options,},
    # https://github.com/bootphon/shennong/blob/master/shennong/processor/vtln.py#L156
    "vtln": {"norm_type": ["offset", "none", "diag"]},
}

postprocessor_class_map = {
    "cmvn": {"class_name": CmvnPostProcessor,},
    "delta": {"class_name": DeltaPostProcessor},
    "pitch_crepe": {
        "class_name": CrepePitchPostProcessor,
        "default_overrides": {"add_raw_log_pitch": True},
    },
    "pitch_kaldi": {
        "class_name": KaldiPitchPostProcessor,
        "default_overrides": {"add_raw_log_pitch": True},
    },
    "vad": {"class_name": VadPostProcessor},
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
    elif t == tuple:
        return "tuple"
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
    required_postprocessors: List[str] = field(default_factory=list)
    valid_postprocessors: List[str] = field(default_factory=list)

    def toschema(self):
        return {
            "class_name": self.processor_class.__name__,
            "init_args": [a.toschema() for a in self.init_args],
            "required_postprocessors": self.required_postprocessors,
            "valid_postprocessors": self.valid_postprocessors,
        }


def build_processor_spec(
    class_key: str,
    Processor: FeaturesProcessor,
    valid_postprocessors: List[str] = None,
    required_postprocessors: List[str] = None,
    default_overrides: Dict[str, Any] = None,
):
    """factory function for building a processor spec"""
    required_postprocessors = required_postprocessors if required_postprocessors else []

    valid_postprocessors = valid_postprocessors if valid_postprocessors else []

    default_overrides = default_overrides if default_overrides else {}

    processor = ProcessorSpec(
        processor_class=Processor,
        required_postprocessors=required_postprocessors,
        valid_postprocessors=valid_postprocessors,
    )

    # todo: may be simpler to use native introspection:
    # https://github.com/bootphon/shennong/blob/master/shennong/base.py#L86
    for p in inspect.signature(Processor).parameters.values():
        arg = Arg(p.name)
        arg.default = (
            default_overrides[p.name]
            if default_overrides.get(p.name, None)
            else p.default
        )
        if arg.type == str or arg.type == tuple:
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
            default_overrides=v.get("default_overrides")
        )
        schema["processors"][k] = processor.toschema()

    for k, v in postprocessor_class_map.items():
        processor = build_processor_spec(
            k, v["class_name"], default_overrides=v.get("default_overrides")
        )
        schema["postprocessors"][k] = processor.toschema()

    return schema


if __name__ == "__main__":
    print(dumps(build_schema()))
