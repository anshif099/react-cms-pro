import json


OPERATION_TYPES = {
    "insert_component",
    "update_component",
    "remove_component",
    "move_component",
    "duplicate_component",
    "update_theme",
    "update_page",
    "update_region",
    "create_source_file",
    "replace_source_file",
}

FORBIDDEN_PATH_PARTS = {"__proto__", "prototype", "constructor"}
PLAN_FIELDS = {
    "title",
    "summary",
    "assistantMessage",
    "risk",
    "estimatedEdits",
    "requiresApproval",
    "affectedAreas",
    "preserved",
    "validationChecks",
    "operations",
}


def extract_json_object(text):
    source = str(text or "")
    start = source.find("{")
    if start < 0:
        raise ValueError("Rocket AI produced no JSON object")
    depth = 0
    quoted = False
    escaped = False
    for index in range(start, len(source)):
        character = source[index]
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
            continue
        if character == '"':
            quoted = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return source[start:index + 1]
    raise ValueError("Rocket AI produced incomplete JSON")


def validate_plan(plan):
    if not isinstance(plan, dict):
        raise ValueError("Rocket AI plan must be an object")
    missing = PLAN_FIELDS.difference(plan)
    if missing:
        raise ValueError(f"Rocket AI plan is missing: {', '.join(sorted(missing))}")
    operations = plan.get("operations")
    if not isinstance(operations, list) or len(operations) > 80:
        raise ValueError("Rocket AI plan operations must contain at most 80 items")
    seen = set()
    for operation in operations:
        if not isinstance(operation, dict):
            raise ValueError("Rocket AI operation must be an object")
        operation_id = str(operation.get("id") or "")
        if not operation_id or operation_id in seen:
            raise ValueError("Rocket AI operation ids must be unique")
        seen.add(operation_id)
        if operation.get("type") not in OPERATION_TYPES:
            raise ValueError(f"Unsupported Rocket AI operation: {operation.get('type')}")
        patches = operation.get("patches")
        if not isinstance(patches, list):
            raise ValueError(f"Operation {operation_id} has invalid patches")
        for patch in patches:
            path = str(patch.get("path") or "")
            if not path or any(part in FORBIDDEN_PATH_PARTS for part in path.split(".")):
                raise ValueError(f"Operation {operation_id} has an unsafe patch path")
            if not isinstance(patch.get("valueJson"), str):
                raise ValueError(f"Operation {operation_id} has an invalid patch value")
    plan["requiresApproval"] = True
    return plan


def parse_and_validate_plan(text):
    return validate_plan(json.loads(extract_json_object(text)))
