def auth_headers(client, email="designer@flowforge.local"):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Demo123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def executable_definition(comment_required=True):
    nodes = [
        {
            "node_key": "start",
            "node_type": "START",
            "title": "Start",
            "configuration_json": {},
            "position_x": 0,
            "position_y": 100,
        },
        {
            "node_key": "request_form",
            "node_type": "FORM",
            "title": "Request Form",
            "configuration_json": {
                "fields": [
                    {
                        "label": "Request Summary",
                        "field_key": "summary",
                        "type": "text",
                        "required": True,
                    }
                ]
            },
            "position_x": 260,
            "position_y": 100,
        },
        {
            "node_key": "manager_approval",
            "node_type": "APPROVAL",
            "title": "Manager Approval",
            "configuration_json": {
                "assigned_role": "MANAGER",
                "comment_required_on_rejection": comment_required,
            },
            "position_x": 520,
            "position_y": 100,
        },
        {
            "node_key": "end",
            "node_type": "END",
            "title": "Completed",
            "configuration_json": {"result": "COMPLETED"},
            "position_x": 780,
            "position_y": 100,
        },
    ]
    edges = [
        {
            "source_node_key": "start",
            "target_node_key": "request_form",
            "edge_type": "DEFAULT",
            "label": None,
        },
        {
            "source_node_key": "request_form",
            "target_node_key": "manager_approval",
            "edge_type": "DEFAULT",
            "label": None,
        },
        {
            "source_node_key": "manager_approval",
            "target_node_key": "end",
            "edge_type": "DEFAULT",
            "label": None,
        },
    ]
    return nodes, edges


def create_published_executable_workflow(client, name="Document Approval"):
    nodes, edges = executable_definition()
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": name,
            "category": "Administration",
            "description": "A simple executable workflow for Phase 6.",
            "nodes": nodes,
            "edges": edges,
        },
    )
    assert created.status_code == 201
    published = client.post(
        f"/api/workflows/{created.json()['id']}/publish",
        headers=auth_headers(client),
    )
    assert published.status_code == 200
    return published.json()


def start_instance(client, workflow_id):
    return client.post(
        f"/api/workflows/{workflow_id}/start",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={"submitted_data_json": {"summary": "Please review this request."}},
    )


def test_employee_starts_workflow_and_it_pauses_at_approval(client):
    workflow = create_published_executable_workflow(client)

    response = start_instance(client, workflow["id"])

    assert response.status_code == 201
    body = response.json()
    assert body["reference_number"].startswith("DA-")
    assert body["status"] == "WAITING_FOR_APPROVAL"
    assert body["current_node_key"] == "manager_approval"
    assert body["current_stage_title"] == "Manager Approval"
    assert body["submitted_data_json"]["summary"] == "Please review this request."
    assert body["approvals"][0]["status"] == "PENDING"
    assert body["approvals"][0]["assigned_role"] == "MANAGER"
    assert [event["event_type"] for event in body["events"]] == [
        "START_COMPLETED",
        "FORM_SUBMITTED",
        "APPROVAL_WAITING",
    ]


def test_missing_required_form_data_is_rejected(client):
    workflow = create_published_executable_workflow(client, "Required Field Workflow")

    response = client.post(
        f"/api/workflows/{workflow['id']}/start",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={"submitted_data_json": {}},
    )

    assert response.status_code == 422
    assert "Request Summary" in response.json()["detail"]


def test_manager_can_approve_and_complete_workflow(client):
    workflow = create_published_executable_workflow(client, "Manager Completion Workflow")
    started = start_instance(client, workflow["id"]).json()
    approval_id = started["approvals"][0]["id"]

    response = client.post(
        f"/api/approvals/{approval_id}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Approved for processing."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert body["current_stage_title"] == "Completed"
    assert body["completed_at"] is not None
    assert body["approvals"][0]["status"] == "APPROVED"
    assert "APPROVAL_APPROVED" in [event["event_type"] for event in body["events"]]
    assert "WORKFLOW_COMPLETED" in [event["event_type"] for event in body["events"]]


def test_employee_cannot_approve_manager_approval(client):
    workflow = create_published_executable_workflow(client, "Manager Only Approval")
    started = start_instance(client, workflow["id"]).json()
    approval_id = started["approvals"][0]["id"]

    response = client.post(
        f"/api/approvals/{approval_id}/approve",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={"comments": "Trying to approve."},
    )

    assert response.status_code == 403


def test_rejection_requires_comments_when_configured(client):
    workflow = create_published_executable_workflow(client, "Comment Required Rejection")
    started = start_instance(client, workflow["id"]).json()
    approval_id = started["approvals"][0]["id"]

    missing_comment = client.post(
        f"/api/approvals/{approval_id}/reject",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={},
    )
    rejected = client.post(
        f"/api/approvals/{approval_id}/reject",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Budget not approved."},
    )

    assert missing_comment.status_code == 400
    assert "Comments are required" in missing_comment.json()["detail"]
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    assert rejected.json()["completed_at"] is not None


def test_instances_and_approvals_are_visible_to_relevant_users(client):
    workflow = create_published_executable_workflow(client, "Visibility Workflow")
    started = start_instance(client, workflow["id"]).json()

    employee_instances = client.get(
        "/api/instances",
        headers=auth_headers(client, "employee@flowforge.local"),
    )
    manager_approvals = client.get(
        "/api/approvals",
        headers=auth_headers(client, "manager@flowforge.local"),
    )

    assert employee_instances.status_code == 200
    assert any(instance["id"] == started["id"] for instance in employee_instances.json())
    assert manager_approvals.status_code == 200
    assert any(approval["id"] == started["approvals"][0]["id"] for approval in manager_approvals.json())


def find_workflow(client, name):
    response = client.get("/api/workflows", headers=auth_headers(client))
    assert response.status_code == 200
    return next(workflow for workflow in response.json() if workflow["name"] == name)


def approval_for_node(instance, node_key):
    return next(
        approval
        for approval in instance["approvals"]
        if approval["node_key"] == node_key and approval["status"] == "PENDING"
    )


def task_for_node(instance, node_key):
    return next(
        task
        for task in instance["tasks"]
        if task["node_key"] == node_key and task["status"] in {"PENDING", "IN_PROGRESS"}
    )


def start_purchase_request(client, amount):
    workflow = find_workflow(client, "Purchase Request")
    return client.post(
        f"/api/workflows/{workflow['id']}/start",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={
            "submitted_data_json": {
                "item_name": "Laptop dock",
                "quantity": 2,
                "amount": amount,
                "reason": "Hybrid workspace equipment.",
                "required_date": "2026-10-15",
            }
        },
    )


def test_purchase_request_true_branch_reaches_task_notification_and_completion(client):
    started = start_purchase_request(client, 15000)

    assert started.status_code == 201
    instance = started.json()
    assert instance["status"] == "WAITING_FOR_APPROVAL"
    assert instance["current_node_key"] == "manager_approval"

    manager_approval = approval_for_node(instance, "manager_approval")
    after_manager = client.post(
        f"/api/approvals/{manager_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Business need confirmed."},
    )

    assert after_manager.status_code == 200
    instance = after_manager.json()
    assert instance["status"] == "WAITING_FOR_APPROVAL"
    assert instance["current_node_key"] == "director_approval"

    director_approval = approval_for_node(instance, "director_approval")
    after_director = client.post(
        f"/api/approvals/{director_approval['id']}/approve",
        headers=auth_headers(client, "admin@flowforge.local"),
        json={"comments": "High-value spend approved."},
    )

    assert after_director.status_code == 200
    instance = after_director.json()
    assert instance["status"] == "WAITING_FOR_APPROVAL"
    assert instance["current_node_key"] == "finance_approval"

    finance_approval = approval_for_node(instance, "finance_approval")
    after_finance = client.post(
        f"/api/approvals/{finance_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Budget available."},
    )

    assert after_finance.status_code == 200
    instance = after_finance.json()
    assert instance["status"] == "WAITING_FOR_TASK"
    assert instance["current_node_key"] == "procurement_task"

    task = task_for_node(instance, "procurement_task")
    started_task = client.post(
        f"/api/tasks/{task['id']}/start",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={},
    )
    completed_task = client.post(
        f"/api/tasks/{task['id']}/complete",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Purchase order has been prepared."},
    )

    assert started_task.status_code == 200
    assert completed_task.status_code == 200
    instance = completed_task.json()
    assert instance["status"] == "COMPLETED"
    assert instance["completed_at"] is not None
    assert any(task["status"] == "COMPLETED" for task in instance["tasks"])
    assert any(
        task["comments"] == "Purchase order has been prepared."
        for task in instance["tasks"]
    )

    notifications = client.get(
        "/api/notifications",
        headers=auth_headers(client, "employee@flowforge.local"),
    )
    event_types = [event["event_type"] for event in instance["events"]]

    assert notifications.status_code == 200
    assert any(notification["title"] == "Purchase Request Approved" for notification in notifications.json())
    assert "CONDITION_EVALUATED" in event_types
    assert "TASK_WAITING" in event_types
    assert "TASK_STARTED" in event_types
    assert "TASK_COMPLETED" in event_types
    assert "NOTIFICATION_CREATED" in event_types
    assert "WORKFLOW_COMPLETED" in event_types


def test_purchase_request_false_branch_skips_director_approval(client):
    started = start_purchase_request(client, 9000)
    instance = started.json()
    manager_approval = approval_for_node(instance, "manager_approval")

    after_manager = client.post(
        f"/api/approvals/{manager_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Within department limit."},
    )

    assert after_manager.status_code == 200
    instance = after_manager.json()
    assert instance["status"] == "WAITING_FOR_APPROVAL"
    assert instance["current_node_key"] == "finance_approval"
    assert all(approval["node_key"] != "director_approval" for approval in instance["approvals"])


def test_employee_cannot_complete_manager_task(client):
    started = start_purchase_request(client, 9000)
    instance = started.json()
    manager_approval = approval_for_node(instance, "manager_approval")
    instance = client.post(
        f"/api/approvals/{manager_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Approved."},
    ).json()
    finance_approval = approval_for_node(instance, "finance_approval")
    instance = client.post(
        f"/api/approvals/{finance_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Approved."},
    ).json()
    task = task_for_node(instance, "procurement_task")

    response = client.post(
        f"/api/tasks/{task['id']}/complete",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={},
    )

    assert response.status_code == 403


def test_task_assignee_can_view_task_backed_instance(client):
    nodes = [
        {
            "node_key": "start",
            "node_type": "START",
            "title": "Start",
            "configuration_json": {},
            "position_x": 0,
            "position_y": 100,
        },
        {
            "node_key": "request_form",
            "node_type": "FORM",
            "title": "Request Form",
            "configuration_json": {
                "fields": [
                    {
                        "label": "Summary",
                        "field_key": "summary",
                        "type": "text",
                        "required": True,
                    }
                ]
            },
            "position_x": 260,
            "position_y": 100,
        },
        {
            "node_key": "manager_task",
            "node_type": "TASK",
            "title": "Manager Task",
            "configuration_json": {"assigned_role": "MANAGER"},
            "position_x": 520,
            "position_y": 100,
        },
        {
            "node_key": "end",
            "node_type": "END",
            "title": "Completed",
            "configuration_json": {"result": "COMPLETED"},
            "position_x": 780,
            "position_y": 100,
        },
    ]
    edges = [
        {
            "source_node_key": "start",
            "target_node_key": "request_form",
            "edge_type": "DEFAULT",
            "label": None,
        },
        {
            "source_node_key": "request_form",
            "target_node_key": "manager_task",
            "edge_type": "DEFAULT",
            "label": None,
        },
        {
            "source_node_key": "manager_task",
            "target_node_key": "end",
            "edge_type": "DEFAULT",
            "label": None,
        },
    ]
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Task Visibility Workflow",
            "category": "Operations",
            "description": "A task-only executable workflow.",
            "nodes": nodes,
            "edges": edges,
        },
    )
    published = client.post(
        f"/api/workflows/{created.json()['id']}/publish",
        headers=auth_headers(client),
    ).json()
    started = client.post(
        f"/api/workflows/{published['id']}/start",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={"submitted_data_json": {"summary": "Prepare the handoff."}},
    ).json()

    manager_instances = client.get(
        "/api/instances",
        headers=auth_headers(client, "manager@flowforge.local"),
    )

    assert manager_instances.status_code == 200
    assert any(instance["id"] == started["id"] for instance in manager_instances.json())


def test_notification_read_endpoints_are_scoped_to_current_user(client):
    started = start_purchase_request(client, 9000)
    instance = started.json()
    manager_approval = approval_for_node(instance, "manager_approval")
    instance = client.post(
        f"/api/approvals/{manager_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Approved."},
    ).json()
    finance_approval = approval_for_node(instance, "finance_approval")
    instance = client.post(
        f"/api/approvals/{finance_approval['id']}/approve",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={"comments": "Approved."},
    ).json()
    task = task_for_node(instance, "procurement_task")
    client.post(
        f"/api/tasks/{task['id']}/complete",
        headers=auth_headers(client, "manager@flowforge.local"),
        json={},
    )

    employee_notifications = client.get(
        "/api/notifications",
        headers=auth_headers(client, "employee@flowforge.local"),
    ).json()
    notification_id = employee_notifications[0]["id"]

    denied = client.post(
        f"/api/notifications/{notification_id}/read",
        headers=auth_headers(client, "manager@flowforge.local"),
    )
    read = client.post(
        f"/api/notifications/{notification_id}/read",
        headers=auth_headers(client, "employee@flowforge.local"),
    )
    read_all = client.post(
        "/api/notifications/read-all",
        headers=auth_headers(client, "employee@flowforge.local"),
    )

    assert denied.status_code == 404
    assert read.status_code == 200
    assert read.json()["is_read"] is True
    assert all(notification["is_read"] for notification in read_all.json())
