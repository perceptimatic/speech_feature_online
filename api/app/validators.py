from dataclasses import dataclass
from json import dumps, loads
from typing import Any, Callable, List

from pydantic import EmailStr
from fastapi import HTTPException

from app.settings import settings


@dataclass
class ValidationViolation:
    """A validation violation"""

    field: str
    message: str


def find(haystack: List[Any], cb: Callable):
    """return first item that returns true"""
    return next(item for item in haystack if cb(item))


def raise_422(messages: List[ValidationViolation]):
    """raise the exeption"""
    detail = dumps({m.field: m.message for m in messages})
    raise HTTPException(422, detail)


def validate_job_request(request: dict):
    """wrapper that injects the schema, handy for testing"""
    with open("/code/static/processor-schema.json", mode="r", encoding="UTF-8") as f:
        schema = loads(f.read())
    _validate_top_level_fields(request)
    return _validate_analyses(request, schema)


def check_type(userval: Any, spec: Any):
    """Check type against schema"""
    if spec["type"] == "string":
        if spec.get("options"):
            return userval in spec["options"]
        return isinstance(userval, str)

    elif spec["type"] == "integer":
        return isinstance(userval, int)

    elif spec["type"] == "boolean":
        return isinstance(userval, bool)

    elif spec["type"] == "number":
        return isinstance(userval, float)

    raise ValueError(f"Unknown schema type: {spec['type']}")


def _validate_top_level_fields(request: dict):
    violations = []

    for required_field in ["channel", "email", "files", "res"]:
        if not request.get(required_field):
            violations.append(
                ValidationViolation(required_field, f"{required_field} is required")
            )

    if violations:
        raise_422(violations)

    if request["channel"] not in [1, 2]:
        violations.append(
            ValidationViolation("channel", "channel should be either 1 or 2")
        )

    if not isinstance(request["files"], list) or not request["files"]:
        violations.append(
            ValidationViolation("files", "files[] must contain at least one file")
        )

    allowed_res = [".npz", ".mat", ".pkl", ".h5f", ".ark", ".csv"]

    if not request["res"] in allowed_res:
        violations.append(
            ValidationViolation("res", f"res must be one of {', '.join(allowed_res)}")
        )

    try:
        EmailStr.validate(request["email"])
    except Exception:
        violations.append(
            ValidationViolation("email", "email field must be a valid email address")
        )

    if settings.EMAIL_ALLOWLIST and str(
        request["email"]
    ).strip() not in settings.EMAIL_ALLOWLIST.split(","):
        violations.append(ValidationViolation("email", "email not in allow list"))

    if violations:
        raise_422(violations)

    return True


def _validate_analyses(request: dict, schema: dict):
    """build the validator"""

    violations = []

    if not request.get("analyses"):
        violations.append(ValidationViolation("analyses", "analyses field is required"))
        raise_422(violations)

    processor_list = [p["class_key"] for p in schema["processors"]]

    # validate shape
    for key, val in request["analyses"].items():
        if key not in processor_list:
            violations.append(
                ValidationViolation("analysis", f"Unknown processor {key}")
            )
            continue
        if not "init_args" in val.keys():
            violations.append(
                ValidationViolation(
                    "analysis",
                    f"{key} processor is missing required field `init_args`",
                )
            )

    if violations:
        raise_422(violations)

    for key, analysis in request["analyses"].items():
        processor_schema = find(schema["processors"], lambda x: x["class_key"] == key)
        init_args = analysis["init_args"]
        for arg in processor_schema["init_args"]:
            if arg.get("required") and not init_args.get(arg["name"]):
                violations.append(
                    ValidationViolation(
                        arg["name"],
                        f"{analysis} processor is missing required field `{arg['name']}`",
                    )
                )
                continue
            if init_args.get(arg["name"]) and not check_type(
                init_args.get(arg["name"]), arg
            ):
                violations.append(
                    ValidationViolation(
                        arg["name"],
                        f"{key} processor field `{arg['name']}` must be of type {arg['type']}",
                    )
                )
        for pp in processor_schema["required_postprocessors"]:
            if pp not in analysis["postprocessors"]:
                violations.append(
                    ValidationViolation(
                        pp,
                        f"{analysis} processor requires postprocessor `{pp}`",
                    )
                )

    if violations:
        raise_422(violations)

    return True
