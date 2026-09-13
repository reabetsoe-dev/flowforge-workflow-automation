from app.models.user import UserRole


def auth_headers(client, email="designer@flowforge.local"):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Demo123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def simple_definition():
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
            "node_key": "manager_approval",
            "node_type": "APPROVAL",
            "title": "Manager Approval",
            "configuration_json": {"assigned_role": UserRole.MANAGER.value},
            "position_x": 260,
            "position_y": 100,
        },
        {
            "node_key": "end",
            "node_type": "END",
            "title": "Completed",
            "configuration_json": {"result": "COMPLETED"},
            "position_x": 520,
            "position_y": 100,
        },
    ]
    edges = [
        {
            "source_node_key": "start",
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


def test_seeded_workflows_are_visible_to_authenticated_users(client):
    response = client.get(
        "/api/workflows",
        headers=auth_headers(client, "employee@flowforge.local"),
    )

    assert response.status_code == 200
    workflows = response.json()
    assert len(workflows) == 4
    assert {workflow["status"] for workflow in workflows} == {"PUBLISHED"}


def test_designer_can_create_workflow_with_default_definition(client):
    response = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Document Approval",
            "category": "Administration",
            "description": "Route an internal document for review.",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "DRAFT"
    assert body["latest_version"]["version_number"] == 1
    assert body["node_count"] == 2
    assert body["edge_count"] == 1


def test_employee_cannot_create_workflow(client):
    response = client.post(
        "/api/workflows",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={
            "name": "Unauthorized Workflow",
            "category": "Operations",
            "description": "Should not be created.",
        },
    )

    assert response.status_code == 403


def test_employee_cannot_see_draft_workflow(client):
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Draft Only Workflow",
            "category": "Operations",
            "description": "Hidden until published.",
        },
    )
    workflow_id = created.json()["id"]

    detail = client.get(
        f"/api/workflows/{workflow_id}",
        headers=auth_headers(client, "employee@flowforge.local"),
    )
    list_response = client.get(
        "/api/workflows",
        headers=auth_headers(client, "employee@flowforge.local"),
    )

    assert detail.status_code == 404
    assert all(item["id"] != workflow_id for item in list_response.json())


def test_workflow_validation_returns_clear_errors(client):
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
            "node_key": "amount_check",
            "node_type": "CONDITION",
            "title": "Amount Check",
            "configuration_json": {"field": "amount", "operator": "greater_than", "value": 10000},
            "position_x": 260,
            "position_y": 100,
        },
        {
            "node_key": "director_approval",
            "node_type": "APPROVAL",
            "title": "Director Approval",
            "configuration_json": {},
            "position_x": 520,
            "position_y": 100,
        },
        {
            "node_key": "end",
            "node_type": "END",
            "title": "Completed",
            "configuration_json": {},
            "position_x": 780,
            "position_y": 100,
        },
    ]
    edges = [
        {
            "source_node_key": "start",
            "target_node_key": "amount_check",
            "edge_type": "DEFAULT",
            "label": None,
        },
        {
            "source_node_key": "amount_check",
            "target_node_key": "director_approval",
            "edge_type": "TRUE",
            "label": "TRUE",
        },
        {
            "source_node_key": "director_approval",
            "target_node_key": "end",
            "edge_type": "DEFAULT",
            "label": None,
        },
    ]
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Invalid Approval Path",
            "category": "Finance",
            "description": "Missing assignment and condition branch.",
            "nodes": nodes,
            "edges": edges,
        },
    )

    response = client.post(
        f"/api/workflows/{created.json()['id']}/validate",
        headers=auth_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert "Amount Check is missing its FALSE path." in body["errors"]
    assert "Director Approval has no assigned role, user, or department." in body["errors"]


def test_designer_can_publish_valid_workflow(client):
    nodes, edges = simple_definition()
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Policy Exception",
            "category": "Administration",
            "description": "Request approval for a policy exception.",
            "nodes": nodes,
            "edges": edges,
        },
    )

    response = client.post(
        f"/api/workflows/{created.json()['id']}/publish",
        headers=auth_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "PUBLISHED"
    assert body["draft_version_number"] is None
    assert body["published_version_number"] == 1
    assert body["latest_version"]["published_at"] is not None


def test_editing_published_definition_creates_new_draft_version(client):
    nodes, edges = simple_definition()
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Published With Draft",
            "category": "Operations",
            "description": "Published workflow that receives a draft edit.",
            "nodes": nodes,
            "edges": edges,
        },
    )
    workflow_id = created.json()["id"]
    client.post(f"/api/workflows/{workflow_id}/publish", headers=auth_headers(client))

    updated_nodes = [
        {
            **node,
            "title": "Manager Review" if node["node_key"] == "manager_approval" else node["title"],
        }
        for node in nodes
    ]
    response = client.put(
        f"/api/workflows/{workflow_id}",
        headers=auth_headers(client),
        json={"nodes": updated_nodes, "edges": edges},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "PUBLISHED"
    assert body["version_count"] == 2
    assert body["published_version_number"] == 1
    assert body["draft_version_number"] == 2
    assert body["latest_version"]["version_number"] == 2


def test_employee_sees_published_version_when_new_draft_exists(client):
    nodes, edges = simple_definition()
    created = client.post(
        "/api/workflows",
        headers=auth_headers(client),
        json={
            "name": "Published Public Shape",
            "category": "Operations",
            "description": "Published workflow that receives a private draft edit.",
            "nodes": nodes,
            "edges": edges,
        },
    )
    workflow_id = created.json()["id"]
    client.post(f"/api/workflows/{workflow_id}/publish", headers=auth_headers(client))

    updated_nodes = [
        {
            **node,
            "title": "Private Draft Review" if node["node_key"] == "manager_approval" else node["title"],
        }
        for node in nodes
    ]
    client.put(
        f"/api/workflows/{workflow_id}",
        headers=auth_headers(client),
        json={"nodes": updated_nodes, "edges": edges},
    )

    detail = client.get(
        f"/api/workflows/{workflow_id}",
        headers=auth_headers(client, "employee@flowforge.local"),
    )
    list_response = client.get(
        "/api/workflows",
        headers=auth_headers(client, "employee@flowforge.local"),
    )

    assert detail.status_code == 200
    body = detail.json()
    assert body["latest_version"]["version_number"] == 1
    assert body["draft_version_number"] is None
    assert all(node["title"] != "Private Draft Review" for node in body["latest_version"]["nodes"])

    summary = next(item for item in list_response.json() if item["id"] == workflow_id)
    assert summary["latest_version_number"] == 1
    assert summary["draft_version_number"] is None
