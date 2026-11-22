import asyncio
import sqlite3

from fastapi.testclient import TestClient
from test_generation import REQUEST, DeterministicImages, DeterministicText

from app.config import Settings
from app.main import create_app
from app.worker import Worker


def test_saved_panels_advance_progress_and_publish_together(tmp_path, monkeypatch):
    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)
    api = TestClient(app)
    store = app.state.store
    job_id = api.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    job_url = f"/api/comic-jobs/{job_id}"

    def status():
        return api.get(job_url).json()

    async def run():
        story_requested = asyncio.Event()
        release_story = asyncio.Event()
        requested = asyncio.Queue()
        release_panel = asyncio.Semaphore(0)
        images = DeterministicImages()

        class DelayedText(DeterministicText):
            async def generate(self, prompt, schema):
                story_requested.set()
                await release_story.wait()
                return await super().generate(prompt, schema)

        class DelayedImages:
            async def generate(self, prompt, reference=None):
                await requested.put(len(images.calls) + 1)
                await release_panel.acquire()
                return await images.generate(prompt, reference)

        publish = store.publish

        def observe_publication(claim, comic_id, *args):
            assert status()["progress"] == {
                "stage": "drawing",
                "completedPanels": 6,
                "totalPanels": 6,
            }
            assert status()["status"] == "running"
            assert api.get(f"/api/comics/{comic_id}").status_code == 404
            publish(claim, comic_id, *args)

        monkeypatch.setattr(store, "publish", observe_publication)
        original_saved = store.panel_saved

        def record_twice(claim, panel_id):
            original_saved(claim, panel_id)
            original_saved(claim, panel_id)

        monkeypatch.setattr(store, "panel_saved", record_twice)
        worker = asyncio.create_task(
            Worker(store, DelayedText(), DelayedImages(), settings).run_once()
        )
        await story_requested.wait()
        assert status()["progress"] == {"stage": "storyboard"}
        release_story.set()
        for completed in range(6):
            assert await requested.get() == completed + 1
            assert status()["progress"] == {
                "stage": "drawing",
                "completedPanels": completed,
                "totalPanels": 6,
            }
            assert len(list(store.images_dir.glob("*/*.png"))) == completed
            release_panel.release()
        assert await worker

    asyncio.run(asyncio.wait_for(run(), timeout=15))
    job = status()
    assert job["status"] == "ready"
    assert job["progress"] == {"stage": "ready", "completedPanels": 6, "totalPanels": 6}
    assert api.get(f"/api/comics/{job['comicId']}").status_code == 200


def test_legacy_database_reads_jobs_without_progress(tmp_path):
    with sqlite3.connect(tmp_path / "comics.sqlite3") as db:
        db.executescript("""
            CREATE TABLE jobs (
                id TEXT PRIMARY KEY,
                request TEXT NOT NULL,
                problem TEXT NOT NULL,
                status TEXT NOT NULL,
                comic_id TEXT,
                error_code TEXT,
                owner TEXT,
                lease_expires REAL,
                created_at REAL NOT NULL
            );
            INSERT INTO jobs(id, request, problem, status, error_code, created_at)
            VALUES ('old', '{}', '{}', 'failed', 'provider_unavailable', 1);
        """)
    with TestClient(create_app(Settings(data_dir=tmp_path))) as api:
        assert api.get("/api/comic-jobs/old").json() == {
            "jobId": "old",
            "status": "failed",
            "comicId": None,
            "errorCode": "provider_unavailable",
        }
