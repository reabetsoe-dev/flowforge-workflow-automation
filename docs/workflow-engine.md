# Workflow Engine

The workflow engine lives in `backend/app/services/workflow_engine.py`. Routes call the engine; they do not implement graph traversal directly.

## Node Types

- `START`: starts execution
- `FORM`: validates submitted data against configured required fields
- `APPROVAL`: creates an approval and pauses
- `CONDITION`: evaluates a structured rule and follows TRUE or FALSE
- `TASK`: creates a human task and pauses
- `NOTIFICATION`: creates internal notification records and continues
- `END`: completes, rejects, or cancels the instance

## Pause And Resume

When execution reaches an approval or task, the instance is stored with a waiting status. Later API calls load that same instance and resume execution from the database state. This is safe for Vercel serverless functions because no workflow state is kept in memory.

## Conditions

Condition nodes use structured JSON only. They do not execute arbitrary Python or JavaScript.

Supported operators:

- `equals`
- `not_equals`
- `greater_than`
- `greater_than_or_equal`
- `less_than`
- `less_than_or_equal`
- `contains`

## Validation

Before publishing, FlowForge checks graph structure, start/end nodes, missing assignments, condition branches, invalid edges, and unreachable nodes.

## Events

Every significant transition creates a `WorkflowEvent`. These events are used by the request timeline and analytics bottleneck calculations.
