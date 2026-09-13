import enum

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, utc_now


class WorkflowStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class WorkflowNodeType(str, enum.Enum):
    START = "START"
    FORM = "FORM"
    APPROVAL = "APPROVAL"
    CONDITION = "CONDITION"
    TASK = "TASK"
    NOTIFICATION = "NOTIFICATION"
    END = "END"


class WorkflowEdgeType(str, enum.Enum):
    DEFAULT = "DEFAULT"
    TRUE = "TRUE"
    FALSE = "FALSE"


class Workflow(TimestampMixin, Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(80), nullable=False, index=True)
    status = Column(
        Enum(
            WorkflowStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
            native_enum=False,
        ),
        nullable=False,
        default=WorkflowStatus.DRAFT,
        index=True,
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    creator = relationship("User")
    versions = relationship(
        "WorkflowVersion",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowVersion.version_number",
    )


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow", back_populates="versions")
    nodes = relationship(
        "WorkflowNode",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="WorkflowNode.id",
    )
    edges = relationship(
        "WorkflowEdge",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="WorkflowEdge.id",
    )


class WorkflowNode(Base):
    __tablename__ = "workflow_nodes"

    id = Column(Integer, primary_key=True, index=True)
    workflow_version_id = Column(
        Integer,
        ForeignKey("workflow_versions.id"),
        nullable=False,
        index=True,
    )
    node_key = Column(String(80), nullable=False, index=True)
    node_type = Column(
        Enum(
            WorkflowNodeType,
            values_callable=lambda node_types: [node_type.value for node_type in node_types],
            native_enum=False,
        ),
        nullable=False,
    )
    title = Column(String(160), nullable=False)
    configuration_json = Column(JSON, nullable=False, default=dict)
    position_x = Column(Float, nullable=False, default=0)
    position_y = Column(Float, nullable=False, default=0)

    version = relationship("WorkflowVersion", back_populates="nodes")


class WorkflowEdge(Base):
    __tablename__ = "workflow_edges"

    id = Column(Integer, primary_key=True, index=True)
    workflow_version_id = Column(
        Integer,
        ForeignKey("workflow_versions.id"),
        nullable=False,
        index=True,
    )
    source_node_key = Column(String(80), nullable=False)
    target_node_key = Column(String(80), nullable=False)
    edge_type = Column(
        Enum(
            WorkflowEdgeType,
            values_callable=lambda edge_types: [edge_type.value for edge_type in edge_types],
            native_enum=False,
        ),
        nullable=False,
        default=WorkflowEdgeType.DEFAULT,
    )
    label = Column(String(80), nullable=True)

    version = relationship("WorkflowVersion", back_populates="edges")
