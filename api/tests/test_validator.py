from pytest import raises
from fastapi import HTTPException

from app.validators import (
    _validate_analyses,
    _validate_top_level_fields,
    check_type,
    find,
    raise_422,
    ValidationViolation,
)

top_level_valid = {
    "channel": 1,
    "files": ["abc"],
    "res": ".csv",
    "email": "test@example.com",
}


def test_check_type():
    """test our type checker"""
    test_spec = {"type": "string"}

    assert check_type(1, test_spec) is False


def test_find():
    """test that our helper function works"""
    assert find([1, 2, 3], lambda x: x == 3) == 3


def test_raise():
    """test the exception factory"""
    violation = ValidationViolation("field1", "this is a test")
    with raises(HTTPException):
        raise_422([violation])


def test_top_level_required_check():
    """test that all fields must be present"""
    config = {"channel": False}
    with raises(HTTPException):
        _validate_top_level_fields(config)


def test_top_level_valid_check():
    """test that a good config passes"""
    assert _validate_top_level_fields(top_level_valid)


def test_top_level_fails_at_bad_res():
    """test that a bad res value will raise exception"""
    bad_config = top_level_valid.copy()
    bad_config["res"] = 123
    with raises(HTTPException):
        _validate_top_level_fields(bad_config)


def test_top_level_fails_at_bad_email():
    """test that a bad email value will raise exception"""
    bad_config = top_level_valid.copy()
    bad_config["email"] = 123
    with raises(HTTPException):
        _validate_top_level_fields(bad_config)


def test_analysis_validation_fails_without_top_key():
    """test the exception factory"""
    config = {"analyses-missing": 123}
    with raises(HTTPException):
        _validate_analyses(config, {})


def test_analysis_validation_fails_with_unknown_processor():
    """test a basic implementation"""
    config = {"analyses": {"b": {"init_args": {}}}}
    with raises(HTTPException):
        _validate_analyses(config, {"processors": [{"class_key": "a"}]})


def test_analysis_validation_passes_empty_check():
    """test a basic implementation without type checks"""
    job_config = {"analyses": {"a": {"init_args": []}}}
    assert _validate_analyses(
        job_config, {"processors": [{"class_key": "a", "init_args": []}]}
    )


def test_analysis_validation_fails_string_check():
    """test a basic type check failure"""
    job_config = {"analyses": {"a": {"init_args": {"foo": 1}}}}
    with raises(HTTPException):
        assert _validate_analyses(
            job_config,
            {
                "processors": [
                    {"class_key": "a", "init_args": [{"name": "foo", "type": "string"}]}
                ]
            },
        )
