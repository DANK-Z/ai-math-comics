"""Public API models; field names follow docs/api-contract.md."""

import re
import unicodedata
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Language = Literal["ru", "kk"]
HintStep = Literal[1, 2]


StorySetting = Literal["school", "space", "forest", "custom"]


class PanelPlaceholder(BaseModel):
    """A panel without artwork (a student's own hero in prepared-art mode)."""

    setting: StorySetting


class Panel(BaseModel):
    id: int
    speaker: str
    text: str
    imageKey: str
    imageUrl: str | None = None
    imageAspect: float | None = None
    placeholder: PanelPlaceholder | None = None


class Exercise(BaseModel):
    id: str = "pizza-share"
    panelId: int = 4
    prompt: str
    answerFormat: Literal["whole-number"] | None = None


class ContinuationContext(BaseModel):
    sourceChapterId: Literal["school-quest-map"]
    choiceId: Literal["library-cabinet-key"]
    nextChapterId: Literal["library-boxes"]


class Comic(BaseModel):
    id: str = "pizza-fractions"
    lang: Language
    title: str
    panels: list[Panel]
    exercise: Exercise
    artwork: Literal["prepared"] | None = None
    continuation: ContinuationContext | None = None


class CheckRequest(BaseModel):
    answer: str = Field(max_length=256)
    lang: Language = "ru"


class CheckResponse(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    message: str


class HintResponse(BaseModel):
    step: HintStep
    text: str
    hasMore: bool


# Student-written text (hero names, descriptions, setting, premise) is story data only.
# Allow letters, spaces and light punctuation; no digits, math symbols, markup or links,
# so the server keeps sole control of the numbers in the comic.
STUDENT_TEXT = re.compile(r"[\w\s.,!?'\"«»()\-—–:;]*")
LINK_HINT = re.compile(r"https?|www\.|\.(?:com|ru|kz|org|net)\b", re.IGNORECASE)


def clean_student_text(value: str) -> str:
    value = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()
    if any(ch.isdigit() or ch == "_" for ch in value) or not STUDENT_TEXT.fullmatch(value):
        raise ValueError("only letters, spaces and basic punctuation are allowed")
    if LINK_HINT.search(value):
        raise ValueError("links are not allowed")
    return value


class CustomHero(BaseModel):
    model_config = {"extra": "forbid"}

    name: str = Field(min_length=1, max_length=24)
    description: str = Field(default="", max_length=80)

    @field_validator("name", "description")
    @classmethod
    def _clean(cls, value: str) -> str:
        return clean_student_text(value)

    @field_validator("name")
    @classmethod
    def _non_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("name is required")
        return value


CastHero = Literal["aldiyar", "aruna", "pifik"]


class StoryOptions(BaseModel):
    """«Моя история»: the student's heroes, style, setting and premise."""

    model_config = {"extra": "forbid"}

    heroes: list[CastHero] = Field(min_length=1, max_length=3)
    customHeroes: list[CustomHero] = Field(default_factory=list, max_length=2)
    style: Literal["comic", "cartoon", "pixel"]
    setting: StorySetting
    customSetting: str | None = Field(default=None, max_length=60)
    premise: str | None = Field(default=None, max_length=280)

    @field_validator("customSetting", "premise")
    @classmethod
    def _clean_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return clean_student_text(value) or None

    @model_validator(mode="after")
    def _consistent(self):
        if len(set(self.heroes)) != len(self.heroes):
            raise ValueError("heroes must be unique")
        if "pifik" not in self.heroes:
            # Pifik presents the exercise and gives the hints.
            raise ValueError("pifik is always part of the story")
        names = [hero.name.casefold() for hero in self.customHeroes]
        reserved = {"пифик", "аруна", "алдияр", "pifik", "aruna", "aldiyar"}
        if len(set(names)) != len(names) or reserved & set(names):
            raise ValueError("custom hero names must be unique and differ from the cast")
        if (self.setting == "custom") != bool(self.customSetting):
            raise ValueError("customSetting is required exactly when setting is custom")
        return self


class JobRequest(BaseModel):
    model_config = {"extra": "forbid"}

    grade: int = Field(strict=True, ge=5, le=6)
    topic: Literal["fractions"]
    lang: Language
    difficulty: Literal["basic", "intermediate", "advanced"]
    story: StoryOptions | None = None


class ContinuationRequest(BaseModel):
    model_config = {"extra": "forbid"}

    sourceChapterId: Literal["school-quest-map"]
    choiceId: Literal["library-cabinet-key"]
    locale: Language


ErrorCode = Literal[
    "provider_not_configured",
    "provider_authentication",
    "provider_rate_limited",
    "provider_timeout",
    "provider_unavailable",
    "invalid_provider_output",
    "image_generation_failed",
    "job_timeout",
    "worker_interrupted",
    "generation_failed",
]


class JobAccepted(BaseModel):
    jobId: str
    status: Literal["queued"] = "queued"


class ResumeJobRequest(BaseModel):
    resumeToken: str = Field(min_length=36, max_length=36)


class JobProgress(BaseModel):
    stage: Literal["queued", "storyboard", "drawing", "preparing", "ready"]
    completedPanels: int | None = None
    totalPanels: int | None = None


class JobStatus(BaseModel):
    jobId: str
    status: Literal["queued", "running", "ready", "failed"]
    comicId: str | None = None
    errorCode: ErrorCode | None = None
    progress: JobProgress | None = None
    resumeToken: str | None = None
