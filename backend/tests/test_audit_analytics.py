def auth_headers(client, email="auditor@flowforge.local"):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Demo123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def purchase_workflow_id(client):
    response = client.get(
        "/api/workflows",
        headers=auth_headers(client, "employee@flowforge.local"),
    )
    assert response.status_code == 200
    return next(workflow["id"] for workflow in response.json() if workflow["name"] == "Purchase Request")


def start_purchase_request(client):
    workflow_id = purchase_workflow_id(client)
    response = client.post(
        f"/api/workflows/{workflow_id}/start",
        headers=auth_headers(client, "employee@flowforge.local"),
        json={
            "submitted_data_json": {
                "item_name": "Test monitor",
                "quantity": 1,
                "amount": 9000,
                "reason": "Analytics test request.",
                "required_date": "2026-10-10",
            }
        },
    )
    assert response.status_code == 201
    return response.json()


def test_auditor_can_search_audit_logs(client):
    started = start_purchase_request(client)

    response = client.get(
        "/api/audit-logs?search=WORKFLOW_STARTED",
        headers=auth_headers(client),
    )

    assert response.status_code == 200
    assert any(log["entity_id"] == started["reference_number"] for log in response.json())


def test_manager_cannot_view_audit_logs(client):
    response = client.get(
        "/api/audit-logs",
        headers=auth_headers(client, "manager@flowforge.local"),
    )

    assert response.status_code == 403


def test_analytics_dashboard_uses_workflow_instances(client):
    start_purchase_request(client)

    response = client.get(
        "/api/analytics/dashboard",
        headers=auth_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_executions"] >= 1
    assert body["running"] >= 1
    assert body["requests_per_month"]
    assert any(point["label"] == "Purchase Request" for point in body["executions_by_workflow"])


def test_manager_cannot_view_analytics(client):
    response = client.get(
        "/api/analytics/dashboard",
        headers=auth_headers(client, "manager@flowforge.local"),
    )

    assert response.status_code == 403
