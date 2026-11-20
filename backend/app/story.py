"""Strict bilingual model output and server-owned illustration directions."""

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .prepared_art import PREPARED_PANELS
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


class ScenePanel(StrictModel):
    id: int = Field(ge=1, le=6)
    text: str = Field(min_length=1, max_length=600)
    scene: Literal["welcome", "discuss", "consider", "question", "think", "encourage"]


class StoryPanel(ScenePanel):
    speaker: Literal["mira", "daniyar"]


class PreparedPanel(ScenePanel):
    speaker: Literal["pifik", "aruna", "aldiyar"]


class StoryText(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    exercise: str = Field(min_length=1, max_length=600)
    hints: list[str] = Field(min_length=2, max_length=2)


class LocalizedStory(StoryText):
    panels: list[StoryPanel] = Field(min_length=6, max_length=6)


class LocalizedPreparedStory(StoryText):
    panels: list[PreparedPanel] = Field(min_length=6, max_length=6)


class Story(StrictModel):
    ru: LocalizedStory
    kk: LocalizedStory


class PreparedStory(StrictModel):
    ru: LocalizedPreparedStory
    kk: LocalizedPreparedStory


class StoryRuleError(ValueError):
    def __init__(self, path: str, rule: str):
        super().__init__(f"{path}: {rule}")
        self.path = path
        self.rule = rule


# Free narrative cannot supply arithmetic or a number in digits OR common RU/KK word forms.
# Math-bearing exercise/hints instead must exactly match the trusted localized template.
# Kazakh "үшін" (for) and "бірдей" (equal) are ordinary words. Keep the exceptions
# word-bounded so nearby numeric forms such as "үшінші" and "бірден" still fail.
NUMBER_WORDS = re.compile(
    r"\b(?:нол\w*|нул\w*|один\w*|одн\w*|едини\w*|два\w*|две\w*|двух\w*|"
    r"три\w*|тр[её]х\w*|четыр\w*|четвер\w*|пят\w*|шест\w*|сем\w*|вос\w*|"
    r"девят\w*|десят\w*|двадц\w*|тридц\w*|сорок\w*|сот\w*|сто|"
    r"пол(?:овин|тора|утора)\w*|треть\w*|"
    r"тысяч\w*|миллион\w*|нөл\w*|бір(?!ге\b|дей\b|лес)\w*|"
    r"екі\w*|үш(?!ін\b)\w*|төрт\w*|бес\w*|алты\w*|жеті\w*|сегіз\w*|тоғыз\w*|он|жүз\w*|"
    r"жиырма\w*|отыз\w*|қырық\w*|елу\w*|алпыс\w*|жетпіс\w*|сексен\w*|тоқсан\w*|"
    r"мың\w*|жарты\w*|ширек\w*)\b",
    re.IGNORECASE,
)


def validate_narrative(text: str, path: str):
    if not re.search(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]", text) or re.search(r"[A-Za-z]", text):
        raise StoryRuleError(path, "cyrillic_narrative")
    if any(c.isnumeric() or c in "/=⁄¼½¾⅓⅔%" for c in text):
        raise StoryRuleError(path, "no_numeric_characters_or_math_symbols")
    if NUMBER_WORDS.search(text):
        raise StoryRuleError(path, "no_number_words")


def validate_story(raw: dict, problem: Problem, *, prepared: bool = False) -> Story | PreparedStory:
    story = (PreparedStory if prepared else Story).model_validate(raw)
    for lang in ("ru", "kk"):
        localized = getattr(story, lang)
        if localized.exercise != problem.prompt(lang):
            raise StoryRuleError(f"{lang}.exercise", "exact_server_exercise")
        for index, hint in enumerate(problem.hints(lang)):
            if localized.hints[index] != hint:
                raise StoryRuleError(f"{lang}.hints[{index}]", "exact_server_hint")
        for index, panel in enumerate(localized.panels):
            if panel.id != index + 1:
                raise StoryRuleError(f"{lang}.panels[{index}].id", "sequential_panel_id")
            if panel.scene != SCENES[index]:
                raise StoryRuleError(f"{lang}.panels[{index}].scene", "ordered_scene")
            if prepared and panel.speaker != PREPARED_PANELS[index][0]:
                raise StoryRuleError(f"{lang}.panels[{index}].speaker", "prepared_scene_speaker")
        if localized.panels[3].text != localized.exercise:
            raise StoryRuleError(f"{lang}.panels[3].text", "exact_exercise_panel_text")
        narrative = [(f"{lang}.title", localized.title)] + [
            (f"{lang}.panels[{i}].text", p.text)
            for i, p in enumerate(localized.panels)
            if p.id != 4
        ]
        for path, text in narrative:
            validate_narrative(text, path)
    for index, (ru, kk) in enumerate(zip(story.ru.panels, story.kk.panels, strict=True)):
        if ru.speaker != kk.speaker:
            raise StoryRuleError(f"kk.panels[{index}].speaker", "same_speaker_across_translations")
        if ru.text == kk.text:
            raise StoryRuleError(f"kk.panels[{index}].text", "distinct_translation")
    if story.ru.title == story.kk.title:
        raise StoryRuleError("kk.title", "distinct_translation")
    return story


def text_prompt(request: JobRequest, problem: Problem, *, prepared: bool = False) -> str:
    art_direction = ""
    if prepared:
        art_direction = (
            " Use the exact scene and speaker IDs in prepared_panels, in order. "
            "These fixed pictures show the cast outside school, without food or math props. "
            "Discuss the given pizza problem as an imagined situation. Never describe an action, "
            "setting, or object as visible unless the fixed picture description shows it."
        )
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
                "Use the listed scene sequence exactly. No other fields." + art_direction
            ),
            "grade": request.grade,
            "difficulty": request.difficulty,
            "requested_language": request.lang,
            "fixed_problem_inputs": problem.to_dict(),
            **(
                {
                    "prepared_panels": [
                        {"id": index, "scene": scene, "speaker": speaker, "picture": description}
                        for index, (scene, (speaker, _, description)) in enumerate(
                            zip(SCENES, PREPARED_PANELS, strict=True), 1
                        )
                    ]
                }
                if prepared
                else {"characters": CHARACTERS}
            ),
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
