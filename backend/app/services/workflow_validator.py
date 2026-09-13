from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

from app.models.workflow import WorkflowEdgeType, WorkflowNodeType
from app.schemas.workflow import WorkflowEdgePayload, WorkflowNodePayload


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    errors: list[str]


def _has_assignment(configuration: dict[str, Any]) -> bool:
    return any(
        configuration.get(key)
        for key in ("assigned_role", "assigned_user_id", "assigned_department_id")
    )


def _edge_path_type(edge: WorkflowEdgePayload) -> str:
    edge_type = edge.edge_type.value if isinstance(edge.edge_type, WorkflowEdgeType) else str(edge.edge_type)
    label = (edge.label or "").strip().upper()
    return label or edge_type.upper()


def validate_workflow_graph(
    nodes: list[WorkflowNodePayload],
    edges: list[WorkflowEdgePayload],
) -> ValidationResult:
    errors: list[str] = []
    node_by_key = {node.node_key: node for node in nodes}

    if len(node_by_key) != len(nodes):
        errors.append("Every workflow node must have a unique key.")

    start_nodes = [node for node in nodes if node.node_type == WorkflowNodeType.START]
    end_nodes = [node for node in nodes if node.node_type == WorkflowNodeType.END]

    if len(start_nodes) != 1:
        errors.append("Workflow must contain exactly one Start node.")
    if not end_nodes:
        errors.append("Workflow must contain at least one End node.")

    outgoing: dict[str, list[WorkflowEdgePayload]] = defaultdict(list)
    incoming: dict[str, list[WorkflowEdgePayload]] = defaultdict(list)

    for edge in edges:
        if edge.source_node_key not in node_by_key:
            errors.append(f"Edge source '{edge.source_node_key}' does not reference a valid node.")
        if edge.target_node_key not in node_by_key:
            errors.append(f"Edge target '{edge.target_node_key}' does not reference a valid node.")
        outgoing[edge.source_node_key].append(edge)
        incoming[edge.target_node_key].append(edge)

    if start_nodes and not outgoing.get(start_nodes[0].node_key):
        errors.append("Start node is not connected to the workflow.")

    for node in nodes:
        if node.node_type != WorkflowNodeType.START and not incoming.get(node.node_key):
            errors.append(f"{node.title} is missing an incoming connection.")
        if node.node_type != WorkflowNodeType.END and not outgoing.get(node.node_key):
            errors.append(f"{node.title} is missing an outgoing connection.")

        if node.node_type == WorkflowNodeType.APPROVAL and not _has_assignment(node.configuration_json):
            errors.append(f"{node.title} has no assigned role, user, or department.")
        if node.node_type == WorkflowNodeType.TASK and not _has_assignment(node.configuration_json):
            errors.append(f"{node.title} has no assigned role, user, or department.")
        if node.node_type == WorkflowNodeType.CONDITION:
            paths = {_edge_path_type(edge) for edge in outgoing.get(node.node_key, [])}
            if WorkflowEdgeType.TRUE.value not in paths:
                errors.append(f"{node.title} is missing its TRUE path.")
            if WorkflowEdgeType.FALSE.value not in paths:
                errors.append(f"{node.title} is missing its FALSE path.")
            required_rule_fields = ("field", "operator", "value")
            if not all(key in node.configuration_json for key in required_rule_fields):
                errors.append(f"{node.title} has an incomplete condition rule.")

    if start_nodes:
        visited = set()
        queue = deque([start_nodes[0].node_key])
        while queue:
            node_key = queue.popleft()
            if node_key in visited:
                continue
            visited.add(node_key)
            for edge in outgoing.get(node_key, []):
                if edge.target_node_key in node_by_key:
                    queue.append(edge.target_node_key)

        unreachable = [
            node.title
            for node in nodes
            if node.node_key not in visited and node.node_type != WorkflowNodeType.START
        ]
        for title in unreachable:
            errors.append(f"{title} is not reachable from Start.")

    return ValidationResult(valid=not errors, errors=errors)
