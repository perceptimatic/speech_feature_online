from json import loads

from shennong import FeaturesCollection

from app.analyse import Analyser


def test_can_process_simple_file_with_default_args():
    """Build a job using default args and all entries in the schema and run against a small test file"""

    with open("/code/processor-schema.json") as f:
        schema = loads(f.read())

    collection = FeaturesCollection()

    analyser = Analyser(
        "/code/app/tests/fixtures/brief-sample-audio.mp3", 1, collection
    )

    for k, processor in schema["processors"].items():
        init_args = {arg["name"]: arg["default"] for arg in processor["init_args"]}
        postprocessors = processor["valid_postprocessors"]
        settings = {"postprocessors": postprocessors, "init_args": init_args}
        analyser.process(k, settings)

    # if the loop ran fine, we'll declare victory
    assert True
