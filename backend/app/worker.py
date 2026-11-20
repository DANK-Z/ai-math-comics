"""Durable queue consumer. Run separately: python -m app.worker."""

import argparse
import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from typing import TypeVar
from uuid import uuid4

import httpx
from pydantic import TypeAdapter, ValidationError

from .config import Settings
from .gemini import gemini_providers
from .library_episode import (
    EXERCISE_PREFIX,
    LibraryProblem,
    LibraryStory,
    LibraryText,
    episode_payload,
    library_prompt,
    validate_library_story,
)
from .prepared_art import ART_DIR, PREPARED_PANELS, PREPARED_SPEAKERS
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
from .schemas import Comic, ContinuationRequest, Exercise, JobRequest, Panel
from .storage import Store
from .story import (
    PreparedStory,
    ScenePanel,
    Story,
    StoryRuleError,
    image_prompt,
    text_prompt,
    validate_story,
)

logger = logging.getLogger(__name__)
SPEAKERS = {"mira": "Мира", "daniyar": "Данияр"}
QUEUED_REQUEST = TypeAdapter(JobRequest | ContinuationRequest)
StoryType = TypeVar("StoryType")


class Worker:
    def __init__(
        self, store: Store, text: TextProvider, image: ImageProvider | None, settings: Settings
    ):
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
            if exc.stage:
                logger.info("Job %s provider stage: %s", claim["id"], exc.stage)
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
        request = QUEUED_REQUEST.validate_json(claim["request"])
        inputs = json.loads(claim["problem"])
        if isinstance(request, ContinuationRequest):
            problem = LibraryProblem(**inputs)
            story = await self.generate_story(
                library_prompt(request, problem),
                LibraryStory.model_json_schema(),
                validate_library_story,
            )
            payload, hints = episode_payload(comic_id, story, problem)
            self.store.publish(
                claim,
                comic_id,
                payload,
                f"{EXERCISE_PREFIX}{comic_id}",
                str(problem.expected),
                hints,
            )
            return

        await self.generate_fraction_comic(claim, comic_id, request, Problem.from_dict(inputs))

    async def generate_fraction_comic(
        self, claim: dict, comic_id: str, request: JobRequest, problem: Problem
    ):
        prepared = self.settings.art_mode == "prepared"
        if prepared and not all((ART_DIR / file).is_file() for _, file, _ in PREPARED_PANELS):
            raise ProviderError("generation_failed", stage="prepared_art_missing")
        story = await self.generate_story(
            text_prompt(request, problem, prepared=prepared),
            (PreparedStory if prepared else Story).model_json_schema(),
            lambda raw: validate_story(raw, problem, prepared=prepared),
        )
        if not prepared:
            await self.render_live_images(comic_id, story.ru.panels)

        exercise_id = f"fractions-{comic_id}"
        speaker_names = PREPARED_SPEAKERS if prepared else SPEAKERS
        payload = {}
        hints = {}
        for lang in ("ru", "kk"):
            localized = getattr(story, lang)
            comic = Comic(
                id=comic_id,
                lang=lang,
                title=localized.title,
                artwork="prepared" if prepared else None,
                panels=[
                    Panel(
                        id=p.id,
                        speaker=speaker_names[p.speaker],
                        text=p.text,
                        imageKey=f"{comic_id}-{p.id:02d}",
                        imageUrl=(
                            f"/api/prepared-art/{p.id}.jpg"
                            if prepared
                            else f"/api/comic-images/{comic_id}/{p.id}.png"
                        ),
                    )
                    for p in localized.panels
                ],
                exercise=Exercise(id=exercise_id, prompt=localized.exercise),
            )
            payload[lang] = comic.model_dump()
            hints[lang] = localized.hints
        self.store.publish(claim, comic_id, payload, exercise_id, str(problem.expected), hints)

    async def generate_story(
        self, prompt: str, schema: dict, validate: Callable[[dict], StoryType]
    ) -> StoryType:
        try:
            raw = await self.text.generate(prompt, schema)
        except ProviderError as exc:
            raise ProviderError(
                exc.code, stage=f"story:{exc.stage or 'provider_request'}"
            ) from None
        try:
            return validate(raw)
        except StoryRuleError as exc:
            raise ProviderError(
                "invalid_provider_output",
                stage=f"story_application_validation:{exc.path}:{exc.rule}",
            ) from None
        except ValidationError as exc:
            error = exc.errors(include_input=False, include_context=False, include_url=False)[0]
            fields = {
                "ru",
                "kk",
                "title",
                "panels",
                "exercise",
                "hints",
                "id",
                "speaker",
                "text",
                "scene",
                *LibraryText.model_fields,
            }
            path = ".".join(
                str(part) if isinstance(part, int) or part in fields else "<extra>"
                for part in error["loc"]
            )
            raise ProviderError(
                "invalid_provider_output", stage=f"story_schema_validation:{path}:{error['type']}"
            ) from None

    async def render_live_images(self, comic_id: str, panels: Sequence[ScenePanel]):
        if self.image is None:
            raise RuntimeError("Live artwork requires an image provider")
        directory = self.store.images_dir / comic_id
        directory.mkdir()
        reference = None
        for panel in panels:
            try:
                image = normalize_png(
                    await self.image.generate(image_prompt(panel.scene), reference)
                )
            except ProviderError as exc:
                stage = f"image:panel_{panel.id}:{exc.stage or 'provider_output'}"
                raise ProviderError(exc.code, stage=stage) from None
            if reference is None:
                reference = image  # All later panels use the SAME first-panel visual anchor.
            temporary = directory / f"{panel.id}.tmp"
            temporary.write_bytes(image)
            temporary.replace(directory / f"{panel.id}.png")


@asynccontextmanager
async def configured_providers(
    settings: Settings,
) -> AsyncIterator[tuple[TextProvider, ImageProvider | None]]:
    if settings.provider == "gemini":
        async with gemini_providers(settings) as providers:
            yield providers
        return
    async with httpx.AsyncClient(follow_redirects=False) as client:
        http = OpenAIHTTP(settings, client)
        image = OpenAIImageProvider(http) if settings.art_mode == "live" else None
        yield OpenAITextProvider(http), image


async def run(once: bool = False):
    settings = Settings.from_env()
    store = Store(settings.data_dir)
    async with configured_providers(settings) as (text, image):
        worker = Worker(store, text, image, settings)
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
    logging.getLogger("google_genai").setLevel(logging.ERROR)
    try:
        asyncio.run(run(once=args.once))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
