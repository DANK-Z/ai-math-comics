"""Strict bilingual model output and server-owned illustration directions."""

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .problems import Problem
from .schemas import JobRequest

SCENES = (
    "welcome",
    "discuss",
    "consider",
    "question",
    "think",
    "encourage",
)
SCENE_DESCRIPTIONS = {
    "welcome": "Wide view: Mira and Daniyar arrive at the cozy classroom table.",
    "discuss": "Medium view: Mira gestures toward an unmarked closed pizza box, Daniyar listens.",
    "consider": "Close view: Daniyar thoughtfully touches his chin, Mira looks curious.",
    "question": "Front view: Mira invites the reader to think with an open-hand gesture.",
    "think": "Side view: the children pause thoughtfully, looking at the closed box.",
    "encourage": "Medium view: the children smile encouragingly toward the reader.",
}
CHARACTERS = (
    "Mira: a schoolgirl with warm brown skin, brown eyes, a dark chin-length bob, "
    "a yellow sweatshirt and teal overalls. Daniyar: a schoolboy with warm brown skin, "
    "brown eyes, short dark curly hair, a blue hoodie and gray trousers. "
    "Keep exactly these faces, hairstyles, ages, outfits and colors in every panel. "
    "Warm hand-drawn children's comic, clean outlines, soft pastel colors. "
    "Same cozy classroom with a wooden table and an unmarked closed pizza box."
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class StoryPanel(StrictModel):
    id: int = Field(ge=1, le=6)
    speaker: Literal["mira", "daniyar"]
    text: str = Field(min_length=1, max_length=600)
    scene: Literal["welcome", "discuss", "consider", "question", "think", "encourage"]


class LocalizedStory(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    panels: list[StoryPanel] = Field(min_length=6, max_length=6)
    exercise: str = Field(min_length=1, max_length=600)
    hints: list[str] = Field(min_length=2, max_length=2)


class Story(StrictModel):
    ru: LocalizedStory
    kk: LocalizedStory


# Free narrative cannot supply arithmetic or a number in digits OR common RU/KK word forms.
# Math-bearing exercise/hints instead must exactly match the trusted localized template.
NUMBER_WORDS = re.compile(
    r"\b(?:нол\w*|нул\w*|один\w*|одн\w*|едини\w*|два\w*|две\w*|двух\w*|"
    r"три\w*|тр[её]х\w*|четыр\w*|четвер\w*|пят\w*|шест\w*|сем\w*|вос\w*|"
    r"девят\w*|десят\w*|двадц\w*|тридц\w*|сорок\w*|сот\w*|сто|"
    r"пол(?:овин|тора|утора)\w*|треть\w*|"
    r"тысяч\w*|миллион\w*|нөл\w*|бір(?!ге\b|лес)\w*|"
    r"екі\w*|үш\w*|төрт\w*|бес\w*|алты\w*|жеті\w*|сегіз\w*|тоғыз\w*|он|жүз\w*|"
    r"жиырма\w*|отыз\w*|қырық\w*|елу\w*|алпыс\w*|жетпіс\w*|сексен\w*|тоқсан\w*|"
    r"мың\w*|жарты\w*|ширек\w*)\b",
    re.IGNORECASE,
)


def validate_story(raw: dict, problem: Problem) -> Story:
    story = Story.model_validate(raw)
    for lang in ("ru", "kk"):
        localized = getattr(story, lang)
        if localized.exercise != problem.prompt(lang) or localized.hints != problem.hints(lang):
            raise ValueError("Model changed trusted exercise or hints")
        if [panel.id for panel in localized.panels] != list(range(1, 7)):
            raise ValueError("Panels must be ordered and unique")
        if [panel.scene for panel in localized.panels] != list(SCENES):
            raise ValueError("Unexpected scene sequence")
        if localized.panels[3].text != localized.exercise:
            raise ValueError("Exercise must appear in panel four")
        narrative = [localized.title] + [p.text for p in localized.panels if p.id != 4]
        for text in narrative:
            if (
                not re.search(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]", text)
                or re.search(r"[A-Za-z]", text)
                or any(c.isnumeric() for c in text)
                or any(c in text for c in "/=⁄¼½¾⅓⅔%")
                or NUMBER_WORDS.search(text)
            ):
                raise ValueError("Narrative must be localized and contain no numeric solution")
    for ru, kk in zip(story.ru.panels, story.kk.panels, strict=True):
        if ru.speaker != kk.speaker or ru.text == kk.text:
            raise ValueError("Translations must preserve characters and differ in text")
    if story.ru.title == story.kk.title:
        raise ValueError("Titles must be localized")
    return story


def text_prompt(request: JobRequest, problem: Problem) -> str:
    return json.dumps(
        {
            "task": (
                "Write a six-panel child-friendly fractions comic in BOTH Russian (ru) and "
                "Kazakh (kk). Use the same speakers and scenes in both languages. "
                "Dialogue should be natural and brief, suited to the grade and difficulty. "
                "Never solve the problem or state any answer, even in words. "
                "Title and dialogue outside panel four must contain NO numbers, numeric words, "
                "fractions, equations, calculations or quantities; use only curiosity, "
                "teamwork, thinking and encouragement. Do not claim the problem is solved. "
                "Copy exercise and both hints VERBATIM from trusted_content, and use exercise "
                "verbatim as panel four text. IDs must be ordered from 1 to 6. "
                "Use the listed scene sequence exactly. No other fields."
            ),
            "grade": request.grade,
            "difficulty": request.difficulty,
            "requested_language": request.lang,
            "fixed_problem_inputs": problem.to_dict(),
            "characters": CHARACTERS,
            "scenes": SCENES,
            "trusted_content": {
                lang: {"exercise": problem.prompt(lang), "hints": problem.hints(lang)}
                for lang in ("ru", "kk")
            },
        },
        ensure_ascii=False,
    )


def image_prompt(scene: str) -> str:
    # No model-authored text, operands, expected answer, or dialogue reaches image generation.
    return (
        f"{CHARACTERS}\n{SCENE_DESCRIPTIONS[scene]}\n"
        "Create a new single comic illustration. If a reference image is provided, "
        "use it to preserve the exact character appearances, palette and setting, "
        "but change the composition and poses as directed. "
        "No embedded text, speech bubbles, captions, lettering, logos, digits or symbols. "
        "Do not show slices, portions, food distribution or mathematical diagrams. "
        "The pizza box stays closed. Do not illustrate a solution."
    )
