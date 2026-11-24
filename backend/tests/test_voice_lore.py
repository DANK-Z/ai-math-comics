import io
import json
import wave
from contextlib import asynccontextmanager
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from test_accounts import auth, generate_comic, student
from test_accounts import env as env

from app import item_lore, voice
from app.config import Settings
from app.main import create_app


@pytest.mark.parametrize(
    ("transcript", "lang", "kind", "answer"),
    [
        ("Икс равен двенадцати.", "ru", "equation", "x = 12"),
        ("икс он екіге тең", "kk", "equation", "x = 12"),
        ("икс 12-ге тең", "kk", "equation", "x = 12"),
        ("Жауабым: икс мәні он екіге тең.", "kk", "equation", "x = 12"),
        ("Х = 12", "ru", "equation", "х = 12"),
        ("екі жүз жиырма бес", "kk", "equation", "x = 225"),
        ("минус шесть", "ru", "equation", "x = -6"),
        ("три четвертых", "ru", "fraction", "3/4"),
        ("төрттен үш", "kk", "fraction", "3/4"),
        ("3/4", "kk", "fraction", "3/4"),
        ("икс плюс два", "ru", "equation", None),
        ("он екі үш", "kk", "equation", None),
        ("12/0", "ru", "fraction", None),
    ],
)
def test_spoken_math_normalization(transcript, lang, kind, answer):
    assert voice.spoken_answer(transcript, lang, kind) == answer


def test_voice_checks_audio_and_preserves_language(tmp_path, monkeypatch):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as stream:
        stream.setparams((1, 2, 16000, 0, "NONE", ""))
        stream.writeframes(b"\0" * 16000)
    model = tmp_path / "model"
    model.mkdir()
    for filename in voice.MODEL_FILES:
        (model / filename).touch()
    calls = []

    def recognize(path, samples, lang):
        calls.append((path, len(samples), lang))
        return "икс он екіге тең" if lang == "kk" else "неразборчиво"

    monkeypatch.setattr(voice, "transcribe", recognize)
    headers = {"Content-Type": "audio/wav"}
    with TestClient(create_app(Settings(data_dir=tmp_path, voice_model=model))) as client:
        assert client.get("/api/voice").json() == {"enabled": True}
        assert client.post(
            "/api/voice/kk?kind=equation",
            content=buffer.getvalue(),
            headers=headers,
        ).json() == {"answer": "x = 12"}
        assert client.post(
            "/api/voice/ru?kind=equation",
            content=buffer.getvalue(),
            headers=headers,
        ).json() == {"detail": "voice_unclear"}
        for data, status in ((b"broken", 422), (bytes(voice.MAX_BYTES + 1), 413)):
            assert (
                client.post(
                    "/api/voice/kk?kind=equation",
                    content=data,
                    headers=headers,
                ).status_code
                == status
            )
        assert client.post("/api/voice/kk?kind=equation", content=b"broken").status_code == 415
        (model / "tokenizer.json").unlink()
        assert client.get("/api/voice").json() == {"enabled": False}
    assert calls == [(model, 16000, "kk"), (model, 16000, "ru")]


def test_lore_uses_private_records_and_caches_by_locale(env, monkeypatch):
    settings, client = env
    client.app.state.settings = replace(settings, api_key="demo-placeholder-for-test")
    learner = auth(student(client, "voice_lore", "Айдана"))
    other = auth(student(client, "second_demo", "Жанар"))
    received = []

    class LoreProvider:
        async def generate(self, prompt, schema):
            received.append(json.loads(prompt))
            return {
                "story": "Мастер ярмарки спрятал под стеклом узор, который виден в сумерках."
                if received[-1]["language"] == "ru"
                else "Жәрмеңке шебері әйнекке кешкі жарықта көрінетін өрнек салған."
            }

    @asynccontextmanager
    async def providers(_):
        yield LoreProvider(), None

    monkeypatch.setattr(item_lore, "configured_providers", providers)
    _, rounds = generate_comic(settings, client)
    for exercise, value in rounds:
        body = {"answer": str(value), "lang": "ru"}
        for _ in range(2):  # A duplicate success never increases the combo.
            answer = client.post(f"/api/exercises/{exercise}/check", json=body, headers=learner)
            assert answer.json()["status"] == "correct"
    assert (
        client.post(
            "/api/v1/shop/buy",
            json={"itemId": "smart-glasses"},
            headers=learner,
        ).status_code
        == 201
    )
    url = "/api/v1/items/smart-glasses/lore"
    assert client.post(url).status_code == 401
    result = client.post(url, headers=learner).json()
    assert result["source"] == "generated"
    assert result["student"] == "Айдана" and result["owned"]
    assert result["victoryAt"] and result["acquiredAt"] and result["perfect"]
    assert result["combo"] == 3
    assert client.post(url, headers=learner).json() == result
    assert client.post(url + "?lang=kk", headers=learner).json()["story"] != result["story"]
    separate = client.post(url, headers=other).json()
    assert separate["student"] == "Жанар" and not separate["owned"] and not separate["victoryAt"]
    assert len(received) == 3
    assert received[0]["theme"] == "precision"
    assert all(set(prompt) == {"item", "language", "theme", "task"} for prompt in received)
    assert (
        client.post("/api/v1/items/collectible-pizza-token/lore", headers=other).status_code == 404
    )
    client.app.state.settings = replace(settings, api_key="")
    result = client.post("/api/v1/items/racer-helmet/lore", headers=other).json()
    assert result["source"] == "prepared" and not result["owned"]
