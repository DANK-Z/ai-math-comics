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

Topic = Literal["fractions", "equations", "gcd", "decimals", "parts"]
TOPICS: tuple[str, ...] = ("fractions", "equations", "gcd", "decimals", "parts")
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
    # Battles stored before the "type" tag: the generator's dicts.
    return Generated(problem_from_dict(data), "equations" if "kind" in data else "fractions")


def check(problem, answer: str) -> Literal["correct", "incorrect", "invalid"]:
    value = parse_equation_answer(answer)
    if value is None:
        return "invalid"
    return "correct" if value == problem.expected else "incorrect"


def answer_format(topic: str) -> Literal["fraction", "decimal", "whole-number"]:
    return {"fractions": "fraction", "decimals": "decimal"}.get(topic, "whole-number")


# ---- solo review -------------------------------------------------------------------------

PRACTICE_LENGTH = 5
FRACTION_SKILLS = {"whole": "fractions", "part": "fractions", "sum": "fractions"}


class PracticeTaskOut(BaseModel):
    id: str
    topic: Topic
    prompt: str
    answerFormat: Literal["fraction", "decimal", "whole-number"]
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
    problem = make_problem(topic, grade, skill=skill)
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
