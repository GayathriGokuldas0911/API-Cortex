from typing import Dict, Any, List, Optional
import jsonschema
from pydantic import BaseModel


class DriftDetail(BaseModel):
    drift_type: str  # MISSING_FIELD, UNEXPECTED_FIELD, TYPE_MISMATCH, STRUCTURAL_DRIFT
    field_path: str
    expected_type: Optional[str] = None
    actual_type: Optional[str] = None
    description: str
    details: Optional[Dict[str, Any]] = None


class ValidationResult(BaseModel):
    is_valid: bool
    has_drift: bool
    summary: str
    drift_details: List[DriftDetail] = []
    error_message: Optional[str] = None


def get_python_type_name(value: Any) -> str:
    """Map Python value to JSON Schema type string."""
    if value is None:
        return "null"
    elif isinstance(value, bool):
        return "boolean"
    elif isinstance(value, int):
        return "integer"
    elif isinstance(value, float):
        return "number"
    elif isinstance(value, str):
        return "string"
    elif isinstance(value, list):
        return "array"
    elif isinstance(value, dict):
        return "object"
    return type(value).__name__


def inspect_schema_drift(
    actual: Any,
    schema: Dict[str, Any],
    path: str = "root",
    drift_list: List[DriftDetail] = None
) -> List[DriftDetail]:
    """Recursively compares actual JSON response payload against expected JSON Schema."""
    if drift_list is None:
        drift_list = []

    if not isinstance(schema, dict):
        return drift_list

    schema_type = schema.get("type")
    actual_type = get_python_type_name(actual)

    # 1. Type Mismatch Check
    if schema_type:
        expected_types = [schema_type] if isinstance(schema_type, str) else schema_type
        # Allow integer as valid number
        if "number" in expected_types and actual_type == "integer":
            pass
        elif actual_type not in expected_types and actual_type != "null":
            drift_list.append(
                DriftDetail(
                    drift_type="TYPE_MISMATCH",
                    field_path=path,
                    expected_type=str(schema_type),
                    actual_type=actual_type,
                    description=f"Field '{path}' type mismatch: expected {schema_type}, received {actual_type}"
                )
            )
            return drift_list

    # 2. Object Properties & Required Fields Check
    if schema_type == "object" or "properties" in schema:
        if not isinstance(actual, dict):
            drift_list.append(
                DriftDetail(
                    drift_type="STRUCTURAL_DRIFT",
                    field_path=path,
                    expected_type="object",
                    actual_type=actual_type,
                    description=f"Expected JSON object at '{path}', received {actual_type}"
                )
            )
            return drift_list

        properties = schema.get("properties", {})
        required = schema.get("required", [])

        # Check missing required fields
        for req_field in required:
            if req_field not in actual:
                field_path = f"{path}.{req_field}" if path != "root" else req_field
                expected_field_schema = properties.get(req_field, {})
                exp_t = expected_field_schema.get("type", "any")
                drift_list.append(
                    DriftDetail(
                        drift_type="MISSING_FIELD",
                        field_path=field_path,
                        expected_type=str(exp_t),
                        actual_type="missing",
                        description=f"Required field '{field_path}' is missing in response"
                    )
                )

        # Check properties recursively and detect unexpected fields
        additional_properties = schema.get("additionalProperties", True)

        for key, value in actual.items():
            field_path = f"{path}.{key}" if path != "root" else key
            if key in properties:
                inspect_schema_drift(value, properties[key], field_path, drift_list)
            elif additional_properties is False:
                drift_list.append(
                    DriftDetail(
                        drift_type="UNEXPECTED_FIELD",
                        field_path=field_path,
                        expected_type="none",
                        actual_type=get_python_type_name(value),
                        description=f"Unexpected field '{field_path}' detected in response payload"
                    )
                )

    # 3. Array Items Check
    elif schema_type == "array" or "items" in schema:
        if not isinstance(actual, list):
            drift_list.append(
                DriftDetail(
                    drift_type="STRUCTURAL_DRIFT",
                    field_path=path,
                    expected_type="array",
                    actual_type=actual_type,
                    description=f"Expected JSON array at '{path}', received {actual_type}"
                )
            )
            return drift_list

        item_schema = schema.get("items")
        if item_schema and isinstance(item_schema, dict):
            for idx, item in enumerate(actual):
                item_path = f"{path}[{idx}]"
                inspect_schema_drift(item, item_schema, item_path, drift_list)

    return drift_list


def validate_response_schema(
    actual_data: Any,
    expected_schema: Dict[str, Any]
) -> ValidationResult:
    """Validates actual API response against expected JSON Schema and detects drift."""
    if not expected_schema:
        return ValidationResult(
            is_valid=True,
            has_drift=False,
            summary="No expected schema configured for API."
        )

    # Standard JSON Schema validation test
    jsonschema_valid = True
    jsonschema_error = None

    try:
        jsonschema.validate(instance=actual_data, schema=expected_schema)
    except jsonschema.ValidationError as ve:
        jsonschema_valid = False
        jsonschema_error = ve.message
    except Exception as e:
        jsonschema_valid = False
        jsonschema_error = str(e)

    # Detailed drift detection
    drift_details = inspect_schema_drift(actual_data, expected_schema)

    has_drift = len(drift_details) > 0 or not jsonschema_valid

    if not has_drift:
        summary = "Response matches expected OpenAPI schema perfectly."
    else:
        summary = f"Detected {len(drift_details)} schema drift issue(s)."
        if jsonschema_error and not drift_details:
            summary += f" JSONSchema error: {jsonschema_error}"

    return ValidationResult(
        is_valid=not has_drift,
        has_drift=has_drift,
        summary=summary,
        drift_details=drift_details,
        error_message=jsonschema_error
    )
