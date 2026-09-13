from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.api.serializers import instance_to_read
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.workflow import (
    Workflow,
    WorkflowEdge,
    WorkflowEdgeType,
    WorkflowNode,
    WorkflowNodeType,
    WorkflowStatus,
    WorkflowVersion,
)
from app.models.base import utc_now
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowEdgePayload,
    WorkflowEdgeRead,
    WorkflowNodePayload,
    WorkflowNodeRead,
    WorkflowRead,
    WorkflowSummary,
    WorkflowUpdate,
    WorkflowValidationResponse,
    WorkflowVersionRead,
)
from app.schemas.execution import StartWorkflowRequest, WorkflowInstanceRead
from app.services.audit_service import record_audit_log
from app.services.workflow_validator import validate_workflow_graph
from app.services.workflow_engine import WorkflowEngine, WorkflowExecutionError

router = APIRouter(prefix="/workflows", tags=["Workflows"])

MANAGE_WORKFLOW_ROLES = (UserRole.ADMINISTRATOR, UserRole.WORKFLOW_DESIGNER)
VIEW_ALL_WORKFLOW_ROLES = (
    UserRole.ADMINISTRATOR,
    UserRole.WORKFLOW_DESIGNER,
    UserRole.AUDITOR,
)


def default_nodes() -> list[WorkflowNodePayload]:
    return [
        WorkflowNodePayload(
            node_key="start",
            node_type=WorkflowNodeType.START,
            title="Start",
            configuration_json={"description": "Workflow entry point."},
            position_x=0,
            position_y=120,
        ),
        WorkflowNodePayload(
            node_key="end",
            node_type=WorkflowNodeType.END,
            title="Completed",
            configuration_json={"result": "COMPLETED"},
            position_x=520,
            position_y=120,
        ),
    ]


def default_edges() -> list[WorkflowEdgePayload]:
    return [
        WorkflowEdgePayload(
            source_node_key="start",
            target_node_key="end",
            edge_type=WorkflowEdgeType.DEFAULT,
            label=None,
        )
    ]


def node_model_to_payload(node: WorkflowNode) -> WorkflowNodePayload:
    return WorkflowNodePayload(
        node_key=node.node_key,
        node_type=node.node_type,
        title=node.title,
        configuration_json=node.configuration_json or {},
        position_x=node.position_x,
        position_y=node.position_y,
    )


def edge_model_to_payload(edge: WorkflowEdge) -> WorkflowEdgePayload:
    return WorkflowEdgePayload(
        source_node_key=edge.source_node_key,
        target_node_key=edge.target_node_key,
        edge_type=edge.edge_type,
        label=edge.label,
    )


def get_latest_version(workflow: Workflow) -> WorkflowVersion | None:
    if not workflow.versions:
        return None
    return max(workflow.versions, key=lambda version: version.version_number)


def get_draft_version(workflow: Workflow) -> WorkflowVersion | None:
    drafts = [version for version in workflow.versions if version.published_at is None]
    if not drafts:
        return None
    return max(drafts, key=lambda version: version.version_number)


def get_published_version(workflow: Workflow) -> WorkflowVersion | None:
    published = [version for version in workflow.versions if version.published_at is not None]
    if not published:
        return None
    return max(published, key=lambda version: version.version_number)


def user_can_view_drafts(user: User) -> bool:
    return user.role in VIEW_ALL_WORKFLOW_ROLES


def get_visible_version(workflow: Workflow, current_user: User) -> WorkflowVersion | None:
    if user_can_view_drafts(current_user):
        return get_latest_version(workflow)
    return get_published_version(workflow)


def version_to_read(version: WorkflowVersion) -> WorkflowVersionRead:
    return WorkflowVersionRead(
        id=version.id,
        version_number=version.version_number,
        created_at=version.created_at,
        published_at=version.published_at,
        is_draft=version.published_at is None,
        nodes=[
            WorkflowNodeRead(
                id=node.id,
                node_key=node.node_key,
                node_type=node.node_type,
                title=node.title,
                configuration_json=node.configuration_json or {},
                position_x=node.position_x,
                position_y=node.position_y,
            )
            for node in version.nodes
        ],
        edges=[
            WorkflowEdgeRead(
                id=edge.id,
                source_node_key=edge.source_node_key,
                target_node_key=edge.target_node_key,
                edge_type=edge.edge_type,
                label=edge.label,
            )
            for edge in version.edges
        ],
    )


def workflow_to_summary(workflow: Workflow, current_user: User) -> WorkflowSummary:
    latest_version = get_latest_version(workflow)
    draft_version = get_draft_version(workflow)
    published_version = get_published_version(workflow)
    visible_version = get_visible_version(workflow, current_user)
    visible_published_version_number = (
        published_version.version_number if published_version else None
    )
    return WorkflowSummary(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        category=workflow.category,
        status=workflow.status,
        created_by=workflow.created_by,
        created_by_name=workflow.creator.full_name if workflow.creator else None,
        version_count=len(workflow.versions) if user_can_view_drafts(current_user) else int(published_version is not None),
        latest_version_number=(
            latest_version.version_number
            if user_can_view_drafts(current_user) and latest_version
            else visible_published_version_number
        ),
        draft_version_number=(
            draft_version.version_number
            if user_can_view_drafts(current_user) and draft_version
            else None
        ),
        published_version_number=visible_published_version_number,
        node_count=len(visible_version.nodes) if visible_version else 0,
        edge_count=len(visible_version.edges) if visible_version else 0,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


def workflow_to_read(workflow: Workflow, current_user: User) -> WorkflowRead:
    summary = workflow_to_summary(workflow, current_user)
    visible_version = get_visible_version(workflow, current_user)
    return WorkflowRead(
        **summary.model_dump(),
        latest_version=version_to_read(visible_version) if visible_version else None,
    )


def workflow_query():
    return (
        select(Workflow)
        .options(
            selectinload(Workflow.creator),
            selectinload(Workflow.versions).selectinload(WorkflowVersion.nodes),
            selectinload(Workflow.versions).selectinload(WorkflowVersion.edges),
        )
        .order_by(Workflow.updated_at.desc(), Workflow.name)
    )


def get_workflow_or_404(
    db: Session,
    workflow_id: int,
    current_user: User,
) -> Workflow:
    workflow = db.scalar(workflow_query().where(Workflow.id == workflow_id))
    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found.",
        )
    if (
        current_user.role not in VIEW_ALL_WORKFLOW_ROLES
        and workflow.status != WorkflowStatus.PUBLISHED
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found.",
        )
    return workflow


def replace_version_definition(
    version: WorkflowVersion,
    nodes: list[WorkflowNodePayload],
    edges: list[WorkflowEdgePayload],
) -> None:
    version.nodes.clear()
    version.edges.clear()
    version.nodes.extend(
        WorkflowNode(
            node_key=node.node_key,
            node_type=node.node_type,
            title=node.title,
            configuration_json=node.configuration_json,
            position_x=node.position_x,
            position_y=node.position_y,
        )
        for node in nodes
    )
    version.edges.extend(
        WorkflowEdge(
            source_node_key=edge.source_node_key,
            target_node_key=edge.target_node_key,
            edge_type=edge.edge_type,
            label=edge.label,
        )
        for edge in edges
    )


def create_version(
    version_number: int,
    nodes: list[WorkflowNodePayload],
    edges: list[WorkflowEdgePayload],
) -> WorkflowVersion:
    version = WorkflowVersion(version_number=version_number)
    replace_version_definition(version, nodes, edges)
    return version


def get_or_create_editable_version(workflow: Workflow) -> WorkflowVersion:
    draft_version = get_draft_version(workflow)
    if draft_version is not None:
        return draft_version

    latest_version = get_latest_version(workflow)
    next_version_number = (latest_version.version_number if latest_version else 0) + 1
    nodes = [node_model_to_payload(node) for node in latest_version.nodes] if latest_version else default_nodes()
    edges = [edge_model_to_payload(edge) for edge in latest_version.edges] if latest_version else default_edges()
    version = create_version(next_version_number, nodes, edges)
    workflow.versions.append(version)
    return version


@router.get("", response_model=list[WorkflowSummary])
def list_workflows(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkflowSummary]:
    query = workflow_query()
    if current_user.role not in VIEW_ALL_WORKFLOW_ROLES:
        query = query.where(Workflow.status == WorkflowStatus.PUBLISHED)
    workflows = db.scalars(query).all()
    return [workflow_to_summary(workflow, current_user) for workflow in workflows]


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
def create_workflow(
    payload: WorkflowCreate,
    current_user: User = Depends(require_roles(*MANAGE_WORKFLOW_ROLES)),
    db: Session = Depends(get_db),
) -> WorkflowRead:
    workflow = Workflow(
        name=payload.name.strip(),
        description=payload.description,
        category=payload.category.strip(),
        status=WorkflowStatus.DRAFT,
        created_by=current_user.id,
    )
    version = create_version(
        version_number=1,
        nodes=payload.nodes or default_nodes(),
        edges=payload.edges or default_edges(),
    )
    workflow.versions.append(version)
    db.add(workflow)
    db.flush()
    record_audit_log(
        db,
        current_user,
        "WORKFLOW_CREATED",
        "Workflow",
        workflow.id,
        f"{current_user.full_name} created workflow {workflow.name}.",
    )
    db.commit()
    workflow = get_workflow_or_404(db, workflow.id, current_user)
    return workflow_to_read(workflow, current_user)


@router.get("/{workflow_id}", response_model=WorkflowRead)
def get_workflow(
    workflow_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowRead:
    workflow = get_workflow_or_404(db, workflow_id, current_user)
    return workflow_to_read(workflow, current_user)


@router.put("/{workflow_id}", response_model=WorkflowRead)
def update_workflow(
    workflow_id: int,
    payload: WorkflowUpdate,
    current_user: User = Depends(require_roles(*MANAGE_WORKFLOW_ROLES)),
    db: Session = Depends(get_db),
) -> WorkflowRead:
    workflow = get_workflow_or_404(db, workflow_id, current_user)
    if workflow.status == WorkflowStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived workflows cannot be edited.",
        )

    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        workflow.name = data["name"].strip()
    if "description" in data:
        workflow.description = data["description"]
    if data.get("category") is not None:
        workflow.category = data["category"].strip()

    if "nodes" in data or "edges" in data:
        editable_version = get_or_create_editable_version(workflow)
        current_nodes = [node_model_to_payload(node) for node in editable_version.nodes]
        current_edges = [edge_model_to_payload(edge) for edge in editable_version.edges]
        replace_version_definition(
            editable_version,
            nodes=payload.nodes if payload.nodes is not None else current_nodes,
            edges=payload.edges if payload.edges is not None else current_edges,
        )

    record_audit_log(
        db,
        current_user,
        "WORKFLOW_UPDATED",
        "Workflow",
        workflow.id,
        f"{current_user.full_name} updated workflow {workflow.name}.",
    )
    db.commit()
    workflow = get_workflow_or_404(db, workflow_id, current_user)
    return workflow_to_read(workflow, current_user)


@router.post("/{workflow_id}/validate", response_model=WorkflowValidationResponse)
def validate_workflow(
    workflow_id: int,
    current_user: User = Depends(require_roles(*VIEW_ALL_WORKFLOW_ROLES)),
    db: Session = Depends(get_db),
) -> WorkflowValidationResponse:
    workflow = get_workflow_or_404(db, workflow_id, current_user)
    version = get_draft_version(workflow) or get_latest_version(workflow)
    if version is None:
        return WorkflowValidationResponse(valid=False, errors=["Workflow has no version to validate."])
    result = validate_workflow_graph(
        [node_model_to_payload(node) for node in version.nodes],
        [edge_model_to_payload(edge) for edge in version.edges],
    )
    return WorkflowValidationResponse(valid=result.valid, errors=result.errors)


@router.post("/{workflow_id}/publish", response_model=WorkflowRead)
def publish_workflow(
    workflow_id: int,
    current_user: User = Depends(require_roles(*MANAGE_WORKFLOW_ROLES)),
    db: Session = Depends(get_db),
) -> WorkflowRead:
    workflow = get_workflow_or_404(db, workflow_id, current_user)
    if workflow.status == WorkflowStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived workflows cannot be published.",
        )

    draft_version = get_draft_version(workflow)
    if draft_version is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow has no draft version to publish.",
        )

    result = validate_workflow_graph(
        [node_model_to_payload(node) for node in draft_version.nodes],
        [edge_model_to_payload(edge) for edge in draft_version.edges],
    )
    if not result.valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Workflow validation failed.", "errors": result.errors},
        )

    draft_version.published_at = utc_now()
    workflow.status = WorkflowStatus.PUBLISHED
    record_audit_log(
        db,
        current_user,
        "WORKFLOW_PUBLISHED",
        "Workflow",
        workflow.id,
        f"{current_user.full_name} published workflow {workflow.name} version {draft_version.version_number}.",
    )
    db.commit()
    workflow = get_workflow_or_404(db, workflow_id, current_user)
    return workflow_to_read(workflow, current_user)


@router.post("/{workflow_id}/start", response_model=WorkflowInstanceRead, status_code=status.HTTP_201_CREATED)
def start_workflow(
    workflow_id: int,
    payload: StartWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    engine = WorkflowEngine(db)
    try:
        instance = engine.start_workflow(
            workflow_id=workflow_id,
            started_by=current_user,
            submitted_data=payload.submitted_data_json,
        )
        record_audit_log(
            db,
            current_user,
            "WORKFLOW_STARTED",
            "WorkflowInstance",
            instance.reference_number,
            f"{current_user.full_name} started {instance.reference_number}.",
        )
        if instance.status.value in {"COMPLETED", "REJECTED", "CANCELLED"}:
            record_audit_log(
                db,
                current_user,
                f"WORKFLOW_{instance.status.value}",
                "WorkflowInstance",
                instance.reference_number,
                f"{instance.reference_number} reached {instance.status.value}.",
            )
        db.commit()
        return instance_to_read(instance)
    except WorkflowExecutionError as exc:
        db.rollback()
        status_code = (
            status.HTTP_422_UNPROCESSABLE_ENTITY
            if "missing required fields" in str(exc)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
