from json import loads
from os import path

from shennong import FeaturesCollection
from shennong.processor.pitch_crepe import CrepePitchPostProcessor

from app.analyse import Analyser
from app.settings import settings as app_settings
from app.parse_shennong import build_processor_spec


def test_can_provide_default_overrides():
    """ Test that parse_shennong function can provide overrides to default processor constructor arguments"""
    arg_name = "add_raw_log_pitch"
    arg_val = True
    result_val = None
    spec = build_processor_spec(
        "pitch_crepe", CrepePitchPostProcessor, default_overrides={arg_name: arg_val}
    )
    for init_arg in spec.init_args:
        if init_arg.name == arg_name:
            result_val = init_arg.default
    assert result_val == arg_val


def test_can_process_simple_file_with_default_args():
    """Build a job using default args and all entries in the schema and run against a small test file"""

    with open(path.join(app_settings.PROJECT_ROOT, "processor-schema.json")) as f:
        schema = loads(f.read())

    collection = FeaturesCollection()

    analyser = Analyser(
        path.join(app_settings.PROJECT_ROOT, "app/tests/fixtures/mono-sample.wav"),
        1,
        collection,
    )

    for k, processor in schema["processors"].items():
        init_args = {arg["name"]: arg["default"] for arg in processor["init_args"]}
        postprocessors = processor["valid_postprocessors"]
        settings = {"postprocessors": postprocessors, "init_args": init_args}
        analyser.process(k, settings)

    # if the loop ran fine, we'll declare victory
    assert True
