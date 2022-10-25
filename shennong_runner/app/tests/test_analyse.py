from copy import deepcopy
from unittest.mock import patch, Mock

from pytest import raises
from shennong import FeaturesCollection
from shennong.processor.spectrogram import SpectrogramProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor

from app.analyse import (
    get_column_names,
    resolve_processor,
    resolve_postprocessor,
    Analyser,
)


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


@patch("app.analyse.Audio", load=lambda x: Mock(nchannels=1, sound=True))
@patch("app.analyse.resolve_processor", return_value=Mock(process=lambda a: True))
def test_processor_and_postprocessor_with_same_name_are_merged(
    resolve_processor_mock, audio_mock
):
    """ Test that processors that depend on a postprocessor (e.g., kaldi, crepe) merge their results based on naming convention """

    key = "b"

    settings = {"init_args": {}, "postprocessors": ["a", "b", "c"]}

    calls = []

    analyser = Analyser("fakepath", 1, FeaturesCollection())
    analyser.postprocess = lambda pp, key: calls.append(pp)
    analyser.process(key, deepcopy(settings))

    # result should have only 3 keys b/c eponymous postprocessor output has overwritten processor output
    assert len(analyser.collection.keys()) == 3
    # we should not have a result in the form of "processorname_postprocessorname" if the two are the same,
    assert "b_b" not in analyser.collection.keys()
    # assert that postprocessor "b" was called first b/c it has same name as main processor and downstream postprocessors depend on its result
    assert "b" == calls[0]

    calls = []

    key = "d"

    analyser = Analyser("fakepath", 1, FeaturesCollection())
    analyser.postprocess = lambda pp, key: calls.append(pp)
    analyser.process(key, deepcopy(settings))
    # assert that b was not called first, b/c our main processor is "d", which has no corresponding postprocessor
    assert "b" != calls[0]

    # now should have 4 keys--1 for main processor "d", 3 for postprocessors "a", "b", and "c"
    assert len(analyser.collection.keys()) == 4


def test_get_col_names_general():
    """ Ensure we get what we expect from non-pitch processors """
    assert get_column_names("energy") == ["energy"]
    assert get_column_names("vad") == ["voiced"]
    assert get_column_names("foobar") == None
