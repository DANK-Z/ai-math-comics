"""Public API models; field names follow docs/api-contract.md."""

from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["ru", "kk"]
HintStep = Literal[1, 2]


class Panel(BaseModel):
    id: int
    speaker: str
    text: str
    imageKey: str
    imageUrl: str | None = None


class Exercise(BaseModel):
    id: str = "pizza-share"
    panelId: int = 4
    prompt: str


class Comic(BaseModel):
    id: str = "pizza-fractions"
    lang: Language
    title: str
    panels: list[Panel]
    exercise: Exercise
    artwork: Literal["prepared"] | None = None


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


class JobRequest(BaseModel):
    model_config = {"extra": "forbid"}

    grade: int = Field(strict=True, ge=5, le=6)
    topic: Literal["fractions"]
    lang: Language
    difficulty: Literal["basic", "intermediate", "advanced"]


ErrorCode = Literal[
    "provider_not_configured",
    "provider_authentication",
    "provider_rate_limited",
    "provider_timeout",
    "provider_unavailable",
    "invalid_provider_output",
    "job_timeout",
    "worker_interrupted",
    "generation_failed",
]


class JobAccepted(BaseModel):
    jobId: str
    status: Literal["queued"] = "queued"


class JobStatus(BaseModel):
    jobId: str
    status: Literal["queued", "running", "ready", "failed"]
    comicId: str | None = None
    errorCode: ErrorCode | None = None
