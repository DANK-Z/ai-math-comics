"""Durable queue consumer. Run separately: python -m app.worker."""

import argparse
import asyncio
import io
import json
import logging
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from typing import TypeVar
from uuid import uuid4

import httpx
from PIL import Image
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
from .my_story import (
    MyStory,
    my_story_image_prompt,
    my_story_prompt,
    prepared_portrait,
    speaker_name,
    validate_my_story,
)
from .prepared_art import ART_DIR, PREPARED_PANELS, PREPARED_SPEAKERS, live_cast_reference
from .problems import EquationProblem, Problem, boss_rounds, problem_from_dict
from .providers import (
    ImageProvider,
    OpenAIHTTP,
    OpenAIImageProvider,
    OpenAITextProvider,
    ProviderError,
    TextProvider,
    normalize_png,
)
from .schemas import (
    Boss,
    BossRound,
    Comic,
    ContinuationRequest,
    Exercise,
    JobRequest,
    Panel,
    PanelPlaceholder,
    StoryOptions,
)
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
from .story_cache import CachedStory, StoryCache, story_cache_from_settings

logger = logging.getLogger(__name__)
LANGS = ("ru", "kk")
QUEUED_REQUEST = TypeAdapter(JobRequest | ContinuationRequest)
# Worth another storyboard attempt: the model broke a rule, or the call did not complete.
RETRYABLE_STORY_ERRORS = {"invalid_provider_output", "provider_timeout", "provider_unavailable"}
BOSS_KIND = {"fractions": "fraction-slime", "equations": "x-master"}


def with_feedback(prompt: str, rejected: str | None) -> str:
    """Tell the model which rule its previous storyboard broke (rule names only)."""
    if rejected is None:
        return prompt
    try:
        data = json.loads(prompt)
    except ValueError:
        return prompt
    if not isinstance(data, dict):
        return prompt
    data["previous_attempt_rejected"] = {
        "reason": rejected,
        "instruction": "Your previous answer was rejected for this reason. Write a new answer "
        "that follows every rule in task exactly.",
    }
    return json.dumps(data, ensure_ascii=False)


StoryType = TypeVar("StoryType")


class Worker:
    def __init__(
        self,
        store: Store,
        text: TextProvider,
        image: ImageProvider | None,
        settings: Settings,
        cache: StoryCache | None = None,
    ):
        self.store = store
        self.text = text
        self.image = image
        self.settings = settings
        self.cache = cache

    async def run_once(self) -> bool:
        claim = self.store.claim(self.settings.job_timeout + 30)
        if claim is None:
            return False
        comic_id = claim["artwork_id"] or str(uuid4())
        directory = self.store.images_dir / comic_id
        published = False
        keep_saved_panels = False
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
            keep_saved_panels = exc.code == "image_generation_failed"
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
                    if not keep_saved_panels:
                        (directory / f"{index}.png").unlink(missing_ok=True)
                    (directory / f"{index}.{claim['owner']}.tmp").unlink(missing_ok=True)
                if not any(directory.iterdir()):
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
            self.store.begin_panels(claim, len(payload["ru"]["panels"]))
            self.store.publish(
                claim,
                comic_id,
                payload,
                f"{EXERCISE_PREFIX}{comic_id}",
                str(problem.expected),
                hints,
            )
            return

        await self.generate_fraction_comic(claim, comic_id, request, problem_from_dict(inputs))

    async def generate_fraction_comic(
        self,
        claim: dict,
        comic_id: str,
        request: JobRequest,
        problem: Problem | EquationProblem,
    ):
        """Fractions or equations comic (classic or My Story) with a panel-four boss."""
        checkpoint = claim["storyboard"]
        prepared = self.settings.art_mode == "prepared" and checkpoint is None
        options = request.story  # «Моя история» options, or None for a classic comic
        if prepared and not all((ART_DIR / file).is_file() for _, file, _ in PREPARED_PANELS):
            raise ProviderError("generation_failed", stage="prepared_art_missing")
        cached = await self.cached_story(request, problem, prepared) if checkpoint is None else None
        if cached is not None:
            story, hit = cached
            # Nothing to write or draw: the story and pictures are reused, the math is new.
            self.store.begin_panels(claim, len(story.ru.panels))
        elif checkpoint is None:
            if options is not None:
                story = await self.generate_story(
                    my_story_prompt(request, problem, prepared=prepared),
                    MyStory.model_json_schema(),
                    lambda raw: validate_my_story(raw, problem, options),
                )
            else:
                story = await self.generate_story(
                    text_prompt(request, problem, prepared=prepared),
                    (PreparedStory if prepared else Story).model_json_schema(),
                    lambda raw: validate_story(raw, problem, prepared=prepared),
                )
            self.store.begin_panels(
                claim,
                len(story.ru.panels),
                live_storyboard=None if prepared else (comic_id, story.model_dump_json()),
            )
        elif options is not None:
            story = validate_my_story(json.loads(checkpoint), problem, options)
        else:
            story = validate_story(json.loads(checkpoint), problem)
        topic = problem.topic

        def scene_prompt(scene: str) -> str:
            if options is None:
                return image_prompt(scene, topic)
            return my_story_image_prompt(scene, options, topic)

        if cached is not None:
            aspects = hit.aspects
            image_owner = hit.source_comic_id
        else:
            aspects = (
                {}
                if prepared
                else await self.render_live_images(claim, comic_id, story.ru.panels, scene_prompt)
            )
            image_owner = comic_id

        exercise_id = f"{topic}-{comic_id}"
        answer_format = "whole-number" if topic == "equations" else None
        # Two more server-owned rounds for the boss; the comic's exercise is round one.
        extra = boss_rounds(request, problem)
        rounds = [
            (f"{exercise_id}-r{index}", str(p.expected), {lang: p.hints(lang) for lang in LANGS})
            for index, p in enumerate(extra, 2)
        ]
        payload = {}
        hints = {}
        for lang in ("ru", "kk"):
            localized = getattr(story, lang)
            if options is None:
                panels = [
                    Panel(
                        id=p.id,
                        speaker=PREPARED_SPEAKERS[p.speaker],
                        text=p.text,
                        imageKey=f"{comic_id}-{p.id:02d}",
                        imageAspect=aspects.get(p.id),
                        imageUrl=(
                            f"/api/prepared-art/{p.id}.jpg"
                            if prepared
                            else f"/api/comic-images/{image_owner}/{p.id}.png"
                        ),
                    )
                    for p in localized.panels
                ]
            else:
                panels = my_story_panels(
                    comic_id, localized.panels, options, prepared, aspects, image_owner
                )
            comic = Comic(
                id=comic_id,
                lang=lang,
                title=localized.title,
                artwork="prepared" if prepared else None,
                panels=panels,
                exercise=Exercise(
                    id=exercise_id, prompt=localized.exercise, answerFormat=answer_format
                ),
                boss=Boss(
                    kind=BOSS_KIND[topic],
                    rounds=[
                        BossRound(
                            exerciseId=exercise_id,
                            prompt=localized.exercise,
                            answerFormat=answer_format,
                        ),
                        *(
                            BossRound(
                                exerciseId=round_id,
                                prompt=p.prompt(lang),
                                answerFormat=answer_format,
                            )
                            for (round_id, _, _), p in zip(rounds, extra, strict=True)
                        ),
                    ],
                ),
            )
            payload[lang] = comic.model_dump()
            hints[lang] = localized.hints
        self.store.publish(
            claim,
            comic_id,
            payload,
            exercise_id,
            str(problem.expected),
            hints,
            rounds=rounds,
            skill=problem.skill,
            round_skills=[p.skill for p in extra],
        )
        if self.cache is not None and cached is None and checkpoint is None:
            await self.cache.remember(
                request,
                self.settings.art_mode,
                CachedStory(
                    story=json.loads(story.model_dump_json()),
                    source_comic_id=comic_id,
                    aspects=aspects,
                    kind="new",
                ),
            )

    async def cached_story(self, request: JobRequest, problem, prepared: bool):
        """A cached story with this job's own exercise, hints and panel-four text, or None."""
        if self.cache is None:
            return None
        hit = await self.cache.lookup(request, self.settings.art_mode)
        if hit is None:
            return None
        raw = json.loads(json.dumps(hit.story))
        for lang in LANGS:
            raw[lang]["exercise"] = problem.prompt(lang)
            raw[lang]["hints"] = problem.hints(lang)
            raw[lang]["panels"][3]["text"] = problem.prompt(lang)
        try:
            if request.story is not None:
                story = validate_my_story(raw, problem, request.story)
            else:
                story = validate_story(raw, problem, prepared=prepared)
        except (StoryRuleError, ValidationError):
            logger.info("Cached story no longer valid; generating a new one")
            return None
        if not prepared and self.store.comic(hit.source_comic_id) is None:
            return None  # its pictures are gone
        logger.info("Reused a cached story (%s, similarity %.2f)", hit.kind, hit.similarity)
        return story, hit

    async def generate_story(
        self, prompt: str, schema: dict, validate: Callable[[dict], StoryType]
    ) -> StoryType:
        """Ask the text model for a storyboard, retrying rejected or incomplete answers."""
        attempts = self.settings.text_attempts
        rejected = None
        for attempt in range(1, attempts + 1):
            try:
                return await self.story_attempt(with_feedback(prompt, rejected), schema, validate)
            except ProviderError as exc:
                if exc.code not in RETRYABLE_STORY_ERRORS or attempt == attempts:
                    raise
                logger.info(
                    "Storyboard attempt %s/%s rejected: %s",
                    attempt,
                    attempts,
                    exc.stage or exc.code,
                )
                rejected = exc.stage if exc.code == "invalid_provider_output" else None
        raise AssertionError("unreachable")

    async def story_attempt(
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

    async def render_live_images(
        self,
        claim: dict,
        comic_id: str,
        panels: Sequence[ScenePanel],
        scene_prompt: Callable[[str], str] = image_prompt,
    ) -> dict[int, float]:
        if self.image is None:
            raise ProviderError("image_generation_failed", stage="image:provider_missing")
        try:
            reference = live_cast_reference()
        except OSError:
            raise ProviderError(
                "image_generation_failed", stage="image:reference_unavailable"
            ) from None
        directory = self.store.images_dir / comic_id
        directory.mkdir(exist_ok=True)
        aspects = {}
        for panel in panels:
            saved = directory / f"{panel.id}.png"
            if saved.is_file():
                try:
                    with Image.open(saved) as panel_art:
                        aspect = panel_art.width / panel_art.height
                        panel_art.verify()
                except (OSError, SyntaxError, ValueError):
                    pass  # A missing or damaged file needs a fresh illustration.
                else:
                    aspects[panel.id] = aspect
                    self.store.panel_saved(claim, panel.id)
                    continue
            try:
                image = normalize_png(
                    await self.image.generate(scene_prompt(panel.scene), reference)
                )
            except ProviderError as exc:
                stage = f"image:panel_{panel.id}:{exc.stage or exc.code}"
                raise ProviderError("image_generation_failed", stage=stage) from None
            with Image.open(io.BytesIO(image)) as panel_art:
                aspects[panel.id] = panel_art.width / panel_art.height
            temporary = directory / f"{panel.id}.{claim['owner']}.tmp"
            try:
                temporary.write_bytes(image)
                temporary.replace(saved)
            except OSError:
                raise ProviderError(
                    "image_generation_failed", stage=f"image:panel_{panel.id}:save_failed"
                ) from None
            self.store.panel_saved(claim, panel.id)
        return aspects


def my_story_panels(
    comic_id: str,
    story_panels: Sequence,
    options: StoryOptions,
    prepared: bool,
    aspects: dict[int, float],
    image_owner: str | None = None,
) -> list[Panel]:
    """Live art for every panel. In prepared mode: the cast portraits, and a setting
    placeholder for the student's own heroes (they are never drawn)."""
    seen: dict[str, int] = {}
    panels = []
    for p in story_panels:
        portrait = prepared_portrait(p.speaker, seen) if prepared else None
        if not prepared:
            url = f"/api/comic-images/{image_owner or comic_id}/{p.id}.png"
        elif portrait is not None:
            url = f"/api/prepared-art/{portrait}.jpg"
        else:
            url = None
        panels.append(
            Panel(
                id=p.id,
                speaker=speaker_name(p.speaker, options),
                text=p.text,
                imageKey=f"{comic_id}-{p.id:02d}",
                imageAspect=aspects.get(p.id),
                imageUrl=url,
                placeholder=(
                    PanelPlaceholder(setting=options.setting) if prepared and url is None else None
                ),
            )
        )
    return panels


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
    cache = story_cache_from_settings(settings, store.db_path)
    async with configured_providers(settings) as (text, image):
        worker = Worker(store, text, image, settings, cache)
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
