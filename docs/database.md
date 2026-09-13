# Database

FlowForge stores workflow definitions, immutable versions, execution state, notifications, and audit records in SQLAlchemy models.

```mermaid
erDiagram
    Department ||--o{ User : contains
    User ||--o{ Workflow : creates
    Workflow ||--o{ WorkflowVersion : versions
    WorkflowVersion ||--o{ WorkflowNode : contains
    WorkflowVersion ||--o{ WorkflowEdge : connects
    Workflow ||--o{ WorkflowInstance : executes
    WorkflowVersion ||--o{ WorkflowInstance : locks
    User ||--o{ WorkflowInstance : starts
    WorkflowInstance ||--o{ Approval : creates
    WorkflowInstance ||--o{ Task : creates
    WorkflowInstance ||--o{ WorkflowEvent : records
    User ||--o{ Notification : receives
    User ||--o{ AuditLog : performs
```

## Versioning

Published workflow versions are immutable. Editing a published workflow creates a new draft version. Existing workflow instances continue to use the version they started with. New instances use the newest published version.

## Execution State

`WorkflowInstance` stores the current node, current status, submitted form data, and timestamps. `Approval`, `Task`, and `Notification` rows represent human work and internal messages created during execution.

## History

`WorkflowEvent` powers request timelines and bottleneck analytics. `AuditLog` records user-visible system actions such as login, workflow publishing, request starts, approval decisions, and task completion.
