"""Panels are drawn a few at a time; progress still advances in panel order."""

import asyncio
from dataclasses import replace

from fastapi.testclient import TestClient
from test_generation import REQUEST, DeterministicImages, DeterministicText

from app.config import Settings
from app.main import create_app
from app.storage import Store
from app.worker import Worker


def test_panels_are_drawn_in_parallel_up_to_the_limit(tmp_path):
    settings = replace(Settings(data_dir=tmp_path), image_concurrency=3)
    api = TestClient(create_app(settings))
    store = Store(tmp_path)
    job_id = api.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    progress = []
    saved = store.panel_saved

    def watch(claim, panel_id):
        progress.append(panel_id)
        saved(claim, panel_id)

    store.panel_saved = watch

    class CountingImages(DeterministicImages):
        running = 0
        peak = 0

        async def generate(self, prompt, reference=None):
            CountingImages.running += 1
            CountingImages.peak = max(CountingImages.peak, CountingImages.running)
            # Later panels finish first: progress must still be recorded in order.
            await asyncio.sleep(0.05 / (len(self.calls) + 1))
            try:
                return await super().generate(prompt, reference)
            finally:
                CountingImages.running -= 1

    images = CountingImages()
    assert asyncio.run(Worker(store, DeterministicText(), images, settings).run_once())
    job = api.get(f"/api/comic-jobs/{job_id}").json()
    assert job["status"] == "ready", job
    assert CountingImages.peak == 3
    assert progress == [1, 2, 3, 4, 5, 6]
