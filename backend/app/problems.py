"""Trusted fraction templates. The model never chooses operands or the answer."""

import secrets
from dataclasses import dataclass
from fractions import Fraction

from .schemas import JobRequest, Language


@dataclass(frozen=True)
class Problem:
    portions: tuple[str, ...]
    friends: int

    @property
    def expected(self) -> Fraction:
        return sum((Fraction(p) for p in self.portions), Fraction()) / self.friends

    def to_dict(self) -> dict:
        # Only operands, never the computed answer, are sent to the text provider.
        return {"portions": list(self.portions), "friends": self.friends}

    @classmethod
    def from_dict(cls, data: dict):
        return cls(tuple(data["portions"]), data["friends"])

    def prompt(self, lang: Language) -> str:
        amount = " + ".join(self.portions)
        if lang == "ru":
            return (
                f"Есть пицца в количестве {amount} (в целых пиццах). "
                f"Её делят поровну между друзьями; число друзей: {self.friends}. "
                "Какую долю целой пиццы получит каждый? Запиши ответ дробью."
            )
        return (
            f"Пицца мөлшері: {amount} (бүтін пиццамен өлшенген). "
            f"Оны достар тең бөліседі; достар саны: {self.friends}. "
            "Әр досқа бүтін пиццаның қандай үлесі тиеді? Жауабыңды бөлшек түрінде жаз."
        )

    def hints(self, lang: Language) -> list[str]:
        if lang == "ru":
            first = (
                "Сначала сложи указанные количества пиццы, приведя дроби к общему знаменателю."
                if len(self.portions) > 1
                else "Определи общее количество пиццы. Вспомни, что означает равное деление."
            )
            return [
                first,
                "Раздели общее количество пиццы на число друзей: умножь на дробь, "
                "у которой в числителе единица, а в знаменателе число друзей. Сократи результат.",
            ]
        first = (
            "Алдымен бөлшектерді ортақ бөлімге келтіріп, берілген пицца мөлшерлерін қос."
            if len(self.portions) > 1
            else "Пиццаның жалпы мөлшерін анықта. Тең бөлудің мағынасын еске түсір."
        )
        return [
            first,
            "Пиццаның жалпы мөлшерін достар санына бөл: алымы бір, бөлімі достар саны "
            "болатын бөлшекке көбейт. Нәтижені қысқарт.",
        ]


def choose_problem(request: JobRequest) -> Problem:
    if request.difficulty == "basic":
        portions = (str(secrets.choice((1, 2) if request.grade == 5 else (2, 3))),)
    elif request.difficulty == "intermediate":
        portions = (secrets.choice(("2/3", "3/4") if request.grade == 5 else ("5/6", "7/8")),)
    else:
        portions = secrets.choice(
            (("1/2", "1/3"), ("3/4", "1/2"))
            if request.grade == 5
            else (("5/6", "3/8"), ("7/8", "2/3"))
        )
    return Problem(portions, secrets.choice((3, 4, 5, 6)))
