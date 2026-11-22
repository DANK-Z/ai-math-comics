"""Trusted fraction templates. The model never chooses operands or the answer."""

import secrets
from dataclasses import dataclass
from fractions import Fraction

from .schemas import JobRequest, Language


@dataclass(frozen=True)
class Problem:
    portions: tuple[str, ...]
    friends: int
    topic = "fractions"  # class constant, not a dataclass field

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


EQUATION_KINDS = ("add", "sub", "mul", "div", "mul_add", "mul_sub")


@dataclass(frozen=True)
class EquationProblem:
    """Equations: find x (a positive whole number) in a server-chosen linear equation."""

    kind: str
    a: int
    b: int
    c: int = 0
    topic = "equations"  # class constant, not a dataclass field

    @property
    def expected(self) -> Fraction:
        a, b, c = self.a, self.b, self.c
        value = {
            "add": Fraction(b - a),
            "sub": Fraction(b + a),
            "mul": Fraction(b, a),
            "div": Fraction(b * a),
            "mul_add": Fraction(c - b, a),
            "mul_sub": Fraction(c + b, a),
        }[self.kind]
        if value.denominator != 1 or value <= 0:
            raise ValueError("Equation must have a positive whole-number answer")
        return value

    @property
    def equation(self) -> str:
        a, b, c = self.a, self.b, self.c
        return {
            "add": f"x + {a} = {b}",
            "sub": f"x − {a} = {b}",
            "mul": f"{a} · x = {b}",
            "div": f"x : {a} = {b}",
            "mul_add": f"{a} · x + {b} = {c}",
            "mul_sub": f"{a} · x − {b} = {c}",
        }[self.kind]

    def to_dict(self) -> dict:
        return {"kind": self.kind, "a": self.a, "b": self.b, "c": self.c}

    @classmethod
    def from_dict(cls, data: dict):
        if data["kind"] not in EQUATION_KINDS:
            raise ValueError("Unknown equation kind")
        problem = cls(data["kind"], int(data["a"]), int(data["b"]), int(data.get("c", 0)))
        _ = problem.expected  # validates stored operands
        return problem

    def prompt(self, lang: Language) -> str:
        if lang == "ru":
            return (
                f"Реши уравнение-загадку: {self.equation}. Чему равен x? Запиши ответ целым числом."
            )
        return f"Теңдеу-жұмбақты шеш: {self.equation}. x неге тең? Жауабыңды бүтін санмен жаз."

    def hints(self, lang: Language) -> list[str]:
        return EQUATION_HINTS[lang][self.kind]


EQUATION_HINTS: dict[str, dict[str, list[str]]] = {
    "ru": {
        "add": [
            "Здесь x — неизвестное слагаемое. Чтобы его найти, из суммы вычти известное слагаемое.",
            "Вычисли разность и проверь себя: подставь найденное число вместо x в уравнение.",
        ],
        "sub": [
            "Здесь x — неизвестное уменьшаемое. Чтобы его найти, к разности прибавь вычитаемое.",
            "Вычисли сумму и проверь себя: подставь найденное число вместо x в уравнение.",
        ],
        "mul": [
            "Здесь x — неизвестный множитель. Чтобы его найти, раздели произведение на "
            "известный множитель.",
            "Вычисли частное и проверь себя: умножь найденное число на известный множитель.",
        ],
        "div": [
            "Здесь x — неизвестное делимое. Чтобы его найти, умножь частное на делитель.",
            "Вычисли произведение и проверь себя: раздели найденное число на делитель.",
        ],
        "mul_add": [
            "Сначала найди произведение с x: вычти прибавленное число из правой части.",
            "Теперь x — неизвестный множитель: раздели полученное число на множитель перед x.",
        ],
        "mul_sub": [
            "Сначала найди произведение с x: прибавь вычтенное число к правой части.",
            "Теперь x — неизвестный множитель: раздели полученное число на множитель перед x.",
        ],
    },
    "kk": {
        "add": [
            "Мұнда x — белгісіз қосылғыш. Оны табу үшін қосындыдан белгілі қосылғышты азайт.",
            "Айырманы есептеп, өзіңді тексер: табылған санды теңдеудегі x орнына қой.",
        ],
        "sub": [
            "Мұнда x — белгісіз азайғыш. Оны табу үшін айырмаға азайтқышты қос.",
            "Қосындыны есептеп, өзіңді тексер: табылған санды теңдеудегі x орнына қой.",
        ],
        "mul": [
            "Мұнда x — белгісіз көбейткіш. Оны табу үшін көбейтіндіні белгілі көбейткішке бөл.",
            "Бөліндіні есептеп, өзіңді тексер: табылған санды белгілі көбейткішке көбейт.",
        ],
        "div": [
            "Мұнда x — белгісіз бөлінгіш. Оны табу үшін бөліндіні бөлгішке көбейт.",
            "Көбейтіндіні есептеп, өзіңді тексер: табылған санды бөлгішке бөл.",
        ],
        "mul_add": [
            "Алдымен x бар көбейтіндіні тап: қосылған санды оң жақтан азайт.",
            "Енді x — белгісіз көбейткіш: шыққан санды x алдындағы көбейткішке бөл.",
        ],
        "mul_sub": [
            "Алдымен x бар көбейтіндіні тап: азайтылған санды оң жаққа қос.",
            "Енді x — белгісіз көбейткіш: шыққан санды x алдындағы көбейткішке бөл.",
        ],
    },
}


def _pick(low: int, high: int) -> int:
    return low + secrets.randbelow(high - low + 1)


def choose_equation(request: JobRequest) -> EquationProblem:
    big = request.grade == 6
    if request.difficulty == "basic":
        x, a = (_pick(25, 99), _pick(15, 80)) if big else (_pick(8, 40), _pick(5, 30))
        if secrets.randbelow(2) and x > a:
            return EquationProblem("sub", a, x - a)
        return EquationProblem("add", a, x + a)
    if request.difficulty == "intermediate":
        a, x = (_pick(6, 15), _pick(7, 25)) if big else (_pick(3, 9), _pick(4, 12))
        if secrets.randbelow(2):
            return EquationProblem("mul", a, a * x)
        return EquationProblem("div", a, x)
    a, x = (_pick(3, 9), _pick(4, 15)) if big else (_pick(2, 6), _pick(3, 12))
    if big and secrets.randbelow(2):
        b = _pick(2, a * x - 1)
        return EquationProblem("mul_sub", a, b, a * x - b)
    b = _pick(2, 40 if big else 20)
    return EquationProblem("mul_add", a, b, a * x + b)


def problem_from_dict(data: dict) -> "Problem | EquationProblem":
    """Stored job inputs -> the trusted problem (equations carry a "kind")."""
    return EquationProblem.from_dict(data) if "kind" in data else Problem.from_dict(data)


def choose_problem(request: JobRequest) -> "Problem | EquationProblem":
    return choose_equation(request) if request.topic == "equations" else choose_fraction(request)


def boss_rounds(request: JobRequest, main, count: int = 2) -> list:
    """Extra server-owned problems for the boss fight, different from the main one."""
    rounds = []
    seen = {main.prompt("ru")}
    for _ in range(60):
        if len(rounds) == count:
            break
        candidate = choose_problem(request)
        if candidate.prompt("ru") not in seen:
            seen.add(candidate.prompt("ru"))
            rounds.append(candidate)
    while len(rounds) < count:  # tiny template pools: repeat rather than fail the comic
        rounds.append(choose_problem(request))
    return rounds


def choose_fraction(request: JobRequest) -> Problem:
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
