"""Daily comic generation limits and sign-up rate limits (the site is public)."""

import pytest
from fastapi.testclient import TestClient
from test_accounts import EQUATIONS, auth, student, teacher

from app.config import Settings
from app.main import create_app


@pytest.fixture
def limited(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        art_mode="prepared",
        public_base_url="http://testserver",
        jwt_secret="test-secret-" + "x" * 32,
        generation_daily_total=6,
        generation_daily_student=2,
        generation_daily_teacher=3,
        generation_daily_guest=1,
    )
    with TestClient(create_app(settings)) as client:
        yield client


def generate(client, token=None):
    return client.post("/api/comic-jobs", json=EQUATIONS, headers=auth(token) if token else {})


def test_generation_limits_per_guest_student_and_site(limited):
    client = limited
    assert generate(client).status_code == 202
    blocked = generate(client)
    assert blocked.status_code == 429 and blocked.json()["detail"] == "generation_limit"
    assert int(blocked.headers["Retry-After"]) > 0

    aruna = student(client, "aruna", "Аруна")
    assert [generate(client, aruna).status_code for _ in range(3)] == [202, 202, 429]
    # Another student has their own allowance; the site-wide cap stops everyone at 6.
    dana = student(client, "dana", "Дана")
    teacher_token = teacher(client)
    assert generate(client, dana).status_code == 202  # 4th of the site
    assert generate(client, dana).status_code == 202  # 5th
    assert generate(client, teacher_token).status_code == 202  # 6th
    assert generate(client, teacher_token).status_code == 429  # site cap


def test_continuations_count_too(limited):
    body = {
        "sourceChapterId": "school-quest-map",
        "choiceId": "library-cabinet-key",
        "locale": "ru",
    }
    assert limited.post("/api/continuation-jobs", json=body).status_code == 202
    assert limited.post("/api/continuation-jobs", json=body).status_code == 429


def test_sign_up_is_rate_limited(limited):
    body = {"login": "spam", "password": "student-pass", "displayName": "Спам"}
    codes = [limited.post("/api/auth/students", json=body).status_code for _ in range(9)]
    assert codes[0] == 201 and set(codes[1:8]) == {409} and codes[8] == 429


def test_guests_cannot_generate_on_the_public_site(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        art_mode="prepared",
        public_base_url="http://testserver",
        jwt_secret="test-secret-" + "x" * 32,
        generation_guests=False,
    )
    with TestClient(create_app(settings)) as client:
        refused = generate(client)
        assert refused.status_code == 401 and refused.json()["detail"] == "sign_in_to_create"
        assert generate(client, student(client, "aruna", "Аруна")).status_code == 202


def test_family_plan_gives_children_more_comics(tmp_path):
    from test_billing import linked

    settings = Settings(
        data_dir=tmp_path,
        art_mode="prepared",
        public_base_url="http://testserver",
        jwt_secret="test-secret-" + "x" * 32,
        generation_daily_student=1,
    )
    with TestClient(create_app(settings)) as client:
        aruna, mama, _ = linked(client)
        assert [generate(client, aruna).status_code for _ in range(2)] == [202, 429]
        client.post("/api/parent/billing/plan", json={"plan": "family"}, headers=auth(mama))
        assert [generate(client, aruna).status_code for _ in range(3)] == [202, 202, 429]
