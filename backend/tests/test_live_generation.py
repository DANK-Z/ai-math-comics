"""Opt-in paid verification; the default test suite is completely offline."""

import io
import os
import subprocess
import sys
from fractions import Fraction

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import BACKEND_DIR, Settings
from app.main import create_app
from app.storage import Store


@pytest.mark.skipif(os.getenv("RUN_LIVE_GENERATION") != "1", reason="Live generation is opt-in")
def test_live_generation(tmp_path):
    configured = Settings.from_env()
    key = configured.gemini_api_key if configured.provider == "gemini" else configured.api_key
    if not key.strip():
        pytest.skip(f"No API key configured for {configured.provider}")
    from dataclasses import replace

    settings = replace(configured, data_dir=tmp_path, public_base_url="http://testserver")
    with TestClient(create_app(settings)) as api:
        response = api.post(
            "/api/comic-jobs",
            json={
                "grade": 6,
                "topic": "fractions",
                "lang": "kk",
                "difficulty": "intermediate",
            },
        )
        assert response.status_code == 202
        job_id = response.json()["jobId"]
    # Run the actual consumer in a separate process with a real HTTP client.
    process = subprocess.run(
        [sys.executable, "-m", "app.worker", "--once"],
        cwd=BACKEND_DIR,
        env=dict(os.environ) | {"COMIC_DATA_DIR": str(tmp_path)},
        capture_output=True,
        text=True,
        timeout=settings.job_timeout + 60,
    )
    assert process.returncode == 0, "Worker process exited unsuccessfully"
    with TestClient(create_app(settings)) as api:
        status = api.get(f"/api/comic-jobs/{job_id}").json()
        assert status["status"] == "ready", status
        for lang in ("ru", "kk"):
            response = api.get(f"/api/comics/{status['comicId']}?lang={lang}")
            assert response.status_code == 200
            comic = response.json()
            assert len(comic["panels"]) == 6
            for panel in comic["panels"]:
                image = api.get(panel["imageUrl"])
                assert image.status_code == 200
                Image.open(io.BytesIO(image.content)).verify()
            exercise_id = comic["exercise"]["id"]
            expected = Fraction(Store(tmp_path).exercise(exercise_id)["expected"])
            assert (
                api.post(
                    f"/api/exercises/{exercise_id}/check",
                    json={
                        "answer": f"{expected.numerator}/{expected.denominator}",
                        "lang": lang,
                    },
                ).json()["status"]
                == "correct"
            )
            for step in (1, 2):
                hint = api.get(f"/api/exercises/{exercise_id}/hints?lang={lang}&step={step}")
                assert hint.status_code == 200
                assert hint.json()["hasMore"] == (step == 1)
    print(f"Verified real generation {status['comicId']}; artifacts: {tmp_path}")
