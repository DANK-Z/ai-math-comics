import asyncio
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from fastapi.testclient import TestClient
from test_generation import REQUEST, DeterministicImages, DeterministicText

from app.config import Settings
from app.main import create_app
from app.storage import Store
from app.story import LIVE_SCENES, image_prompt
from app.worker import Worker


def test_resume_live_job_uses_saved_story_and_only_missing_panels(tmp_path):
    settings = Settings(data_dir=tmp_path)
    api = TestClient(create_app(settings))
    store = Store(tmp_path)
    job_id = api.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    job_url = f"/api/comic-jobs/{job_id}"
    resume_url = f"{job_url}/resume"
    assert api.post(resume_url, json={"resumeToken": str(uuid4())}).status_code == 409

    class DelayedImages(DeterministicImages):
        async def generate(self, prompt, reference=None):
            await asyncio.sleep(0.01)
            return await super().generate(prompt, reference)

    class UnexpectedText:
        async def generate(self, *_):
            raise AssertionError("Resuming must reuse the validated storyboard")

    text = DeterministicText()
    first = DelayedImages(fail_at=5)
    assert asyncio.run(Worker(store, text, first, settings).run_once())
    failed = api.get(job_url).json()
    assert failed["status"] == "failed"
    assert failed["progress"] == {"stage": "drawing", "completedPanels": 4, "totalPanels": 6}
    assert [prompt for prompt, _ in first.calls] == [
        image_prompt(scene) for scene in LIVE_SCENES[:5]
    ]
    assert len(text.calls) == 1
    directory = next(store.images_dir.iterdir())
    saved = {panel.name: panel.read_bytes() for panel in directory.glob("*.png")}
    assert set(saved) == {"1.png", "2.png", "3.png", "4.png"}
    assert api.get(f"/api/comic-images/{directory.name}/1.png").status_code == 404

    resume_body = {"resumeToken": failed["resumeToken"]}
    with ThreadPoolExecutor(max_workers=2) as clicks:
        responses = list(clicks.map(lambda _: api.post(resume_url, json=resume_body), range(2)))
    for response in responses:
        assert response.status_code == 202
        assert response.json()["jobId"] == job_id
        assert response.json()["progress"] == failed["progress"]

    # A later failed attempt has its own token. A delayed duplicate of the first
    # request cannot start it again.
    second = DelayedImages(fail_at=1)
    assert asyncio.run(Worker(Store(tmp_path), UnexpectedText(), second, settings).run_once())
    again = api.get(job_url).json()
    assert again["resumeToken"] != resume_body["resumeToken"]
    assert api.post(resume_url, json=resume_body).status_code == 409
    assert store.job(job_id).status == "failed"
    assert api.post(resume_url, json={"resumeToken": again["resumeToken"]}).status_code == 202

    async def finish():
        successful = DelayedImages()
        competing = DelayedImages()
        results = await asyncio.gather(
            Worker(Store(tmp_path), UnexpectedText(), successful, settings).run_once(),
            Worker(Store(tmp_path), UnexpectedText(), competing, settings).run_once(),
        )
        assert sum(results) == 1
        assert [prompt for prompt, _ in successful.calls + competing.calls] == [
            image_prompt(scene) for scene in LIVE_SCENES[4:]
        ]

    asyncio.run(finish())
    ready = api.get(job_url).json()
    assert ready["status"] == "ready" and ready["comicId"] == directory.name
    assert ready["progress"] == {"stage": "ready", "completedPanels": 6, "totalPanels": 6}
    assert "resumeToken" not in ready
    assert api.post(resume_url, json={"resumeToken": again["resumeToken"]}).status_code == 202
    assert store.claim(60) is None
    for name, content in saved.items():
        assert (directory / name).read_bytes() == content
    for lang in ("ru", "kk"):
        comic = api.get(f"/api/comics/{directory.name}?lang={lang}").json()
        assert len(comic["panels"]) == 6
        for panel in comic["panels"]:
            assert api.get(panel["imageUrl"]).status_code == 200
