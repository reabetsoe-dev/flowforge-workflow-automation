def test_login_returns_jwt_and_user(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@flowforge.local", "password": "Demo123!"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["role"] == "ADMINISTRATOR"


def test_me_requires_valid_token(client):
    login = client.post(
        "/api/auth/login",
        json={"email": "employee@flowforge.local", "password": "Demo123!"},
    )
    token = login.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "employee@flowforge.local"


def test_login_rejects_invalid_credentials(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@flowforge.local", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_dashboard_summary_is_protected(client):
    response = client.get("/api/dashboard/summary")

    assert response.status_code == 401


def test_dashboard_summary_returns_seeded_counts(client):
    login = client.post(
        "/api/auth/login",
        json={"email": "auditor@flowforge.local", "password": "Demo123!"},
    )
    token = login.json()["access_token"]

    response = client.get(
        "/api/dashboard/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["active_users"] >= 5
    assert body["departments"] == 7
    assert body["demo_accounts"] == 5
    assert body["published_workflows"] == 4
