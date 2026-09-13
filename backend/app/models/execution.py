import enum

from sqlalchemy import Boolean, JSON, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, utc_now


class WorkflowInstanceStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    WAITING_FOR_TASK = "WAITING_FOR_TASK"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    OVERDUE = "OVERDUE"


class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String(40), unique=True, index=True, nullable=False)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    workflow_version_id = Column(
        Integer,
        ForeignKey("workflow_versions.id"),
        nullable=False,
        index=True,
    )
    started_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    current_node_key = Column(String(80), nullable=True)
    status = Column(
        Enum(
            WorkflowInstanceStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
            native_enum=False,
        ),
        nullable=False,
        default=WorkflowInstanceStatus.RUNNING,
        index=True,
    )
    submitted_data_json = Column(JSON, nullable=False, default=dict)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow")
    workflow_version = relationship("WorkflowVersion")
    starter = relationship("User")
    approvals = relationship(
        "Approval",
        back_populates="workflow_instance",
        cascade="all, delete-orphan",
        order_by="Approval.created_at",
    )
    tasks = relationship(
        "Task",
        back_populates="workflow_instance",
        cascade="all, delete-orphan",
        order_by="Task.created_at",
    )
    events = relationship(
        "WorkflowEvent",
        back_populates="workflow_instance",
        cascade="all, delete-orphan",
        order_by="WorkflowEvent.created_at",
    )


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    workflow_instance_id = Column(
        Integer,
        ForeignKey("workflow_instances.id"),
        nullable=False,
        index=True,
    )
    node_key = Column(String(80), nullable=False, index=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_role = Column(String(80), nullable=True, index=True)
    status = Column(
        Enum(
            ApprovalStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
            native_enum=False,
        ),
        nullable=False,
        default=ApprovalStatus.PENDING,
        index=True,
    )
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    workflow_instance = relationship("WorkflowInstance", back_populates="approvals")
    assigned_user = relationship("User")


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id = Column(Integer, primary_key=True, index=True)
    workflow_instance_id = Column(
        Integer,
        ForeignKey("workflow_instances.id"),
        nullable=False,
        index=True,
    )
    node_key = Column(String(80), nullable=True, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    description = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    workflow_instance = relationship("WorkflowInstance", back_populates="events")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    workflow_instance_id = Column(
        Integer,
        ForeignKey("workflow_instances.id"),
        nullable=False,
        index=True,
    )
    node_key = Column(String(80), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_role = Column(String(80), nullable=True, index=True)
    status = Column(
        Enum(
            TaskStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
            native_enum=False,
        ),
        nullable=False,
        default=TaskStatus.PENDING,
        index=True,
    )
    due_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    workflow_instance = relationship("WorkflowInstance", back_populates="tasks")
    assigned_user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User")
