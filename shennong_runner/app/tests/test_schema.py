from json import loads
from os import path

from shennong import FeaturesCollection

from app.analyse import Analyser
from app.settings import settings as app_settings


def test_can_process_simple_file_with_default_args():
    """Build a job using default args and all entries in the schema and run against a small test file"""

    with open(path.join(app_settings.PROJECT_ROOT, "processor-schema.json")) as f:
        schema = loads(f.read())

    collection = FeaturesCollection()

    analyser = Analyser(
        path.join(
            app_settings.PROJECT_ROOT, "app/tests/fixtures/mono-sample.wav"
        ),
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
