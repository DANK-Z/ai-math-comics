"""Practice problems for class battles and solo review, chosen and checked on the server.

Topics: the generator's fractions and equations, plus three grade 5–6 topics that have no
comics yet: GCD/LCM, decimal fractions and problems on parts (ratio). A problem is stored as a
small dict (``{"type": ..., ...}``) so a task keeps its numbers and the answer never leaves the
server. Review: ``/api/me/practice`` gives a signed-in student short drills; ``weak`` points to
the skill the student most often got wrong in boss fights over the last two weeks.
"""

import math
import secrets
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from fractions import Fraction
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from .answers import parse_equation_answer
from .auth import Session, current_student
from .db import AnalyticsLog, PracticeTask, User
from .problems import EquationProblem, Problem, choose_problem, problem_from_dict
from .schemas import JobRequest, Language

Topic = Literal[
    "fractions",
    "equations",
    "gcd",
    "decimals",
    "parts",
    "addfractions",
    "negatives",
    "linear",
    "decimalops",
]
TOPICS: tuple[str, ...] = (
    "fractions",
    "equations",
    "gcd",
    "decimals",
    "parts",
    "addfractions",
    "negatives",
    "linear",
    "decimalops",
)
# The daily task keeps to the first five topics: the newer ones are partly grade 6 only.
DAILY_TOPICS: tuple[str, ...] = TOPICS[:5]
# The newer topics fill textbook gaps (grade 5: § 21–25, § 35–41; grade 6: § 9–31);
# difficulty picks their step: basic, intermediate, advanced.
STEPPED_TOPICS = frozenset(TOPICS[5:])
STEPS = ("basic", "basic", "intermediate", "intermediate", "advanced")
AnswerFormat = Literal["fraction", "decimal", "whole-number", "signed"]
Difficulty = Literal["basic", "intermediate", "advanced"]

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]


def _pick(low: int, high: int) -> int:
    return low + secrets.randbelow(high - low + 1)


@dataclass(frozen=True)
class GcdProblem:
    kind: str  # gcd | lcm
    a: int
    b: int
    type = "gcd"

    @property
    def expected(self) -> Fraction:
        value = math.gcd(self.a, self.b) if self.kind == "gcd" else math.lcm(self.a, self.b)
        return Fraction(value)

    def prompt(self, lang: Language) -> str:
        if self.kind == "gcd":
            return {
                "ru": f"Найди наибольший общий делитель чисел {self.a} и {self.b}: "
                f"НОД({self.a}; {self.b}).",
                "kk": f"{self.a} және {self.b} сандарының ең үлкен ортақ бөлгішін тап: "
                f"ЕҮОБ({self.a}; {self.b}).",
            }[lang]
        return {
            "ru": f"Найди наименьшее общее кратное чисел {self.a} и {self.b}: "
            f"НОК({self.a}; {self.b}).",
            "kk": f"{self.a} және {self.b} сандарының ең кіші ортақ еселігін тап: "
            f"ЕКОЕ({self.a}; {self.b}).",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


@dataclass(frozen=True)
class DecimalProblem:
    kind: str  # add | sub | mul
    a: int  # tenths
    b: int  # tenths, or a whole factor for mul
    type = "decimals"

    @property
    def expected(self) -> Fraction:
        a = Fraction(self.a, 10)
        if self.kind == "mul":
            return a * self.b
        b = Fraction(self.b, 10)
        return a + b if self.kind == "add" else a - b

    @staticmethod
    def _show(tenths: int, lang: Language) -> str:
        return f"{tenths // 10},{tenths % 10}"

    def prompt(self, lang: Language) -> str:
        a = self._show(self.a, lang)
        if self.kind == "mul":
            expr = f"{a} · {self.b}"
        else:
            expr = f"{a} {'+' if self.kind == 'add' else '−'} {self._show(self.b, lang)}"
        return {
            "ru": f"Вычисли: {expr}. Запиши ответ десятичной дробью, например 4,2.",
            "kk": f"Есепте: {expr}. Жауапты ондық бөлшекпен жаз, мысалы 4,2.",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


@dataclass(frozen=True)
class PartsProblem:
    total: int
    left: int  # ratio left : right
    right: int
    ask_bigger: bool
    type = "parts"

    @property
    def expected(self) -> Fraction:
        part = Fraction(self.total, self.left + self.right)
        return part * (
            max(self.left, self.right) if self.ask_bigger else min(self.left, self.right)
        )

    def prompt(self, lang: Language) -> str:
        which = {
            "ru": "большей" if self.ask_bigger else "меньшей",
            "kk": "үлкен" if self.ask_bigger else "кіші",
        }
        return {
            "ru": f"Ленту длиной {self.total} см разрезали на две части "
            f"в отношении {self.left} : {self.right}. "
            f"Какова длина {which['ru']} части в сантиметрах?",
            "kk": f"Ұзындығы {self.total} см таспаны {self.left} : {self.right} "
            "қатынасында екі бөлікке кесті. "
            f"{which['kk'].capitalize()} бөліктің ұзындығы неше сантиметр?",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


def _frac(value: Fraction) -> str:
    """3/8, 2 1/3 or 5 — the way it is printed in the textbook."""
    if value.denominator == 1:
        return str(value.numerator)
    whole, rest = divmod(value.numerator, value.denominator)
    return f"{whole} {rest}/{value.denominator}" if whole else f"{rest}/{value.denominator}"


def _dec(value: Fraction) -> str:
    """A finite decimal with a comma: 4,25; a minus sign for negatives."""
    sign = "−" if value < 0 else ""
    value = abs(value)
    whole = value.numerator // value.denominator
    rest = value - whole
    digits = ""
    while rest and len(digits) < 4:
        rest *= 10
        digit = rest.numerator // rest.denominator
        digits += str(digit)
        rest -= digit
    return f"{sign}{whole},{digits}" if digits else f"{sign}{whole}"


def _signed(value: Fraction, first: bool) -> str:
    """−7 at the start of an expression, (−7) after an operation sign."""
    text = _dec(value)
    return f"({text})" if value < 0 and not first else text


@dataclass(frozen=True)
class FractionSumProblem:
    """Adding and subtracting common fractions and mixed numbers (grade 5, § 21–25)."""

    kind: str  # add | sub
    a: str  # "3/8" or "2 1/3" (stored as text: exact and readable)
    b: str
    type = "addfractions"

    @staticmethod
    def _value(text: str) -> Fraction:
        whole, _, frac = text.rpartition(" ")
        return Fraction(int(whole or 0)) + Fraction(frac)

    @property
    def expected(self) -> Fraction:
        a, b = self._value(self.a), self._value(self.b)
        return a + b if self.kind == "add" else a - b

    def prompt(self, lang: Language) -> str:
        expr = f"{self.a} {'+' if self.kind == 'add' else '−'} {self.b}"
        return {
            "ru": f"Вычисли: {expr}. Запиши ответ дробью (например 5/8) "
            "или смешанным числом (например 1 1/2).",
            "kk": f"Есепте: {expr}. Жауапты бөлшекпен (мысалы 5/8) "
            "немесе аралас санмен (мысалы 1 1/2) жаз.",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


@dataclass(frozen=True)
class SignedProblem:
    """Operations with positive and negative numbers (grade 6, § 9–21)."""

    kind: str  # add | sub | mul | div | mix
    a: str  # exact decimal text: "-7", "2.5"
    b: str
    c: str = "0"  # the third number of a «mix» expression a + b · c
    type = "negatives"

    @property
    def expected(self) -> Fraction:
        a, b, c = Fraction(self.a), Fraction(self.b), Fraction(self.c)
        return {"add": a + b, "sub": a - b, "mul": a * b, "div": a / b, "mix": a + b * c}[self.kind]

    def prompt(self, lang: Language) -> str:
        a, b, c = Fraction(self.a), Fraction(self.b), Fraction(self.c)
        sign = {"add": "+", "sub": "−", "mul": "·", "div": ":"}
        if self.kind == "mix":
            expr = f"{_signed(a, True)} + {_signed(b, False)} · {_signed(c, False)}"
        else:
            expr = f"{_signed(a, True)} {sign[self.kind]} {_signed(b, False)}"
        return {
            "ru": f"Вычисли: {expr}. Не забудь про знак ответа.",
            "kk": f"Есепте: {expr}. Жауаптың таңбасын ұмытпа.",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


@dataclass(frozen=True)
class LinearProblem:
    """A linear equation a·x + b = c·x + d or a·(x + b) = d with a whole root (grade 6, § 27–31)."""

    a: int
    b: int
    c: int
    d: int
    brackets: bool = False
    type = "linear"

    @property
    def expected(self) -> Fraction:
        if self.brackets:
            return Fraction(self.d, self.a) - self.b
        return Fraction(self.d - self.b, self.a - self.c)

    @staticmethod
    def _side(k: int, free: int) -> str:
        x = "x" if k == 1 else f"{k}x"
        if free == 0:
            return x
        return f"{x} {'+' if free > 0 else '−'} {abs(free)}"

    def prompt(self, lang: Language) -> str:
        if self.brackets:
            inner = f"x {'+' if self.b > 0 else '−'} {abs(self.b)}"
            equation = f"{self.a}({inner}) = {_dec(Fraction(self.d))}"
        else:
            right = self._side(self.c, self.d) if self.c else _dec(Fraction(self.d))
            equation = f"{self._side(self.a, self.b)} = {right}"
        return {
            "ru": f"Реши уравнение: {equation}. Чему равен x?",
            "kk": f"Теңдеуді шеш: {equation}. x неге тең?",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


@dataclass(frozen=True)
class DecimalOpsProblem:
    """Multiplying, dividing and rounding decimals (grade 5, § 35–41)."""

    kind: str  # mul | div | shift | round
    a: str
    b: str
    type = "decimalops"

    @property
    def expected(self) -> Fraction:
        a, b = Fraction(self.a), Fraction(self.b)
        if self.kind == "round":  # b is the step: 0.1 or 0.01
            steps = a / b
            return (steps.numerator * 2 + steps.denominator) // (2 * steps.denominator) * b
        return {"mul": a * b, "div": a / b, "shift": a * b}[self.kind]

    def prompt(self, lang: Language) -> str:
        a, b = _dec(Fraction(self.a)), _dec(Fraction(self.b))
        if self.kind == "round":
            to = (
                {"ru": "до десятых", "kk": "ондыққа дейін"}
                if self.b == "0.1"
                else {"ru": "до сотых", "kk": "жүздікке дейін"}
            )
            return {
                "ru": f"Округли число {a} {to['ru']}.",
                "kk": f"{a} санын {to['kk']} дөңгелекте.",
            }[lang]
        expr = f"{a} {':' if self.kind == 'div' else '·'} {b}"
        return {
            "ru": f"Вычисли: {expr}. Запиши ответ десятичной дробью, например 4,2.",
            "kk": f"Есепте: {expr}. Жауапты ондық бөлшекпен жаз, мысалы 4,2.",
        }[lang]

    def stored(self) -> dict:
        return {"type": self.type} | asdict(self)


def _fraction_sum(grade: int, difficulty: str) -> FractionSumProblem:
    kind = secrets.choice(("add", "sub"))
    if difficulty == "basic":
        d = secrets.choice((5, 7, 8, 9, 11, 12))
        x, y = _pick(1, d - 1), _pick(1, d - 1)
        a, b = Fraction(x, d), Fraction(y, d)
    else:
        d1, d2 = secrets.choice(
            ((2, 3), (3, 4), (4, 6), (2, 5), (3, 5), (4, 5), (6, 8), (5, 6), (3, 8), (4, 10))
        )
        a, b = Fraction(_pick(1, d1 - 1), d1), Fraction(_pick(1, d2 - 1), d2)
        if difficulty == "advanced":
            a += _pick(1, 4)
            b += _pick(1, 3)
    if kind == "sub" and b > a:
        a, b = b, a
    if kind == "sub" and a == b:
        kind = "add"

    def text(v: Fraction) -> str:
        # Keep the fraction as written in the task: 2/4 stays readable as 1/2.
        return _frac(v)

    return FractionSumProblem(kind, text(a), text(b))


def _signed_problem(grade: int, difficulty: str) -> SignedProblem:
    def n(low: int, high: int) -> int:
        value = _pick(low, high)
        return -value if secrets.randbelow(2) else value

    def pair(low: int, high: int) -> tuple[int, int]:
        # At least one of the two is negative: the topic is about signs.
        a, b = n(low, high), n(low, high)
        return (a, b) if a < 0 or b < 0 else (-a, b) if secrets.randbelow(2) else (a, -b)

    if difficulty == "basic":
        kind = secrets.choice(("add", "sub"))
        a, b = pair(2, 20)
        return SignedProblem(kind, str(a), str(b))
    if difficulty == "intermediate":
        kind = secrets.choice(("mul", "div"))
        x, y = pair(2, 9)
        return (
            SignedProblem(kind, str(x * y), str(y))
            if kind == "div"
            else SignedProblem(kind, str(x), str(y))
        )
    if secrets.randbelow(2):
        a, b = Fraction(n(11, 89), 10), Fraction(n(11, 89), 10)
        return SignedProblem(secrets.choice(("add", "sub")), str(float(a)), str(float(b)))
    return SignedProblem("mix", str(n(2, 15)), str(n(2, 6)), str(n(2, 6)))


def _linear(grade: int, difficulty: str) -> LinearProblem:
    x = 0
    while x == 0:
        x = _pick(-9, 12)
    if difficulty == "basic":
        a = _pick(2, 9)
        b = _pick(-20, 20)
        return LinearProblem(a, b, 0, a * x + b)
    if difficulty == "intermediate":
        a = _pick(3, 9)
        b = 0
        while b == 0:
            b = _pick(-9, 9)
        return LinearProblem(a, b, 0, a * (x + b), brackets=True)
    a, c = _pick(3, 9), _pick(1, 8)
    while c == a:
        c = _pick(1, 8)
    b = _pick(-15, 15)
    return LinearProblem(a, b, c, a * x + b - c * x)


def _decimal_ops(grade: int, difficulty: str) -> DecimalOpsProblem:
    kind = secrets.choice(
        ("mul", "div", "shift", "round") if difficulty != "basic" else ("mul", "shift", "round")
    )
    if kind == "mul":
        a = Fraction(_pick(11, 99), 10)
        b = Fraction(_pick(2, 9), 10 if difficulty == "advanced" else 1)
        return DecimalOpsProblem("mul", str(float(a)), str(float(b)))
    if kind == "div":
        q = Fraction(_pick(11, 99), 10)
        b = Fraction(_pick(2, 9), 10) if difficulty == "advanced" else Fraction(_pick(2, 9))
        return DecimalOpsProblem("div", str(float(q * b)), str(float(b)))
    if kind == "shift":
        a = Fraction(_pick(101, 9999), 100)
        b = secrets.choice(("10", "100", "1000", "0.1", "0.01"))
        return DecimalOpsProblem("shift", str(float(a)), b)
    a = Fraction(_pick(1001, 99999), 1000)
    return DecimalOpsProblem("round", str(float(a)), secrets.choice(("0.1", "0.01")))


@dataclass(frozen=True)
class Generated:
    """The comic generator's fraction or equation problem, tagged for storage."""

    inner: Problem | EquationProblem
    type: str

    @property
    def expected(self) -> Fraction:
        return self.inner.expected

    def prompt(self, lang: Language) -> str:
        return self.inner.prompt(lang)

    def stored(self) -> dict:
        inputs = getattr(self.inner, "stored_inputs", None)
        return {"type": self.type, "problem": inputs() if inputs else self.inner.to_dict()}


EQUATION_SKILLS = ("add", "sub", "mul", "div", "mul_add", "mul_sub")


def make_problem(topic: str, grade: int, difficulty: str = "basic", skill: str | None = None):
    grade = min(6, max(5, grade))
    big = grade == 6
    if topic in ("fractions", "equations"):
        request = JobRequest(grade=grade, topic=topic, lang="ru", difficulty=difficulty)
        for _ in range(40):
            problem = choose_problem(request)
            if not skill or getattr(problem, "skill", None) == skill:
                break
        return Generated(problem, topic)
    if topic == "gcd":
        base = secrets.choice((2, 3, 4, 5, 6) if not big else (3, 4, 6, 8, 9))
        a, b = base * _pick(2, 6), base * _pick(2, 7)
        while a == b:
            b = base * _pick(2, 7)
        return GcdProblem("gcd" if secrets.randbelow(2) else "lcm", a, b)
    if topic == "decimals":
        kind = secrets.choice(("add", "sub", "mul"))
        if kind == "mul":
            return DecimalProblem("mul", _pick(11, 49 if big else 29), _pick(2, 6 if big else 4))
        a, b = _pick(15, 99 if big else 59), _pick(11, 49 if big else 39)
        if kind == "sub" and b >= a:
            a, b = b, a
        if kind == "sub" and a == b:
            a += 7
        return DecimalProblem(kind, a, b)
    if topic == "parts":
        left, right = secrets.choice(((1, 2), (2, 3), (3, 4), (1, 3), (3, 5), (2, 5)))
        total = (left + right) * _pick(3, 12 if big else 8)
        return PartsProblem(total, left, right, bool(secrets.randbelow(2)))
    if topic == "addfractions":
        return _fraction_sum(grade, difficulty)
    if topic == "negatives":
        return _signed_problem(grade, difficulty)
    if topic == "linear":
        return _linear(grade, difficulty)
    if topic == "decimalops":
        return _decimal_ops(grade, difficulty)
    raise ValueError(f"unknown topic {topic}")


def from_stored(data: dict):
    kind = data.get("type")
    if kind in ("fractions", "equations"):
        return Generated(problem_from_dict(data["problem"]), kind)
    fields = {k: v for k, v in data.items() if k != "type"}
    if kind == "gcd":
        return GcdProblem(**fields)
    if kind == "decimals":
        return DecimalProblem(**fields)
    if kind == "parts":
        return PartsProblem(**fields)
    if kind == "addfractions":
        return FractionSumProblem(**fields)
    if kind == "negatives":
        return SignedProblem(**fields)
    if kind == "linear":
        return LinearProblem(**fields)
    if kind == "decimalops":
        return DecimalOpsProblem(**fields)
    # Battles stored before the "type" tag: the generator's dicts.
    return Generated(problem_from_dict(data), "equations" if "kind" in data else "fractions")


def check(problem, answer: str) -> Literal["correct", "incorrect", "invalid"]:
    value = parse_equation_answer(answer)
    if value is None:
        return "invalid"
    return "correct" if value == problem.expected else "incorrect"


def answer_format(topic: str) -> AnswerFormat:
    return {
        "fractions": "fraction",
        "addfractions": "fraction",
        "decimals": "decimal",
        "decimalops": "decimal",
        "negatives": "signed",
        "linear": "signed",
    }.get(topic, "whole-number")


# ---- solo review -------------------------------------------------------------------------

PRACTICE_LENGTH = 5
FRACTION_SKILLS = {"whole": "fractions", "part": "fractions", "sum": "fractions"}


class PracticeTaskOut(BaseModel):
    id: str
    topic: Topic
    prompt: str
    answerFormat: AnswerFormat
    number: int
    total: int


class PracticeStart(BaseModel):
    model_config = {"extra": "forbid"}

    topic: Topic
    skill: str | None = Field(default=None, max_length=20)
    lang: Language


class PracticeAnswer(BaseModel):
    model_config = {"extra": "forbid"}

    taskId: str = Field(min_length=1, max_length=36)
    answer: str = Field(max_length=64)
    lang: Language


class PracticeResult(BaseModel):
    status: Literal["correct", "incorrect", "invalid"]
    message: str
    solved: int
    total: int
    next: PracticeTaskOut | None = None


class WeakSpot(BaseModel):
    topic: Topic
    skill: str
    mistakes: int


FEEDBACK = {
    "ru": {
        "correct": "Верно! Следующая задача.",
        "done": "Верно! Тренировка пройдена — тема закреплена.",
        "incorrect": "Пока неверно. Проверь вычисления и попробуй ещё раз.",
        "invalid": "Запиши ответ числом или дробью, например 12, 3/4 или 4,2.",
    },
    "kk": {
        "correct": "Дұрыс! Келесі есеп.",
        "done": "Дұрыс! Жаттығу аяқталды — тақырып бекітілді.",
        "incorrect": "Әзірге дұрыс емес. Есебіңді тексеріп, қайта көр.",
        "invalid": "Жауапты санмен немесе бөлшекпен жаз, мысалы 12, 3/4 немесе 4,2.",
    },
}


def task_out(task: PracticeTask, lang: Language) -> PracticeTaskOut:
    return PracticeTaskOut(
        id=task.id,
        topic=task.topic,
        prompt=from_stored(task.problem).prompt(lang),
        answerFormat=answer_format(task.topic),
        number=task.number,
        total=PRACTICE_LENGTH,
    )


async def new_task(session, user: User, topic: str, skill: str | None, number: int, run: str):
    grade = 5
    if user.class_id:
        from .db import SchoolClass

        school_class = await session.get(SchoolClass, user.class_id)
        grade = school_class.grade if school_class else 5
    # The newer topics climb in a five-problem drill: two basic, two intermediate, one advanced.
    step = STEPS[min(max(number, 1), len(STEPS)) - 1] if topic in STEPPED_TOPICS else "basic"
    problem = make_problem(topic, grade, step, skill=skill)
    task = PracticeTask(
        id=str(uuid.uuid4()),
        run_id=run,
        student_id=user.id,
        topic=topic,
        skill=skill,
        number=number,
        problem=problem.stored(),
        created_at=datetime.now(UTC),
    )
    session.add(task)
    await session.flush()
    return task


@router.post("/me/practice", response_model=PracticeTaskOut)
async def start_practice(body: PracticeStart, user: Student, session: Session):
    task = await new_task(session, user, body.topic, body.skill, 1, str(uuid.uuid4()))
    await session.commit()
    return task_out(task, body.lang)


@router.post("/me/practice/answer", response_model=PracticeResult)
async def answer_practice(body: PracticeAnswer, user: Student, session: Session):
    task = await session.get(PracticeTask, body.taskId)
    if task is None or task.student_id != user.id or task.run_id.startswith("daily-"):
        raise HTTPException(404, "task_not_found")  # the daily task has its own endpoint
    copy = FEEDBACK[body.lang]
    if task.solved_at is not None:
        raise HTTPException(409, "task_solved")
    status = check(from_stored(task.problem), body.answer)
    if status != "correct":
        return PracticeResult(
            status=status,
            message=copy[status],
            solved=task.number - 1,
            total=PRACTICE_LENGTH,
            next=task_out(task, body.lang),
        )
    task.solved_at = datetime.now(UTC)
    following = None
    if task.number < PRACTICE_LENGTH:
        following = await new_task(
            session, user, task.topic, task.skill, task.number + 1, task.run_id
        )
    await session.commit()
    return PracticeResult(
        status="correct",
        message=copy["correct" if following else "done"],
        solved=task.number,
        total=PRACTICE_LENGTH,
        next=task_out(following, body.lang) if following else None,
    )


@router.get("/me/practice/weak", response_model=WeakSpot | None)
async def weak_spot(user: Student, session: Session, response: Response):
    """The skill the student missed most in the last 14 days of boss fights (at least twice)."""
    response.headers["Cache-Control"] = "no-store"
    since = datetime.now(UTC) - timedelta(days=14)
    row = (
        await session.execute(
            select(AnalyticsLog.topic, AnalyticsLog.skill, func.count())
            .where(
                AnalyticsLog.student_id == user.id,
                AnalyticsLog.status == "incorrect",
                AnalyticsLog.created_at >= since,
                AnalyticsLog.skill.is_not(None),
            )
            .group_by(AnalyticsLog.topic, AnalyticsLog.skill)
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()
    if row is None or row[2] < 2 or row[0] not in ("fractions", "equations"):
        return None
    return WeakSpot(topic=row[0], skill=row[1], mistakes=row[2])
