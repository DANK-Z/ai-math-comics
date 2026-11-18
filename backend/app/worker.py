"""Durable queue consumer. Run separately: python -m app.worker."""

import argparse
import asyncio
import json
import logging
from uuid import uuid4

import httpx
from pydantic import ValidationError

from .config import Settings
from .problems import Problem
from .providers import (
    ImageProvider,
    OpenAIHTTP,
    OpenAIImageProvider,
    OpenAITextProvider,
    ProviderError,
    TextProvider,
    normalize_png,
)
from .schemas import Comic, Exercise, JobRequest, Panel
from .storage import Store
from .story import Story, image_prompt, text_prompt, validate_story

logger = logging.getLogger(__name__)
SPEAKERS = {"mira": "Мира", "daniyar": "Данияр"}


class Worker:
    def __init__(self, store: Store, text: TextProvider, image: ImageProvider, settings: Settings):
        self.store = store
        self.text = text
        self.image = image
        self.settings = settings

    async def run_once(self) -> bool:
        claim = self.store.claim(self.settings.job_timeout + 30)
        if claim is None:
            return False
        comic_id = str(uuid4())
        directory = self.store.images_dir / comic_id
        published = False
        try:
            await asyncio.wait_for(
                self.generate(claim, comic_id), timeout=self.settings.job_timeout
            )
            published = True
        except asyncio.CancelledError:
            self.store.fail(claim, "worker_interrupted")
            raise
        except asyncio.TimeoutError:
            self.store.fail(claim, "job_timeout")
        except ProviderError as exc:
            self.store.fail(claim, exc.code)
        except Exception:
            # Do not log model output, API keys, upstream bodies, or private answers.
            self.store.fail(claim, "generation_failed")
        finally:
            if not published and directory.exists():
                # Only remove this attempt's known files; never recursively delete a data root.
                for index in range(1, 7):
                    (directory / f"{index}.png").unlink(missing_ok=True)
                    (directory / f"{index}.tmp").unlink(missing_ok=True)
                directory.rmdir()
        status = self.store.job(claim["id"])
        logger.info("Job %s: %s (%s)", claim["id"], status.status, status.errorCode)
        return True

    async def generate(self, claim: dict, comic_id: str):
        request = JobRequest.model_validate_json(claim["request"])
        problem = Problem.from_dict(json.loads(claim["problem"]))
        raw = await self.text.generate(text_prompt(request, problem), Story.model_json_schema())
        try:
            story = validate_story(raw, problem)
        except (ValidationError, ValueError, TypeError) as exc:
            raise ProviderError("invalid_provider_output") from exc

        directory = self.store.images_dir / comic_id
        directory.mkdir()
        reference = None
        for panel in story.ru.panels:
            image = normalize_png(await self.image.generate(image_prompt(panel.scene), reference))
            if reference is None:
                reference = image  # All later panels use the SAME first-panel visual anchor.
            temporary = directory / f"{panel.id}.tmp"
            temporary.write_bytes(image)
            temporary.replace(directory / f"{panel.id}.png")

        exercise_id = f"fractions-{comic_id}"
        payload = {}
        hints = {}
        for lang in ("ru", "kk"):
            localized = getattr(story, lang)
            comic = Comic(
                id=comic_id,
                lang=lang,
                title=localized.title,
                panels=[
                    Panel(
                        id=p.id,
                        speaker=SPEAKERS[p.speaker],
                        text=p.text,
                        imageKey=f"{comic_id}-{p.id:02d}",
                        imageUrl=f"/api/comic-images/{comic_id}/{p.id}.png",
                    )
                    for p in localized.panels
                ],
                exercise=Exercise(id=exercise_id, prompt=localized.exercise),
            )
            payload[lang] = comic.model_dump()
            hints[lang] = localized.hints
        self.store.publish(claim, comic_id, payload, exercise_id, str(problem.expected), hints)


async def run(once: bool = False):
    settings = Settings.from_env()
    store = Store(settings.data_dir)
    async with httpx.AsyncClient(follow_redirects=False) as client:
        http = OpenAIHTTP(settings, client)
        worker = Worker(store, OpenAITextProvider(http), OpenAIImageProvider(http), settings)
        while True:
            worked = await worker.run_once()
            if once:
                return
            if not worked:
                await asyncio.sleep(settings.poll_interval)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--once", action="store_true", help="Process at most one queued job and exit"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    # Suppress HTTP client request logging; the application logs only job IDs/status/codes.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    try:
        asyncio.run(run(once=args.once))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
