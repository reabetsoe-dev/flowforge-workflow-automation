from typing import Any


class ConditionEvaluationError(Exception):
    pass


def evaluate_condition(configuration: dict[str, Any], submitted_data: dict[str, Any]) -> bool:
    field = configuration.get("field")
    operator = configuration.get("operator")
    comparison_value = configuration.get("value")

    if not field or not operator:
        raise ConditionEvaluationError("Condition configuration must include field and operator.")

    actual_value = submitted_data.get(str(field))

    if operator == "equals":
        return actual_value == comparison_value
    if operator == "not_equals":
        return actual_value != comparison_value
    if operator == "greater_than":
        return _as_number(actual_value) > _as_number(comparison_value)
    if operator == "greater_than_or_equal":
        return _as_number(actual_value) >= _as_number(comparison_value)
    if operator == "less_than":
        return _as_number(actual_value) < _as_number(comparison_value)
    if operator == "less_than_or_equal":
        return _as_number(actual_value) <= _as_number(comparison_value)
    if operator == "contains":
        if actual_value is None:
            return False
        return str(comparison_value).lower() in str(actual_value).lower()

    raise ConditionEvaluationError(f"Unsupported condition operator: {operator}.")


def _as_number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ConditionEvaluationError("Condition comparison requires numeric values.") from exc
