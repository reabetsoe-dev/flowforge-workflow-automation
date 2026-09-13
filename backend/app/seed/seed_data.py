from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.execution import (
    Approval,
    ApprovalStatus,
    Notification,
    Task,
    TaskStatus,
    WorkflowEvent,
    WorkflowInstance,
    WorkflowInstanceStatus,
)
from app.models.user import User, UserRole
from app.models.base import utc_now
from app.models.workflow import (
    Workflow,
    WorkflowEdge,
    WorkflowEdgeType,
    WorkflowNode,
    WorkflowNodeType,
    WorkflowStatus,
    WorkflowVersion,
)
from app.services.audit_service import record_audit_log
from app.services.workflow_engine import WorkflowEngine

DEMO_PASSWORD = "Demo123!"

DEPARTMENTS = [
    ("Finance", "Budget control, payment review, and financial approvals."),
    ("Procurement", "Vendor coordination, sourcing, and purchasing operations."),
    ("Information Technology", "Systems access, infrastructure, and service delivery."),
    ("Human Resources", "Employee services, leave, policy, and people operations."),
    ("Operations", "Facilities, logistics, and internal service execution."),
    ("Administration", "Office administration and cross-functional coordination."),
    ("Executive Office", "Strategic oversight and executive decision-making."),
]

DEMO_USERS = [
    ("Avery Stone", "admin@flowforge.local", UserRole.ADMINISTRATOR, "Administration", True),
    ("Maya Chen", "designer@flowforge.local", UserRole.WORKFLOW_DESIGNER, "Operations", True),
    ("Thabo Mokoena", "manager@flowforge.local", UserRole.MANAGER, "Procurement", True),
    ("Lerato Ndlovu", "employee@flowforge.local", UserRole.EMPLOYEE, "Information Technology", True),
    ("Jonah Price", "auditor@flowforge.local", UserRole.AUDITOR, "Finance", True),
    ("Naledi Khumalo", "naledi.khumalo@flowforge.local", UserRole.EMPLOYEE, "Finance", True),
    ("Priya Naidoo", "priya.naidoo@flowforge.local", UserRole.MANAGER, "Human Resources", True),
    ("Marcus Reed", "marcus.reed@flowforge.local", UserRole.EMPLOYEE, "Operations", True),
    ("Elena Petrova", "elena.petrova@flowforge.local", UserRole.WORKFLOW_DESIGNER, "Administration", True),
    ("Sipho Dlamini", "sipho.dlamini@flowforge.local", UserRole.MANAGER, "Information Technology", True),
    ("Amara Okafor", "amara.okafor@flowforge.local", UserRole.EMPLOYEE, "Procurement", True),
    ("Theo Jacobs", "theo.jacobs@flowforge.local", UserRole.EMPLOYEE, "Executive Office", True),
    ("Nina Patel", "nina.patel@flowforge.local", UserRole.AUDITOR, "Finance", True),
    ("Owen Brooks", "owen.brooks@flowforge.local", UserRole.EMPLOYEE, "Human Resources", True),
    ("Karabo Molefe", "karabo.molefe@flowforge.local", UserRole.EMPLOYEE, "Operations", True),
    ("Grace Williams", "grace.williams@flowforge.local", UserRole.EMPLOYEE, "Administration", False),
]

DEMO_WORKFLOWS = [
    {
        "name": "Purchase Request",
        "category": "Procurement",
        "description": "Route purchase requests through manager, amount-based director review, finance approval, and procurement fulfilment.",
        "nodes": [
            ("start", WorkflowNodeType.START, "Start", {"description": "Employee starts a purchase request."}, 0, 120),
            (
                "purchase_form",
                WorkflowNodeType.FORM,
                "Purchase Form",
                {
                    "fields": [
                        {"label": "Item Name", "field_key": "item_name", "type": "text", "required": True},
                        {"label": "Quantity", "field_key": "quantity", "type": "number", "required": True, "minimum": 1},
                        {"label": "Estimated Amount", "field_key": "amount", "type": "currency", "required": True},
                        {"label": "Reason", "field_key": "reason", "type": "textarea", "required": True},
                        {"label": "Required Date", "field_key": "required_date", "type": "date", "required": True},
                    ]
                },
                240,
                120,
            ),
            (
                "manager_approval",
                WorkflowNodeType.APPROVAL,
                "Manager Approval",
                {"assigned_role": UserRole.MANAGER.value, "instructions": "Confirm business need and budget fit."},
                500,
                120,
            ),
            (
                "amount_check",
                WorkflowNodeType.CONDITION,
                "Amount Check",
                {"field": "amount", "operator": "greater_than", "value": 10000},
                760,
                120,
            ),
            (
                "director_approval",
                WorkflowNodeType.APPROVAL,
                "Director Approval",
                {"assigned_role": UserRole.ADMINISTRATOR.value, "instructions": "Review high-value spend."},
                1020,
                20,
            ),
            (
                "finance_approval",
                WorkflowNodeType.APPROVAL,
                "Finance Approval",
                {"assigned_role": UserRole.MANAGER.value, "instructions": "Validate funds and accounting treatment."},
                1280,
                120,
            ),
            (
                "procurement_task",
                WorkflowNodeType.TASK,
                "Procurement Task",
                {"assigned_role": UserRole.MANAGER.value, "description": "Source vendor and prepare purchase order."},
                1540,
                120,
            ),
            (
                "approved_notification",
                WorkflowNodeType.NOTIFICATION,
                "Approval Notification",
                {"title": "Purchase Request Approved", "message": "Your request has moved to procurement."},
                1800,
                120,
            ),
            ("end", WorkflowNodeType.END, "Completed", {"result": "COMPLETED"}, 2060, 120),
        ],
        "edges": [
            ("start", "purchase_form", WorkflowEdgeType.DEFAULT, None),
            ("purchase_form", "manager_approval", WorkflowEdgeType.DEFAULT, None),
            ("manager_approval", "amount_check", WorkflowEdgeType.DEFAULT, None),
            ("amount_check", "director_approval", WorkflowEdgeType.TRUE, "TRUE"),
            ("director_approval", "finance_approval", WorkflowEdgeType.DEFAULT, None),
            ("amount_check", "finance_approval", WorkflowEdgeType.FALSE, "FALSE"),
            ("finance_approval", "procurement_task", WorkflowEdgeType.DEFAULT, None),
            ("procurement_task", "approved_notification", WorkflowEdgeType.DEFAULT, None),
            ("approved_notification", "end", WorkflowEdgeType.DEFAULT, None),
        ],
    },
    {
        "name": "Leave Request",
        "category": "Human Resources",
        "description": "Capture leave details and route them through manager and HR approval.",
        "nodes": [
            ("start", WorkflowNodeType.START, "Start", {}, 0, 120),
            (
                "leave_form",
                WorkflowNodeType.FORM,
                "Leave Form",
                {
                    "fields": [
                        {"label": "Leave Type", "field_key": "leave_type", "type": "dropdown", "required": True, "options": ["Annual", "Sick", "Family Responsibility"]},
                        {"label": "Start Date", "field_key": "start_date", "type": "date", "required": True},
                        {"label": "End Date", "field_key": "end_date", "type": "date", "required": True},
                        {"label": "Reason", "field_key": "reason", "type": "textarea", "required": True},
                    ]
                },
                240,
                120,
            ),
            ("manager_approval", WorkflowNodeType.APPROVAL, "Manager Approval", {"assigned_role": UserRole.MANAGER.value}, 500, 120),
            ("hr_approval", WorkflowNodeType.APPROVAL, "HR Approval", {"assigned_role": UserRole.MANAGER.value}, 760, 120),
            ("notification", WorkflowNodeType.NOTIFICATION, "Leave Notification", {"title": "Leave Request Completed"}, 1020, 120),
            ("end", WorkflowNodeType.END, "Completed", {"result": "COMPLETED"}, 1280, 120),
        ],
        "edges": [
            ("start", "leave_form", WorkflowEdgeType.DEFAULT, None),
            ("leave_form", "manager_approval", WorkflowEdgeType.DEFAULT, None),
            ("manager_approval", "hr_approval", WorkflowEdgeType.DEFAULT, None),
            ("hr_approval", "notification", WorkflowEdgeType.DEFAULT, None),
            ("notification", "end", WorkflowEdgeType.DEFAULT, None),
        ],
    },
    {
        "name": "IT Access Request",
        "category": "Information Technology",
        "description": "Request system access, route approval, and create IT fulfilment tasks.",
        "nodes": [
            ("start", WorkflowNodeType.START, "Start", {}, 0, 120),
            (
                "access_form",
                WorkflowNodeType.FORM,
                "Access Request Form",
                {
                    "fields": [
                        {"label": "System Required", "field_key": "system", "type": "text", "required": True},
                        {"label": "Access Level", "field_key": "access_level", "type": "dropdown", "required": True, "options": ["Read", "Standard", "Administrator"]},
                        {"label": "Business Reason", "field_key": "business_reason", "type": "textarea", "required": True},
                        {"label": "Required Date", "field_key": "required_date", "type": "date", "required": True},
                    ]
                },
                240,
                120,
            ),
            ("manager_approval", WorkflowNodeType.APPROVAL, "Manager Approval", {"assigned_role": UserRole.MANAGER.value}, 500, 120),
            ("it_review", WorkflowNodeType.TASK, "IT Review Task", {"assigned_role": UserRole.MANAGER.value}, 760, 120),
            ("account_setup", WorkflowNodeType.TASK, "Account Setup Task", {"assigned_role": UserRole.MANAGER.value}, 1020, 120),
            ("notification", WorkflowNodeType.NOTIFICATION, "Access Notification", {"title": "IT Access Ready"}, 1280, 120),
            ("end", WorkflowNodeType.END, "Completed", {"result": "COMPLETED"}, 1540, 120),
        ],
        "edges": [
            ("start", "access_form", WorkflowEdgeType.DEFAULT, None),
            ("access_form", "manager_approval", WorkflowEdgeType.DEFAULT, None),
            ("manager_approval", "it_review", WorkflowEdgeType.DEFAULT, None),
            ("it_review", "account_setup", WorkflowEdgeType.DEFAULT, None),
            ("account_setup", "notification", WorkflowEdgeType.DEFAULT, None),
            ("notification", "end", WorkflowEdgeType.DEFAULT, None),
        ],
    },
    {
        "name": "Equipment Request",
        "category": "Operations",
        "description": "Request equipment, route operational review, and assign fulfilment work.",
        "nodes": [
            ("start", WorkflowNodeType.START, "Start", {}, 0, 120),
            (
                "equipment_form",
                WorkflowNodeType.FORM,
                "Equipment Request Form",
                {
                    "fields": [
                        {"label": "Equipment Type", "field_key": "equipment_type", "type": "text", "required": True},
                        {"label": "Quantity", "field_key": "quantity", "type": "number", "required": True, "minimum": 1},
                        {"label": "Reason", "field_key": "reason", "type": "textarea", "required": True},
                        {"label": "Required Date", "field_key": "required_date", "type": "date", "required": True},
                    ]
                },
                240,
                120,
            ),
            ("manager_approval", WorkflowNodeType.APPROVAL, "Manager Approval", {"assigned_role": UserRole.MANAGER.value}, 500, 120),
            ("operations_review", WorkflowNodeType.APPROVAL, "Operations Review", {"assigned_role": UserRole.MANAGER.value}, 760, 120),
            ("assignment_task", WorkflowNodeType.TASK, "Equipment Assignment Task", {"assigned_role": UserRole.MANAGER.value}, 1020, 120),
            ("notification", WorkflowNodeType.NOTIFICATION, "Equipment Notification", {"title": "Equipment Request Completed"}, 1280, 120),
            ("end", WorkflowNodeType.END, "Completed", {"result": "COMPLETED"}, 1540, 120),
        ],
        "edges": [
            ("start", "equipment_form", WorkflowEdgeType.DEFAULT, None),
            ("equipment_form", "manager_approval", WorkflowEdgeType.DEFAULT, None),
            ("manager_approval", "operations_review", WorkflowEdgeType.DEFAULT, None),
            ("operations_review", "assignment_task", WorkflowEdgeType.DEFAULT, None),
            ("assignment_task", "notification", WorkflowEdgeType.DEFAULT, None),
            ("notification", "end", WorkflowEdgeType.DEFAULT, None),
        ],
    },
]

DEMO_INSTANCE_BLUEPRINTS = [
    {
        "workflow": "Purchase Request",
        "requester": "employee@flowforge.local",
        "outcome": "complete",
        "days_back": 35,
        "data": {
            "item_name": "Ergonomic chairs",
            "quantity": 6,
            "amount": 8400,
            "reason": "Operations team seating refresh.",
            "required_date": "2026-10-10",
        },
    },
    {
        "workflow": "Purchase Request",
        "requester": "naledi.khumalo@flowforge.local",
        "outcome": "complete",
        "days_back": 30,
        "data": {
            "item_name": "Finance laptops",
            "quantity": 4,
            "amount": 42000,
            "reason": "Quarter-end reporting workstation upgrades.",
            "required_date": "2026-10-18",
        },
    },
    {
        "workflow": "Purchase Request",
        "requester": "amara.okafor@flowforge.local",
        "outcome": "open_task",
        "days_back": 9,
        "data": {
            "item_name": "Barcode scanners",
            "quantity": 3,
            "amount": 9600,
            "reason": "Procurement receiving pilot.",
            "required_date": "2026-10-22",
        },
    },
    {
        "workflow": "Purchase Request",
        "requester": "marcus.reed@flowforge.local",
        "outcome": "pending_approval",
        "days_back": 2,
        "data": {
            "item_name": "Workshop supplies",
            "quantity": 12,
            "amount": 3100,
            "reason": "Operations readiness kit.",
            "required_date": "2026-10-04",
        },
    },
    {
        "workflow": "Purchase Request",
        "requester": "karabo.molefe@flowforge.local",
        "outcome": "rejected",
        "days_back": 21,
        "data": {
            "item_name": "Event staging",
            "quantity": 1,
            "amount": 18000,
            "reason": "Unbudgeted staff event request.",
            "required_date": "2026-09-28",
        },
    },
    {
        "workflow": "Leave Request",
        "requester": "owen.brooks@flowforge.local",
        "outcome": "complete",
        "days_back": 25,
        "data": {
            "leave_type": "Annual",
            "start_date": "2026-10-03",
            "end_date": "2026-10-07",
            "reason": "Family travel.",
        },
    },
    {
        "workflow": "Leave Request",
        "requester": "employee@flowforge.local",
        "outcome": "changes_requested",
        "days_back": 12,
        "data": {
            "leave_type": "Family Responsibility",
            "start_date": "2026-09-25",
            "end_date": "2026-09-27",
            "reason": "Supporting a family appointment.",
        },
    },
    {
        "workflow": "Leave Request",
        "requester": "theo.jacobs@flowforge.local",
        "outcome": "pending_approval",
        "days_back": 1,
        "data": {
            "leave_type": "Sick",
            "start_date": "2026-09-16",
            "end_date": "2026-09-17",
            "reason": "Medical recovery.",
        },
    },
    {
        "workflow": "Leave Request",
        "requester": "karabo.molefe@flowforge.local",
        "outcome": "rejected",
        "days_back": 18,
        "data": {
            "leave_type": "Annual",
            "start_date": "2026-09-29",
            "end_date": "2026-10-10",
            "reason": "Peak operations period conflict.",
        },
    },
    {
        "workflow": "IT Access Request",
        "requester": "naledi.khumalo@flowforge.local",
        "outcome": "complete",
        "days_back": 28,
        "data": {
            "system": "Budget Planning",
            "access_level": "Standard",
            "business_reason": "Own monthly variance reporting.",
            "required_date": "2026-10-01",
        },
    },
    {
        "workflow": "IT Access Request",
        "requester": "marcus.reed@flowforge.local",
        "outcome": "task_in_progress",
        "days_back": 7,
        "data": {
            "system": "Warehouse Console",
            "access_level": "Read",
            "business_reason": "Monitor dispatch readiness.",
            "required_date": "2026-09-29",
        },
    },
    {
        "workflow": "IT Access Request",
        "requester": "amara.okafor@flowforge.local",
        "outcome": "open_task",
        "days_back": 4,
        "data": {
            "system": "Vendor Portal",
            "access_level": "Standard",
            "business_reason": "Onboard two approved suppliers.",
            "required_date": "2026-09-30",
        },
    },
    {
        "workflow": "IT Access Request",
        "requester": "owen.brooks@flowforge.local",
        "outcome": "pending_approval",
        "days_back": 3,
        "data": {
            "system": "HR Case Desk",
            "access_level": "Administrator",
            "business_reason": "Cover escalations while HR lead travels.",
            "required_date": "2026-10-02",
        },
    },
    {
        "workflow": "IT Access Request",
        "requester": "employee@flowforge.local",
        "outcome": "rejected",
        "days_back": 16,
        "data": {
            "system": "Production Database",
            "access_level": "Administrator",
            "business_reason": "Troubleshoot one report.",
            "required_date": "2026-09-26",
        },
    },
    {
        "workflow": "Equipment Request",
        "requester": "marcus.reed@flowforge.local",
        "outcome": "complete",
        "days_back": 32,
        "data": {
            "equipment_type": "Safety headsets",
            "quantity": 10,
            "reason": "Warehouse floor communication.",
            "required_date": "2026-09-27",
        },
    },
    {
        "workflow": "Equipment Request",
        "requester": "karabo.molefe@flowforge.local",
        "outcome": "open_task",
        "days_back": 6,
        "data": {
            "equipment_type": "Portable label printers",
            "quantity": 2,
            "reason": "Improve asset tagging turnaround.",
            "required_date": "2026-10-05",
        },
    },
    {
        "workflow": "Equipment Request",
        "requester": "theo.jacobs@flowforge.local",
        "outcome": "pending_approval",
        "days_back": 2,
        "data": {
            "equipment_type": "Conference room display",
            "quantity": 1,
            "reason": "Executive briefing space refresh.",
            "required_date": "2026-10-12",
        },
    },
    {
        "workflow": "Equipment Request",
        "requester": "employee@flowforge.local",
        "outcome": "changes_requested",
        "days_back": 14,
        "data": {
            "equipment_type": "Network cabinet",
            "quantity": 1,
            "reason": "Needs location and asset owner confirmation.",
            "required_date": "2026-09-30",
        },
    },
    {
        "workflow": "Equipment Request",
        "requester": "amara.okafor@flowforge.local",
        "outcome": "rejected",
        "days_back": 23,
        "data": {
            "equipment_type": "Demo booth kit",
            "quantity": 3,
            "reason": "Not aligned to current procurement policy.",
            "required_date": "2026-09-24",
        },
    },
    {
        "workflow": "Purchase Request",
        "requester": "theo.jacobs@flowforge.local",
        "outcome": "complete",
        "days_back": 42,
        "data": {
            "item_name": "Board pack printing",
            "quantity": 40,
            "amount": 5200,
            "reason": "Executive office monthly board meeting.",
            "required_date": "2026-09-20",
        },
    },
    {
        "workflow": "Leave Request",
        "requester": "naledi.khumalo@flowforge.local",
        "outcome": "complete",
        "days_back": 47,
        "data": {
            "leave_type": "Annual",
            "start_date": "2026-09-18",
            "end_date": "2026-09-20",
            "reason": "Long weekend break.",
        },
    },
    {
        "workflow": "IT Access Request",
        "requester": "theo.jacobs@flowforge.local",
        "outcome": "complete",
        "days_back": 52,
        "data": {
            "system": "Board Portal",
            "access_level": "Read",
            "business_reason": "Prepare executive meeting packs.",
            "required_date": "2026-09-15",
        },
    },
]


def seed_departments(db: Session) -> dict[str, Department]:
    departments: dict[str, Department] = {}
    for name, description in DEPARTMENTS:
        department = db.scalar(select(Department).where(Department.name == name))
        if department is None:
            department = Department(name=name, description=description)
            db.add(department)
            db.flush()
        else:
            department.description = description
        departments[name] = department
    return departments


def seed_users(db: Session, departments: dict[str, Department]) -> None:
    demo_password_hash = get_password_hash(DEMO_PASSWORD)
    for full_name, email, role, department_name, active in DEMO_USERS:
        user = db.scalar(select(User).where(User.email == email))
        department = departments[department_name]
        if user is None:
            user = User(
                full_name=full_name,
                email=email,
                password_hash=demo_password_hash,
                role=role,
                department_id=department.id,
                active=active,
            )
            db.add(user)
        else:
            user.full_name = full_name
            user.role = role
            user.department_id = department.id
            user.active = active
            user.password_hash = demo_password_hash


def seed_workflows(db: Session) -> None:
    creator = db.scalar(select(User).where(User.email == "designer@flowforge.local"))
    if creator is None:
        return

    for definition in DEMO_WORKFLOWS:
        workflow = db.scalar(select(Workflow).where(Workflow.name == definition["name"]))
        if workflow is None:
            workflow = Workflow(
                name=definition["name"],
                description=definition["description"],
                category=definition["category"],
                status=WorkflowStatus.PUBLISHED,
                created_by=creator.id,
            )
            db.add(workflow)
        else:
            workflow.description = definition["description"]
            workflow.category = definition["category"]

        if workflow.versions:
            continue

        version = WorkflowVersion(version_number=1, published_at=utc_now())
        version.nodes.extend(
            WorkflowNode(
                node_key=node_key,
                node_type=node_type,
                title=title,
                configuration_json=configuration,
                position_x=position_x,
                position_y=position_y,
            )
            for node_key, node_type, title, configuration, position_x, position_y in definition["nodes"]
        )
        version.edges.extend(
            WorkflowEdge(
                source_node_key=source,
                target_node_key=target,
                edge_type=edge_type,
                label=label,
            )
            for source, target, edge_type, label in definition["edges"]
        )
        workflow.versions.append(version)


def user_by_email(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise RuntimeError(f"Seed user missing: {email}")
    return user


def workflow_by_name(db: Session, name: str) -> Workflow:
    workflow = db.scalar(select(Workflow).where(Workflow.name == name))
    if workflow is None:
        raise RuntimeError(f"Seed workflow missing: {name}")
    return workflow


def pending_approval(instance: WorkflowInstance) -> Approval | None:
    return next(
        (
            approval
            for approval in instance.approvals
            if approval.status == ApprovalStatus.PENDING
        ),
        None,
    )


def open_task(instance: WorkflowInstance) -> Task | None:
    return next(
        (
            task
            for task in instance.tasks
            if task.status in {TaskStatus.PENDING, TaskStatus.IN_PROGRESS}
        ),
        None,
    )


def approval_actor(approval: Approval, users: dict[str, User]) -> User:
    if approval.assigned_user_id:
        return next(
            user for user in users.values() if user.id == approval.assigned_user_id
        )
    if approval.assigned_role == UserRole.ADMINISTRATOR.value:
        return users["admin"]
    return users["manager"]


def task_actor(task: Task, users: dict[str, User]) -> User:
    if task.assigned_user_id:
        return next(user for user in users.values() if user.id == task.assigned_user_id)
    if task.assigned_role == UserRole.ADMINISTRATOR.value:
        return users["admin"]
    return users["manager"]


def record_workflow_completion_if_needed(
    db: Session,
    actor: User,
    instance: WorkflowInstance,
) -> None:
    if instance.status in {
        WorkflowInstanceStatus.COMPLETED,
        WorkflowInstanceStatus.REJECTED,
        WorkflowInstanceStatus.CANCELLED,
    }:
        record_audit_log(
            db,
            actor,
            f"WORKFLOW_{instance.status.value}",
            "WorkflowInstance",
            instance.reference_number,
            f"{instance.reference_number} reached {instance.status.value}.",
        )


def backdate_instance(instance: WorkflowInstance, days_back: int) -> None:
    delta = timedelta(days=days_back)
    for item in [instance, *instance.approvals, *instance.tasks, *instance.events]:
        for attribute in (
            "created_at",
            "updated_at",
            "started_at",
            "responded_at",
            "completed_at",
            "due_date",
        ):
            value = getattr(item, attribute, None)
            if value is not None:
                setattr(item, attribute, value - delta)


def seed_demo_instances(db: Session) -> None:
    existing_count = db.scalar(select(func.count(WorkflowInstance.id))) or 0
    target_count = 22
    if existing_count >= target_count:
        return

    users = {
        "admin": user_by_email(db, "admin@flowforge.local"),
        "manager": user_by_email(db, "manager@flowforge.local"),
    }
    users.update(
        {
            email: user_by_email(db, email)
            for _, email, _, _, active in DEMO_USERS
            if active
        }
    )
    workflows = {
        definition["name"]: workflow_by_name(db, definition["name"])
        for definition in DEMO_WORKFLOWS
    }
    engine = WorkflowEngine(db)
    needed = target_count - existing_count

    for blueprint in DEMO_INSTANCE_BLUEPRINTS[:needed]:
        requester = users[blueprint["requester"]]
        workflow = workflows[blueprint["workflow"]]
        instance = engine.start_workflow(
            workflow.id,
            requester,
            blueprint["data"],
        )
        record_audit_log(
            db,
            requester,
            "WORKFLOW_STARTED",
            "WorkflowInstance",
            instance.reference_number,
            f"{requester.full_name} started {instance.reference_number}.",
        )

        outcome = blueprint["outcome"]
        final_actor = requester
        for _ in range(12):
            approval = pending_approval(instance)
            if approval is not None:
                actor = approval_actor(approval, users)
                final_actor = actor
                if outcome == "pending_approval":
                    break
                if outcome == "changes_requested":
                    instance = engine.handle_approval(
                        approval.id,
                        actor,
                        ApprovalStatus.CHANGES_REQUESTED,
                        "Please clarify the business justification.",
                    )
                    record_audit_log(
                        db,
                        actor,
                        "CHANGES_REQUESTED",
                        "Approval",
                        approval.id,
                        f"{actor.full_name} requested changes on {instance.reference_number}.",
                    )
                    break
                if outcome == "rejected":
                    instance = engine.handle_approval(
                        approval.id,
                        actor,
                        ApprovalStatus.REJECTED,
                        "Not aligned to the current operating plan.",
                    )
                    record_audit_log(
                        db,
                        actor,
                        "APPROVAL_REJECTED",
                        "Approval",
                        approval.id,
                        f"{actor.full_name} rejected {instance.reference_number}.",
                    )
                    break

                instance = engine.handle_approval(
                    approval.id,
                    actor,
                    ApprovalStatus.APPROVED,
                    "Approved for the demo workflow path.",
                )
                record_audit_log(
                    db,
                    actor,
                    "APPROVAL_APPROVED",
                    "Approval",
                    approval.id,
                    f"{actor.full_name} approved {instance.reference_number}.",
                )
                continue

            task = open_task(instance)
            if task is not None:
                actor = task_actor(task, users)
                final_actor = actor
                if outcome == "open_task":
                    break
                if task.status == TaskStatus.PENDING:
                    instance = engine.handle_task_start(task.id, actor)
                    record_audit_log(
                        db,
                        actor,
                        "TASK_STARTED",
                        "Task",
                        task.id,
                        f"{actor.full_name} started a task for {instance.reference_number}.",
                    )
                    if outcome == "task_in_progress":
                        break
                    task = open_task(instance)
                    if task is None:
                        break

                instance = engine.handle_task_completion(
                    task.id,
                    actor,
                    "Completed as part of seeded demo activity.",
                )
                record_audit_log(
                    db,
                    actor,
                    "TASK_COMPLETED",
                    "Task",
                    task.id,
                    f"{actor.full_name} completed a task for {instance.reference_number}.",
                )
                continue

            break

        record_workflow_completion_if_needed(db, final_actor, instance)
        backdate_instance(instance, int(blueprint["days_back"]))

    db.flush()
    notifications = db.scalars(select(Notification).order_by(Notification.id)).all()
    for index, notification in enumerate(notifications):
        notification.is_read = index % 3 == 0


def seed_demo_audit_baseline(db: Session) -> None:
    existing_count = db.scalar(select(func.count(AuditLog.id))) or 0
    if existing_count > 0:
        return

    actor = user_by_email(db, "admin@flowforge.local")
    for workflow in db.scalars(select(Workflow).order_by(Workflow.name)).all():
        record_audit_log(
            db,
            actor,
            "WORKFLOW_PUBLISHED",
            "Workflow",
            workflow.id,
            f"Seeded published workflow {workflow.name}.",
        )


def seed_demo_data(db: Session, include_demo_activity: bool = True) -> None:
    departments = seed_departments(db)
    seed_users(db, departments)
    db.flush()
    seed_workflows(db)
    if include_demo_activity:
        seed_demo_audit_baseline(db)
        seed_demo_instances(db)
    db.commit()


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_demo_data(db)
        print("FlowForge demo accounts and departments seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
