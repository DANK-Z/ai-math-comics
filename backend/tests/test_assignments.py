"""Teacher generation, editing, class-scoped delivery and learning analytics."""

import asyncio
from contextlib import asynccontextmanager

import pytest
from test_accounts import auth, make_class, student, teacher
from test_accounts import env as env
from test_generation import DeterministicImages
from test_my_story import REQUEST, StoryText

from app import assignments
from app.providers import ProviderError
from app.storage import Store
from app.worker import Worker


def test_teacher_draft_to_class_results(env):
    settings, client = env
    owner = auth(teacher(client))
    outsider = auth(teacher(client, email="other@school.kz"))
    classroom = make_class(client, owner["Authorization"].split()[1])
    other_class = make_class(client, outsider["Authorization"].split()[1], letter="Б")
    helped = auth(student(client, "with_help", "Арман", classroom["code"]))
    solo = auth(student(client, "alone", "Айдана", classroom["code"]))
    outside = auth(student(client, "outside", "Аружан", other_class["code"]))
    assert client.post("/api/teacher/comic-drafts", json=REQUEST, headers=helped).status_code == 403

    created = client.post("/api/teacher/comic-drafts", json=REQUEST, headers=owner)
    assert created.status_code == 202
    job_id = created.json()["jobId"]
    assert client.get(f"/api/comic-jobs/{job_id}", headers=outsider).status_code == 404
    assert client.get("/api/teacher/comic-drafts", headers=outsider).json() == []
    store = Store(settings.data_dir)
    assert asyncio.run(Worker(store, StoryText(), DeterministicImages(), settings).run_once())
    job = client.get(f"/api/comic-jobs/{job_id}", headers=owner).json()
    assert job["status"] == "ready"
    draft_id = job["comicId"]
    endpoint = f"/api/teacher/comic-drafts/{draft_id}"
    assert client.get(endpoint, headers=outsider).status_code == 404
    assert client.get(f"/api/comics/{draft_id}").status_code == 404
    raw_image = f"/api/comic-images/{draft_id}/1.png"
    assert client.get(raw_image).status_code == 404
    draft = client.get(endpoint, headers=owner).json()
    assert client.get(draft["ru"]["panels"][0]["imageUrl"]).status_code == 200
    orig_exercise = draft["ru"]["exercise"]["id"]
    assert client.get(f"/api/exercises/{orig_exercise}/hints").status_code == 404
    assert (
        client.post(
            f"/api/exercises/{orig_exercise}/check",
            json={"answer": draft["task"]["answer"]},
        ).status_code
        == 404
    )
    assert client.get("/api/me/assigned-comics", headers=helped).json() == []

    payload = {
        "classId": classroom["id"],
        "dueDate": "2027-01-20",
        "task": {
            "boss": "x-master",
            "answer": "x = 5",
            "ru": {"prompt": "Реши 2x + 5 = 15", "hint1": "Вычти слагаемое", "hint2": "Раздели"},
            "kk": {"prompt": "2x + 5 = 15 шеш", "hint1": "Қосылғышты азайт", "hint2": "Бөл"},
        },
        "ru": {"title": "Тайна класса", "panels": ["Реплика героя"] * 6},
        "kk": {"title": "Сынып құпиясы", "panels": ["Кейіпкер сөзі"] * 6},
    }
    publish = endpoint + "/publish"
    assert client.post(publish, headers=outsider, json=payload).status_code == 404
    assert (
        client.post(
            publish,
            headers=owner,
            json=payload | {"classId": other_class["id"]},
        ).status_code
        == 404
    )
    invalid = payload | {"task": payload["task"] | {"answer": "sqrt(25)"}}
    assert client.post(publish, headers=owner, json=invalid).json() == {
        "detail": "invalid_teacher_answer",
    }
    created = client.post(publish, headers=owner, json=payload)
    assert created.status_code == 201
    assignment = created.json()
    assert client.post(publish, headers=owner, json=payload).json() == assignment
    comic_id = assignment["id"]
    assert comic_id != draft_id
    assert client.get("/api/me/assigned-comics", headers=outside).json() == []
    assert client.get(
        "/api/me/assigned-comics?lang=kk",
        headers=helped,
    ).json() == [assignment | {"title": "Сынып құпиясы"}]
    url = f"/api/comics/{comic_id}"
    assert client.get(url).status_code == 404
    assert client.get(url, headers=outside).status_code == 404
    comic = client.get(url + "?lang=kk", headers=helped).json()
    assert len(comic["panels"]) == 6
    assert comic["panels"][0]["text"] == "Кейіпкер сөзі"
    assert "expected" not in comic
    assert comic["boss"]["kind"] == "x-master"
    exercise = comic["exercise"]["id"]
    assert len(comic["boss"]["rounds"]) == 1
    check = f"/api/exercises/{exercise}/check"
    hints = f"/api/exercises/{exercise}/hints"
    assert client.post(check, headers=outside, json={"answer": "5"}).status_code == 404
    assert client.get(hints, headers=outside).status_code == 404
    assert client.post(check, headers=helped, json={"answer": "4"}).json()["status"] == "incorrect"
    assert client.get(hints + "?lang=kk", headers=helped).json()["text"] == "Қосылғышты азайт"
    assert client.get(hints + "?step=2", headers=helped).json()["text"] == "Раздели"
    assert client.get(hints, headers=helped).status_code == 200
    win = client.post(check, headers=helped, json={"answer": "х = 5", "lang": "kk"}).json()
    assert win["status"] == "correct" and win["reward"]["coins"] > 0
    repeated = client.post(check, headers=helped, json={"answer": "5,0"}).json()
    assert repeated["status"] == "correct" and "reward" not in repeated
    assert client.post(check, headers=solo, json={"answer": "10/2"}).json()["status"] == "correct"
    assert client.get(hints, headers=solo).status_code == 200  # after victory
    assert client.get(f"/api/me/boss/{comic_id}", headers=helped).json()["cleared"] == 1
    assert client.get("/api/me/assigned-comics", headers=helped).json()[0]["completed"] is True
    report = f"/api/teacher/classes/{classroom['id']}/assigned-comics"
    assert client.get(report, headers=outsider).status_code == 404
    rows = client.get(report, headers=owner).json()[0]["students"]
    assert {row["name"]: (row["completed"], row["hints"]) for row in rows} == {
        "Арман": (True, [1, 2]),
        "Айдана": (True, []),
    }


@pytest.mark.parametrize("failure", [None, "numeral", "provider_unavailable"])
def test_ai_task_uses_server_math_and_validates_model_hints(env, monkeypatch, failure):
    _, client = env
    owner = auth(teacher(client))

    class Hints:
        async def generate(self, prompt, schema):
            if failure == "provider_unavailable":
                raise ProviderError("provider_unavailable")
            assert "answer" not in prompt
            return {
                "choice": 1,
                "ruHint1": "Вычти известное слагаемое.",
                "ruHint2": "Раздели на множитель." if not failure else "Ответ пять.",
                "kkHint1": "Белгілі қосылғышты азайт.",
                "kkHint2": "Мәнді көбейткішке бөл.",
            }

    @asynccontextmanager
    async def provider(_):
        yield Hints(), None

    monkeypatch.setattr(assignments, "configured_providers", provider)
    monkeypatch.setattr(
        assignments,
        "choose_problem",
        lambda _: assignments.EquationProblem(
            "mul_add",
            2,
            5,
            15,
        ),
    )
    response = client.post(
        "/api/teacher/comic-task",
        headers=owner,
        json={
            "grade": 5,
            "topic": "equations",
            "lang": "ru",
            "difficulty": "advanced",
        },
    )
    if failure:
        assert response.status_code == 502
        assert response.json()["detail"] == (
            "invalid_provider_output" if failure == "numeral" else failure
        )
    else:
        task = response.json()
        assert task["answer"] == "5" and "2 · x + 5 = 15" in task["kk"]["prompt"]
        assert task["ru"]["hint2"] == "Раздели на множитель."
    assert len(client.get("/api/teacher/problem-bank", headers=owner).json()) == 2
