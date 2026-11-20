"""Server-owned branch context, equation and fixed library panel sequence."""

import json
import re
import secrets
from dataclasses import dataclass

from pydantic import Field

from .schemas import (
    CheckRequest,
    CheckResponse,
    Comic,
    ContinuationContext,
    ContinuationRequest,
    Exercise,
    Language,
    Panel,
)
from .story import StoryRuleError, StrictModel, validate_narrative

CONTEXT = ContinuationContext(
    sourceChapterId="school-quest-map",
    choiceId="library-cabinet-key",
    nextChapterId="library-boxes",
)
EXERCISE_PREFIX = "library-episode-"
BOXES = 3
LOOSE_BOOKS = 6  # The prepared illustration shows two stacks of three.
SPEAKERS = ("Алдияр", "Аруна", "Пифик", "Алдияр")
NARRATION = {
    "ru": (
        "Ключ из конверта открыл библиотечный шкаф.",
        "В шкафу нашлись три одинаковые коробки. Теперь они на столе.",
    ),
    "kk": (
        "Конверттегі кілт кітапхана шкафын ашты.",
        "Шкафтан бірдей үш қорап табылды. Енді олар үстелдің үстінде.",
    ),
}
HINT_STEPS = {
    "ru": (
        "Вычти из общего количества книги, которые лежат рядом с коробками.",
        "Раздели оставшееся количество поровну между коробками.",
    ),
    "kk": (
        "Жалпы саннан қораптардың жанында жатқан кітаптарды шегер.",
        "Қалған кітаптарды қораптарға тең бөліп есепте.",
    ),
}
FEEDBACK = {
    "ru": {
        "correct": "Верно! Ты нашёл число книг в каждой коробке.",
        "incorrect": "Пока неверно. Проверь уравнение или попроси Пифика о подсказке.",
        "invalid": "Запиши количество книг целым числом.",
    },
    "kk": {
        "correct": "Дұрыс! Әр қораптағы кітап санын таптың.",
        "incorrect": "Әзірге дұрыс емес. Теңдеуді тексер немесе Пификтен кеңес сұра.",
        "invalid": "Кітап санын бүтін санмен жаз.",
    },
}


@dataclass(frozen=True)
class LibraryProblem:
    total: int

    @classmethod
    def choose(cls):
        # Vary the number inside the closed boxes and keep the pictured loose books fixed.
        return cls(BOXES * (5 + secrets.randbelow(8)) + LOOSE_BOOKS)

    @property
    def expected(self) -> int:
        return (self.total - LOOSE_BOOKS) // BOXES

    def to_dict(self) -> dict:
        return {"total": self.total}

    def prompt(self, lang: Language) -> str:
        equation = f"{BOXES} × □ + {LOOSE_BOOKS} = {self.total}"
        if lang == "ru":
            return (
                f"В трёх одинаковых коробках поровну книг. Ещё {LOOSE_BOOKS} книг лежат "
                f"рядом. Всего {self.total} книг. Реши уравнение {equation}. "
                "Сколько книг в каждой коробке? Запиши ответ числом."
            )
        return (
            f"Бірдей үш қораптағы кітап саны тең. Жанында тағы {LOOSE_BOOKS} кітап жатыр. "
            f"Барлығы {self.total} кітап. {equation} теңдеуін шеш. "
            "Әр қорапта неше кітап бар? Жауабыңды санмен жаз."
        )


class LibraryText(StrictModel):
    title: str = Field(min_length=1, max_length=72)
    arrival: str = Field(min_length=1, max_length=160)
    discovery: str = Field(min_length=1, max_length=160)
    question: str = Field(min_length=1, max_length=160)
    ending: str = Field(min_length=1, max_length=160)
    firstHint: str = Field(min_length=1, max_length=160)
    secondHint: str = Field(min_length=1, max_length=160)


class LibraryStory(StrictModel):
    ru: LibraryText
    kk: LibraryText


def validate_library_story(raw: dict) -> LibraryStory:
    story = LibraryStory.model_validate(raw)
    for lang in ("ru", "kk"):
        localized = getattr(story, lang)
        for field, text in localized.model_dump().items():
            path = f"{lang}.{field}"
            if text.strip() != text or not text:
                raise StoryRuleError(path, "trimmed_nonempty_text")
            # The Russian word for "matching" shares a prefix with the word for "one".
            narrative = re.sub(r"\bодинаков[а-яё]*\b", "равные", text, flags=re.IGNORECASE)
            validate_narrative(narrative, path)
            other = story.kk if lang == "ru" else story.ru
            if lang == "ru" and text.casefold() == getattr(other, field).casefold():
                raise StoryRuleError(f"kk.{field}", "distinct_translation")
        if localized.firstHint.casefold() == localized.secondHint.casefold():
            raise StoryRuleError(f"{lang}.secondHint", "distinct_hint")
    return story


def library_prompt(request: ContinuationRequest, problem: LibraryProblem) -> str:
    return json.dumps(
        {
            "task": (
                "Write a short child-friendly school fair episode in Russian and Kazakh. "
                "Use natural localized dialogue and different text for each language. "
                "Write one brief sentence per field (title is just a few words). "
                "Use Cyrillic. Do not use digits, number words, equations, math symbols, "
                "quantities, Latin letters, or the answer in any field. "
                "The app displays the equation and the two required math instructions itself. "
                "For firstHint and secondHint write two different helpful Pifik clues about "
                "the pictured objects that lead into the corresponding math instruction. "
                "Do not repeat the instructions or add any math operations. "
                "Never invent props, people, quantities, a different destination or an ending "
                "for the canonical season. The cabinet opening happened off-screen."
            ),
            "branch": CONTEXT.model_dump(),
            "requested_language": request.locale,
            "fixed_problem_inputs": {
                "boxes": BOXES,
                "loose_books": LOOSE_BOOKS,
                "total_books": problem.total,
            },
            "story": (
                "The yellow backpack holds the fair map. Aruna found the library cabinet key "
                "in the route envelope. The key opened the cabinet and revealed matching "
                "closed boxes of books, which the friends brought to the table."
            ),
            "illustrations_in_order": {
                "arrival": "Aldiyar speaks. Outside the library, Aruna holds the envelope.",
                "discovery": "Aruna speaks. Closed matching boxes and loose books on the table.",
                "question": "Pifik speaks. The friends think in front of a closed box.",
                "ending": "Aldiyar speaks. A box is open and the friends pack books, smiling.",
            },
            "hints": {
                "firstHint": "Focus attention on the loose books beside the boxes.",
                "secondHint": "Focus attention on how the boxes match.",
            },
        },
        ensure_ascii=False,
    )


def episode_payload(comic_id: str, story: LibraryStory, problem: LibraryProblem):
    payload = {}
    hints = {}
    for lang in ("ru", "kk"):
        text = getattr(story, lang)
        opening, discovery = NARRATION[lang]
        dialogue = (
            f"{opening} {text.arrival}",
            f"{discovery} {text.discovery}",
            text.question,
            text.ending,
        )
        comic = Comic(
            id=comic_id,
            lang=lang,
            title=text.title,
            artwork="prepared",
            continuation=CONTEXT,
            panels=[
                Panel(id=i, imageKey=f"{CONTEXT.nextChapterId}-{i}", speaker=speaker, text=line)
                for i, (speaker, line) in enumerate(zip(SPEAKERS, dialogue, strict=True), 1)
            ],
            exercise=Exercise(
                id=f"{EXERCISE_PREFIX}{comic_id}",
                panelId=3,
                prompt=problem.prompt(lang),
                answerFormat="whole-number",
            ),
        )
        payload[lang] = comic.model_dump()
        hints[lang] = [
            f"{lead} {instruction}"
            for lead, instruction in zip(
                (text.firstHint, text.secondHint), HINT_STEPS[lang], strict=True
            )
        ]
    return payload, hints


WHOLE_NUMBER = re.compile(r"(?:[0-9]+|[0-9]{1,3}(?:[ \u00a0\u202f][0-9]{3})+)")


def check_library_answer(body: CheckRequest, expected: int) -> CheckResponse:
    answer = body.answer.strip()
    if WHOLE_NUMBER.fullmatch(answer) is None:
        status = "invalid"
    else:
        value = int(re.sub(r"[ \u00a0\u202f]", "", answer))
        status = "correct" if value == expected else "incorrect"
    return CheckResponse(status=status, message=FEEDBACK[body.lang][status])
