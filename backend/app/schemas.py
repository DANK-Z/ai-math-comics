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


class Exercise(BaseModel):
    id: Literal["pizza-share"] = "pizza-share"
    panelId: int = 4
    prompt: str


class Comic(BaseModel):
    id: Literal["pizza-fractions"] = "pizza-fractions"
    lang: Language
    title: str
    panels: list[Panel]
    exercise: Exercise


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
