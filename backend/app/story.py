"""Strict bilingual model output and server-owned illustration directions."""

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .fraction_context import (
    CONTEXTS,
    PIZZA_WORD,
    RESOURCE_IMAGE_RULE,
    ContextId,
    contextual_actions,
)
from .prepared_art import PREPARED_PANELS
from .problems import Problem
from .schemas import BossCharacter, Emotion, JobRequest

SCENES = (
    "welcome",
    "discuss",
    "consider",
    "question",
    "think",
    "encourage",
)
LIVE_SCENE_DESCRIPTIONS = {
    "welcome": "Wide establishing view. Aldiyar and Aruna walk up to the school fair picnic table "
    "with Pifik hovering beside them. An unmarked pizza box is closed on the table.",
    "discuss": "Aruna points to the closed pizza box to suggest sharing. Aldiyar and Pifik "
    "turn toward her. Show the whole group and the table in a medium-wide view.",
    "consider": "Aldiyar thinks with a hand on his chin while Aruna and Pifik listen. "
    "Keep the closed box, table and fair courtyard in view.",
    "question": "Pifik hovers beside the closed pizza box and gestures toward the reader, "
    "inviting help. Aruna and Aldiyar look expectantly at Pifik.",
    "serve": "The puzzle has been solved. Aldiyar lifts the pizza-box lid and Aruna "
    "passes a plate across the table as Pifik cheers. Show the lid from the side so it "
    "hides the contents. Keep any serving out of view.",
    "celebrate": "The friends enjoy their fair picnic together. Show Aruna and Aldiyar "
    "laughing at the table while Pifik hovers happily beside them. Keep any servings "
    "out of view. Use a wide closing view of the same courtyard.",
}
LIVE_SCENES = tuple(LIVE_SCENE_DESCRIPTIONS)
# Equations: the same six beats around a chest sealed by a riddle lock (no digits drawn).
EQUATION_SCENE_DESCRIPTIONS = {
    "welcome": "Wide establishing view. Aldiyar and Aruna walk up to the school fair picnic "
    "table with Pifik hovering beside them. On the table stands a small wooden treasure chest "
    "sealed by a glowing magic lock with blank, unmarked rune dials.",
    "discuss": "Aruna points to the glowing lock on the closed chest, suggesting they crack "
    "its riddle. Aldiyar and Pifik turn toward her. Show the whole group and the table in a "
    "medium-wide view.",
    "consider": "Aldiyar thinks with a hand on his chin while Aruna and Pifik listen. "
    "Keep the sealed chest, table and fair courtyard in view.",
    "question": "Pifik hovers beside the sealed chest and gestures toward the reader, "
    "inviting help. Aruna and Aldiyar look expectantly at Pifik.",
    "serve": "The riddle has been solved. The magic lock bursts into harmless sparkles and "
    "the chest lid swings open with warm golden light, shown from the side so the contents "
    "stay hidden. Aldiyar and Aruna cheer as Pifik spins happily.",
    "celebrate": "The friends celebrate together at the table with the open chest glowing "
    "softly beside them. Show Aruna and Aldiyar laughing while Pifik hovers happily. "
    "Use a wide closing view of the same courtyard.",
}
TOPIC_SCENES = {"fractions": LIVE_SCENE_DESCRIPTIONS, "equations": EQUATION_SCENE_DESCRIPTIONS}
TOPIC_NOUN = {"fractions": "fractions", "equations": "equations (find the unknown x)"}
TOPIC_RESOLUTION = {
    "fractions": "In the last two scenes they share the picnic and enjoy the fair.",
    "equations": "In the last two scenes the riddle lock opens and they celebrate.",
}
TOPIC_LIVE_PROPS = {
    "fractions": (
        "Keep the same square kraft-paper pizza box with a plain red border on its lid, "
        "and the same cream plates with narrow blue rims. Keep the box closed until the "
        "scene calls for the lid to open. Once opened, it stays open."
    ),
    "equations": (
        "Keep the same small dark wooden chest with brass corners and a plain round "
        "turquoise lock. Keep the lid closed and the lock intact until they open; "
        "after that, keep the lid open and the lock released."
    ),
}
TOPIC_ENDING = {
    "fractions": {
        "ru": "Теперь мы знаем, как разделить угощение поровну.",
        "kk": "Енді дәмді асты қалай тең бөлу керегін білеміз.",
    },
    "equations": {
        "ru": "Мы решили уравнение и разгадали загадку замка.",
        "kk": "Теңдеуді шешіп, құлыптың жұмбағын таптық.",
    },
}
TOPIC_IMAGINED = {
    "fractions": "Discuss the given pizza problem as an imagined situation.",
    "equations": "Discuss the given equation riddle as an imagined magic lock to open.",
}
CHARACTERS = (
    "Aldiyar: a schoolboy with tousled black hair, brown eyes, a blue hoodie with a pale "
    "hood, and silver and navy headphones around his neck. "
    "Aruna: a schoolgirl with long dark braids, brown eyes, a yellow star hair clip, "
    "and a lavender hoodie. "
    "Pifik: a small hovering white and lavender robot with a dark screen face, "
    "cyan eyes and smile, and a navy graduation cap with a gold tassel. "
    "Same school fair courtyard in every panel: red and yellow bunting, a leafy tree, "
    "a blue school facade in the background and a wooden picnic table. Bright comic "
    "art with clear outlines and expressive faces."
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ScenePanel(StrictModel):
    id: int = Field(ge=1, le=6)
    text: str = Field(min_length=1, max_length=600)
    emotion: Emotion = "neutral"
    scene: Literal[
        "welcome", "discuss", "consider", "question", "think", "encourage", "serve", "celebrate"
    ]


class StoryPanel(ScenePanel):
    speaker: Literal["pifik", "aruna", "aldiyar"]


class StoryText(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    exercise: str = Field(min_length=1, max_length=600)
    hints: list[str] = Field(min_length=2, max_length=2)


class LocalizedStory(StoryText):
    panels: list[StoryPanel] = Field(min_length=6, max_length=6)


class LocalizedPreparedStory(StoryText):
    panels: list[StoryPanel] = Field(min_length=6, max_length=6)


BOSS_FORMS = {
    "clockwork-owl": "a round clockwork owl with brass wings and a friendly expression",
    "crystal-dragon": "a friendly little crystalline dragon with translucent wings",
    "ribbon-robot": "a friendly compact robot with flowing cloth ribbons and a broad silhouette",
    "book-golem": "a gentle wide book golem with rounded paper edges and smiling eyes",
    "cloud-moth": "a smiling fluffy cloud moth with soft layered wings",
    "lantern-fox": "a friendly magical fox with a softly glowing lantern-shaped tail",
}
BOSS_PALETTES = {
    "mint-copper": "mint green and warm copper",
    "violet-gold": "violet and pale gold",
    "coral-blue": "coral and ocean blue",
    "indigo-silver": "indigo and silver",
}


class BossDesign(StrictModel):
    form: Literal[
        "clockwork-owl", "crystal-dragon", "ribbon-robot", "book-golem", "cloud-moth", "lantern-fox"
    ]
    palette: Literal["mint-copper", "violet-gold", "coral-blue", "indigo-silver"]
    ru: BossCharacter
    kk: BossCharacter

    def visual(self) -> str:
        return f"{BOSS_FORMS[self.form]}, colored {BOSS_PALETTES[self.palette]}"


class BossStoryboard(StrictModel):
    boss_design: BossDesign | None = None  # old checkpoints can omit generated metadata


class Story(BossStoryboard):
    ru: LocalizedStory
    kk: LocalizedStory


class PreparedStory(BossStoryboard):
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
    r"три\w*|тр[её]х\w*|дво[еи]\w*|тро[еи]\w*|четыр\w*|четвер\w*|пят\w*|шест\w*|сем\w*|вос\w*|"
    r"девят\w*|десят\w*|двадц\w*|тридц\w*|сорок\w*|сот\w*|сто|"
    r"пол(?:овин|тора|утора)\w*|треть\w*|"
    r"тысяч\w*|миллион\w*|нөл\w*|бір(?!ге\b|дей\b|лес)\w*|"
    r"екі\w*|үш(?!ін\b)\w*|төрт\w*|бес\w*|алты\w*|жеті\w*|сегіз\w*|тоғыз\w*|он|жүз\w*|"
    r"жиырма\w*|отыз\w*|қырық\w*|елу\w*|алпыс\w*|жетпіс\w*|сексен\w*|тоқсан\w*|"
    r"мың\w*|жарты\w*|ширек\w*)\b",
    re.IGNORECASE,
)


def validate_narrative(text: str, path: str, *, context: ContextId | None = None):
    if not re.search(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]", text) or re.search(r"[A-Za-z]", text):
        raise StoryRuleError(path, "cyrillic_narrative")
    if any(c.isnumeric() or c in "/=⁄¼½¾⅓⅔%" for c in text):
        raise StoryRuleError(path, "no_numeric_characters_or_math_symbols")
    if NUMBER_WORDS.search(text):
        raise StoryRuleError(path, "no_number_words")
    if context and context != "pizza" and PIZZA_WORD.search(text):
        raise StoryRuleError(path, "use_selected_resource")


def boss_story_prompt(prompt: str) -> str:
    data = json.loads(prompt)
    data["task"] = data["task"].replace("No other fields.", "Use only the fields in the schema.")
    data["dialogue_emotion"] = (
        "Give each panel an emotion field, using neutral, happy, confused, scared, surprised "
        "or angry. Choose the same emotion in both languages. Keep tags out of the dialogue."
    )
    data["boss_design"] = {
        "instructions": (
            "Invent a friendly fantasy challenger who fits the setting and the problem. "
            "Choose a form distinct from the protagonists, especially any student heroes. "
            "Choose the same form and palette for both languages. Write a short localized name, "
            "an introduction for the challenge and a friendly farewell after it. Use Cyrillic, "
            "with no numbers, calculations, solutions or threats in those fields. "
            "The challenger first appears in the exercise scene. Panels before the exercise "
            "are set-up only. When prepared portraits are used, do not describe the challenger "
            "as visible in the artwork."
        ),
        "forms": BOSS_FORMS,
        "palettes": BOSS_PALETTES,
    }
    return json.dumps(data, ensure_ascii=False)


def boss_story_schema(model: type[BossStoryboard]) -> dict:
    schema = model.model_json_schema()
    schema["properties"]["boss_design"] = {"$ref": "#/$defs/BossDesign"}
    schema["required"].append("boss_design")
    for definition in schema["$defs"].values():
        properties = definition.get("properties", {})
        if "emotion" in properties:
            properties["emotion"].pop("default", None)
            definition["required"].append("emotion")
    return schema


def validate_boss_design(story: BossStoryboard, *, required: bool = False):
    design = story.boss_design
    if design is None:
        if required:
            raise StoryRuleError("boss_design", "required_generated_challenger")
        return
    for lang in ("ru", "kk"):
        for field, line in getattr(design, lang).model_dump().items():
            validate_narrative(line, f"boss_design.{lang}.{field}")
    for field in ("introduction", "farewell"):
        if getattr(design.ru, field).casefold() == getattr(design.kk, field).casefold():
            raise StoryRuleError(f"boss_design.kk.{field}", "distinct_translation")


def boss_art_direction(scene: str, design: BossDesign | None) -> str:
    if design is None:
        return ""
    if scene == "question":
        return (
            f" Also show the story challenger, {design.visual()}, "
            "facing the heroes in a friendly math challenge."
        )
    return " Keep this scene to the hero cast only. The story challenger is absent."


def validate_story(
    raw: dict, problem: Problem, *, prepared: bool = False, require_boss: bool = False
) -> Story | PreparedStory:
    story = (PreparedStory if prepared else Story).model_validate(raw)
    validate_boss_design(story, required=require_boss)
    scenes = SCENES if prepared else LIVE_SCENES
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
            if panel.scene != scenes[index]:
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
            validate_narrative(text, path, context=getattr(problem, "context", None))
    for index, (ru, kk) in enumerate(zip(story.ru.panels, story.kk.panels, strict=True)):
        if ru.speaker != kk.speaker:
            raise StoryRuleError(f"kk.panels[{index}].speaker", "same_speaker_across_translations")
        if ru.emotion != kk.emotion:
            raise StoryRuleError(f"kk.panels[{index}].emotion", "same_emotion_across_translations")
        if ru.text == kk.text:
            raise StoryRuleError(f"kk.panels[{index}].text", "distinct_translation")
    if story.ru.title == story.kk.title:
        raise StoryRuleError("kk.title", "distinct_translation")
    return story


def text_prompt(request: JobRequest, problem: Problem, *, prepared: bool = False) -> str:
    context = getattr(problem, "context", None)
    art_direction = (
        " Use only the named cast and align the dialogue with the listed actions. "
        "Before and during the exercise, the friends are still planning. "
        + (
            "In the last two scenes the friends can use the shared resource in their activity."
            if context
            else TOPIC_RESOLUTION[problem.topic]
        )
        + " The resolution may "
        "celebrate the learner's success without stating the answer or any quantity."
    )
    if prepared:
        art_direction = (
            " Use the exact scene and speaker IDs in prepared_panels, in order. "
            "These fixed pictures show the cast outside school, without food or math props. "
            + (
                "Discuss the supplied resource-sharing problem as an imagined situation."
                if context
                else TOPIC_IMAGINED[problem.topic]
            )
            + " Never describe an action, "
            "setting, or object as visible unless the fixed picture description shows it. "
            "Do not claim that the problem is solved."
        )
    return json.dumps(
        {
            "task": (
                f"Write a six-panel child-friendly {TOPIC_NOUN[problem.topic]} comic in "
                "BOTH Russian (ru) and "
                "Kazakh (kk). Use the same speakers and scenes in both languages. "
                "Dialogue should be natural and brief, suited to the grade and difficulty. "
                "Never supply a solution or state any answer, even in words. "
                "Title and dialogue outside panel four must contain NO numbers, numeric words, "
                "fractions, equations, calculations or quantities; use only curiosity, "
                "teamwork, thinking and encouragement. "
                "Copy exercise and both hints VERBATIM from trusted_content, and use exercise "
                "verbatim as panel four text. IDs must be ordered from 1 to 6. "
                "Use the listed scene sequence exactly. No other fields."
                + art_direction
                + (
                    " Invent a reason to share the resource in fraction_context. "
                    "Use the same named resource in both languages and do not replace it."
                    if context
                    else ""
                )
            ),
            "grade": request.grade,
            "difficulty": request.difficulty,
            "requested_language": request.lang,
            "fixed_problem_inputs": problem.to_dict(),
            **({"fraction_context": CONTEXTS[context].art} if context else {}),
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
                else {
                    "characters": CHARACTERS,
                    "speaker_ids": ["aldiyar", "aruna", "pifik"],
                    "scene_actions": contextual_actions(context)
                    if context
                    else TOPIC_SCENES[problem.topic],
                }
            ),
            "scenes": SCENES if prepared else LIVE_SCENES,
            "trusted_content": {
                lang: {"exercise": problem.prompt(lang), "hints": problem.hints(lang)}
                for lang in ("ru", "kk")
            },
        },
        ensure_ascii=False,
    )


def image_prompt(
    scene: str,
    topic: str = "fractions",
    *,
    context: ContextId | None = None,
    boss: BossDesign | None = None,
) -> str:
    # No model-authored text, operands, expected answer, or dialogue reaches image generation.
    actions = contextual_actions(context) if context else TOPIC_SCENES[topic]
    props = RESOURCE_IMAGE_RULE if context else TOPIC_LIVE_PROPS[topic]
    return (
        f"{CHARACTERS}\n{props}\n{actions[scene]}\n"
        "Create a new single full-scene comic illustration showing all three characters. "
        "The reference strip shows Aldiyar on the left, Aruna in the middle and Pifik "
        "on the right. Keep their exact faces, hairstyles, outfits and colors. "
        "Use the strip only for character design. Do not copy its layout or background. "
        "No embedded text, speech bubbles, captions, lettering, logos, digits or symbols. "
        "Do not show portions, visible quantities, distribution or mathematical diagrams. "
        "Do not illustrate an answer." + boss_art_direction(scene, boss)
    )
