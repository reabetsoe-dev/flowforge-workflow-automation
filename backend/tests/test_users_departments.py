def auth_headers(client, email="admin@flowforge.local"):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Demo123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_list_users_with_departments(client):
    response = client.get("/api/users", headers=auth_headers(client))

    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 15
    assert users[0]["department_name"]


def test_non_admin_cannot_manage_users(client):
    response = client.get(
        "/api/users",
        headers=auth_headers(client, "manager@flowforge.local"),
    )

    assert response.status_code == 403


def test_admin_can_create_and_deactivate_user(client):
    departments = client.get("/api/departments", headers=auth_headers(client)).json()
    department_id = next(item["id"] for item in departments if item["name"] == "Operations")

    created = client.post(
        "/api/users",
        headers=auth_headers(client),
        json={
            "full_name": "Casey Morgan",
            "email": "casey.morgan@flowforge.local",
            "password": "Demo123!",
            "role": "EMPLOYEE",
            "department_id": department_id,
            "active": True,
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["email"] == "casey.morgan@flowforge.local"
    assert body["department_name"] == "Operations"

    updated = client.put(
        f"/api/users/{body['id']}",
        headers=auth_headers(client),
        json={"active": False},
    )

    assert updated.status_code == 200
    assert updated.json()["active"] is False


def test_admin_cannot_create_duplicate_email(client):
    response = client.post(
        "/api/users",
        headers=auth_headers(client),
        json={
            "full_name": "Duplicate Admin",
            "email": "admin@flowforge.local",
            "password": "Demo123!",
            "role": "EMPLOYEE",
            "department_id": None,
            "active": True,
        },
    )

    assert response.status_code == 409


def test_authenticated_users_can_read_departments(client):
    response = client.get(
        "/api/departments",
        headers=auth_headers(client, "employee@flowforge.local"),
    )

    assert response.status_code == 200
    assert len(response.json()) == 7


def test_only_admin_can_create_department(client):
    denied = client.post(
        "/api/departments",
        headers=auth_headers(client, "auditor@flowforge.local"),
        json={"name": "Legal", "description": "Contract review and policy support."},
    )

    assert denied.status_code == 403

    created = client.post(
        "/api/departments",
        headers=auth_headers(client),
        json={"name": "Legal", "description": "Contract review and policy support."},
    )

    assert created.status_code == 201
    assert created.json()["name"] == "Legal"


def test_admin_can_update_department(client):
    departments = client.get("/api/departments", headers=auth_headers(client)).json()
    department_id = next(item["id"] for item in departments if item["name"] == "Administration")

    response = client.put(
        f"/api/departments/{department_id}",
        headers=auth_headers(client),
        json={"description": "Executive support, office services, and operational coordination."},
    )

    assert response.status_code == 200
    assert "Executive support" in response.json()["description"]
