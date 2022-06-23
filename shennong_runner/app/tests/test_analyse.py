from pytest import raises

from shennong.processor.spectrogram import SpectrogramProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor

from app.analyse import resolve_processor, resolve_postprocessor


def test_resolve_spectrogram_processor():
    settings = {
        "frame_shift": 0.01,
        "frame_length": 0.025,
        "window_type": "povey",
        "snip_edges": True,
    }
    processor = resolve_processor("spectrogram", settings)
    assert isinstance(processor, SpectrogramProcessor)


def test_resolve_delta_postprocessor():
    postprocessor = resolve_postprocessor("delta", None)
    assert isinstance(postprocessor, DeltaPostProcessor)


def test_resolve_cmvn_postprocessor():
    postprocessor = resolve_postprocessor("cmvn", 2)
    assert isinstance(postprocessor, CmvnPostProcessor)


def test_resolve_cmvn_postprocessor():
    """Test that an error is raised when the argument is missing"""
    with raises(AttributeError):
        resolve_postprocessor("cmvn")
