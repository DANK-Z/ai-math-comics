# ruff: noqa: E501  (problem texts in two languages are kept on one line each)
"""NIS/BIL prep: a timed mock test of olympiad-style problems with a walkthrough.

A test takes TEST_SIZE problems from the bank (logic, numbers, percents, motion, work, ages,
divisibility) and gives TEST_MINUTES minutes. The answers are checked on the server when the
student hands the test in (or when the time is up), and every problem comes back with the
right answer and a short solution. Past results stay in the history.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from .answers import parse_equation_answer
from .auth import Session, current_student
from .db import MockTest, User
from .schemas import Language

router = APIRouter(prefix="/api")
Student = Annotated[User, Depends(current_student)]

TEST_SIZE = 10
TEST_MINUTES = 25
GRACE = timedelta(seconds=30)

# id: (answer, topic, ru prompt, kk prompt, ru solution, kk solution)
BANK: dict[str, tuple[int, str, str, str, str, str]] = {
    "consecutive": (
        23,
        "numbers",
        "Сумма трёх последовательных натуральных чисел равна 66. Найдите наибольшее из них.",
        "Қатар келген үш натурал санның қосындысы 66-ға тең. Ең үлкенін табыңыз.",
        "Среднее число 66 : 3 = 22, значит числа 21, 22, 23. Наибольшее — 23.",
        "Ортаңғы сан 66 : 3 = 22, демек сандар 21, 22, 23. Ең үлкені — 23.",
    ),
    "discount": (
        600,
        "percent",
        "Товар стоил 800 тенге. Цену снизили на 25%. Сколько тенге стоит товар теперь?",
        "Тауар 800 теңге тұрды. Бағасы 25%-ға төмендеді. Тауар енді неше теңге тұрады?",
        "25% от 800 — это 200. 800 − 200 = 600 тенге.",
        "800-дің 25%-ы — 200. 800 − 200 = 600 теңге.",
    ),
    "meeting": (
        2,
        "motion",
        "Расстояние между велосипедистом и пешеходом 32 км. Они движутся навстречу: велосипедист 12 км/ч, пешеход 4 км/ч. Через сколько часов они встретятся?",
        "Велосипедші мен жаяу жүргіншінің арақашықтығы 32 км. Олар бір-біріне қарсы қозғалады: велосипедші 12 км/сағ, жаяу 4 км/сағ. Неше сағаттан кейін кездеседі?",
        "Скорость сближения 12 + 4 = 16 км/ч. 32 : 16 = 2 часа.",
        "Жақындасу жылдамдығы 12 + 4 = 16 км/сағ. 32 : 16 = 2 сағат.",
    ),
    "pipes": (
        2,
        "work",
        "Первая труба наполняет бассейн за 6 часов, вторая — за 3 часа. За сколько часов они наполнят бассейн вместе?",
        "Бірінші құбыр бассейнді 6 сағатта, екіншісі 3 сағатта толтырады. Екеуі бірге неше сағатта толтырады?",
        "За час вместе: 1/6 + 1/3 = 1/2 бассейна. Значит, весь бассейн — за 2 часа.",
        "Бір сағатта бірге: 1/6 + 1/3 = 1/2 бассейн. Демек, толық бассейн — 2 сағатта.",
    ),
    "ages": (
        6,
        "logic",
        "Отцу 36 лет, сыну 8 лет. Через сколько лет отец будет старше сына в 3 раза?",
        "Әкесі 36 жаста, ұлы 8 жаста. Неше жылдан кейін әкесі ұлынан 3 есе үлкен болады?",
        "Через x лет: 36 + x = 3 · (8 + x), 36 + x = 24 + 3x, 2x = 12, x = 6.",
        "x жылдан кейін: 36 + x = 3 · (8 + x), 36 + x = 24 + 3x, 2x = 12, x = 6.",
    ),
    "sevens": (
        13,
        "divisibility",
        "Сколько двузначных чисел делятся на 7 без остатка?",
        "Неше екі таңбалы сан 7-ге қалдықсыз бөлінеді?",
        "Это 14, 21, …, 98, то есть 7 · 2 … 7 · 14: всего 14 − 2 + 1 = 13 чисел.",
        "Бұлар 14, 21, …, 98, яғни 7 · 2 … 7 · 14: барлығы 14 − 2 + 1 = 13 сан.",
    ),
    "rectangle": (
        50,
        "geometry",
        "Периметр прямоугольника 30 см, а длина в 2 раза больше ширины. Найдите площадь прямоугольника (в см²).",
        "Тіктөртбұрыштың периметрі 30 см, ұзындығы енінен 2 есе артық. Тіктөртбұрыштың ауданын табыңыз (см²).",
        "Ширина w, длина 2w: 2 · (w + 2w) = 30, w = 5, длина 10. Площадь 5 · 10 = 50 см².",
        "Ені w, ұзындығы 2w: 2 · (w + 2w) = 30, w = 5, ұзындығы 10. Ауданы 5 · 10 = 50 см².",
    ),
    "lcm": (
        36,
        "divisibility",
        "Найдите наименьшее натуральное число, которое делится и на 4, и на 6, и на 9.",
        "4-ке де, 6-ға да, 9-ға да бөлінетін ең кіші натурал санды табыңыз.",
        "Это НОК(4; 6; 9) = 2² · 3² = 36.",
        "Бұл ЕКОЕ(4; 6; 9) = 2² · 3² = 36.",
    ),
    "boys": (
        18,
        "percent",
        "В классе 30 учеников, 40% из них — девочки. Сколько в классе мальчиков?",
        "Сыныпта 30 оқушы бар, олардың 40%-ы — қыздар. Сыныпта неше ұл бар?",
        "Девочек 30 · 0,4 = 12, мальчиков 30 − 12 = 18.",
        "Қыздар 30 · 0,4 = 12, ұлдар 30 − 12 = 18.",
    ),
    "increase": (
        60,
        "percent",
        "Число увеличили на 20% и получили 72. Какое число было вначале?",
        "Санды 20%-ға арттырып, 72 алды. Бастапқыда қандай сан болды?",
        "72 — это 120% числа. 72 : 1,2 = 60.",
        "72 — санның 120%-ы. 72 : 1,2 = 60.",
    ),
    "diagonals": (
        9,
        "geometry",
        "Сколько диагоналей у выпуклого шестиугольника?",
        "Дөңес алтыбұрыштың неше диагоналі бар?",
        "Из каждой вершины выходят 3 диагонали: 6 · 3 = 18, но каждая посчитана дважды: 18 : 2 = 9.",
        "Әр төбеден 3 диагональ шығады: 6 · 3 = 18, бірақ әрқайсысы екі рет саналды: 18 : 2 = 9.",
    ),
    "coins": (
        5,
        "logic",
        "У Аружан 12 монет по 5 и по 10 тенге, всего на 85 тенге. Сколько у неё монет по 10 тенге?",
        "Аружанда 5 және 10 теңгелік 12 тиын бар, барлығы 85 теңге. Оның неше 10 теңгелік тиыны бар?",
        "Если бы все 12 были по 5 тенге — 60 тенге. Лишние 25 тенге дают монеты по 10: каждая добавляет 5, значит их 25 : 5 = 5.",
        "Барлық 12 тиын 5 теңгеден болса — 60 теңге. Артық 25 теңгені 10 теңгеліктер береді: әрқайсысы 5 қосады, демек 25 : 5 = 5.",
    ),
    "train": (
        1200,
        "motion",
        "Поезд длиной 300 м проезжает мост длиной 900 м ровно за 1 минуту. Какова скорость поезда в метрах в минуту?",
        "Ұзындығы 300 м пойыз ұзындығы 900 м көпірден дәл 1 минутта өтеді. Пойыздың жылдамдығы минутына неше метр?",
        "Поезд проходит длину моста плюс свою длину: 900 + 300 = 1200 м за минуту.",
        "Пойыз көпір ұзындығы мен өз ұзындығын жүріп өтеді: 900 + 300 = 1200 м минутына.",
    ),
    "remainder": (
        61,
        "divisibility",
        "Найдите наименьшее натуральное число больше 1, которое при делении на 2, 3, 4 и 5 даёт остаток 1.",
        "2-ге, 3-ке, 4-ке және 5-ке бөлгенде 1 қалдық беретін 1-ден үлкен ең кіші натурал санды табыңыз.",
        "Число минус 1 делится на НОК(2; 3; 4; 5) = 60. Наименьшее такое число 60 + 1 = 61.",
        "Сан минус 1 ЕКОЕ(2; 3; 4; 5) = 60-қа бөлінеді. Ең кішісі 60 + 1 = 61.",
    ),
    "divisors": (
        9,
        "divisibility",
        "Сколько натуральных делителей у числа 36?",
        "36 санының неше натурал бөлгіші бар?",
        "1, 2, 3, 4, 6, 9, 12, 18, 36 — всего 9.",
        "1, 2, 3, 4, 6, 9, 12, 18, 36 — барлығы 9.",
    ),
    "fraction-part": (
        24,
        "fractions",
        "3/4 числа равны 27. Чему равны 2/3 этого числа?",
        "Санның 3/4 бөлігі 27-ге тең. Осы санның 2/3 бөлігі неге тең?",
        "Число 27 : 3 · 4 = 36. Его 2/3: 36 : 3 · 2 = 24.",
        "Сан 27 : 3 · 4 = 36. Оның 2/3 бөлігі: 36 : 3 · 2 = 24.",
    ),
    "angles": (
        60,
        "geometry",
        "В треугольнике один угол равен 40°, а второй в 2 раза больше первого. Найдите третий угол (в градусах).",
        "Үшбұрыштың бір бұрышы 40°, ал екіншісі біріншіден 2 есе үлкен. Үшінші бұрышты табыңыз (градуспен).",
        "Второй угол 80°. Сумма углов 180°: 180 − 40 − 80 = 60°.",
        "Екінші бұрыш 80°. Бұрыштар қосындысы 180°: 180 − 40 − 80 = 60°.",
    ),
    "pens": (
        50,
        "logic",
        "Ручка и 2 тетради стоят 170 тенге, а 2 ручки и тетрадь — 160 тенге. Сколько стоит ручка?",
        "Қалам мен 2 дәптер 170 теңге, ал 2 қалам мен дәптер 160 теңге тұрады. Қалам қанша тұрады?",
        "Вместе 3 ручки и 3 тетради стоят 330, значит ручка + тетрадь = 110. Тогда тетрадь 170 − 110 = 60, ручка 110 − 60 = 50.",
        "Бірге 3 қалам мен 3 дәптер 330, демек қалам + дәптер = 110. Онда дәптер 170 − 110 = 60, қалам 110 − 60 = 50.",
    ),
    "last-digit": (
        9,
        "numbers",
        "Какой цифрой оканчивается число 3²⁰²⁶?",
        "3²⁰²⁶ саны қандай цифрмен аяқталады?",
        "Последние цифры степеней 3 повторяются: 3, 9, 7, 1. 2026 при делении на 4 даёт остаток 2 — вторая цифра цикла, 9.",
        "3-тің дәрежелерінің соңғы цифрлары қайталанады: 3, 9, 7, 1. 2026-ны 4-ке бөлгенде қалдық 2 — циклдің екінші цифры, 9.",
    ),
    "seating": (
        24,
        "logic",
        "Сколькими способами можно рассадить 4 друзей на 4 стула в ряд?",
        "4 досты қатардағы 4 орындыққа неше тәсілмен отырғызуға болады?",
        "На первый стул — 4 варианта, на второй — 3, на третий — 2, на последний — 1: 4 · 3 · 2 · 1 = 24.",
        "Бірінші орындыққа — 4 нұсқа, екіншіге — 3, үшіншіге — 2, соңғысына — 1: 4 · 3 · 2 · 1 = 24.",
    ),
    "average": (
        15,
        "numbers",
        "Средний возраст 4 детей — 10 лет. Когда к ним пришёл ещё один ребёнок, средний возраст стал 11 лет. Сколько лет пришедшему?",
        "4 баланың орташа жасы — 10. Оларға тағы бір бала келгенде, орташа жас 11 болды. Келген бала неше жаста?",
        "Сумма возрастов была 4 · 10 = 40, стала 5 · 11 = 55. Пришедшему 55 − 40 = 15 лет.",
        "Жастар қосындысы 4 · 10 = 40 еді, 5 · 11 = 55 болды. Келген бала 55 − 40 = 15 жаста.",
    ),
    "speed-catch": (
        1,
        "motion",
        "Из посёлка вышел пешеход со скоростью 5 км/ч. Через 2 часа за ним выехал велосипедист со скоростью 15 км/ч. Через сколько часов велосипедист догонит пешехода?",
        "Ауылдан 5 км/сағ жылдамдықпен жаяу шықты. 2 сағаттан кейін оның артынан 15 км/сағ жылдамдықпен велосипедші шықты. Велосипедші жаяуды неше сағаттан кейін қуып жетеді?",
        "За 2 часа пешеход ушёл на 10 км. Скорость сближения 15 − 5 = 10 км/ч: 10 : 10 = 1 час.",
        "2 сағатта жаяу 10 км кетті. Жақындасу жылдамдығы 15 − 5 = 10 км/сағ: 10 : 10 = 1 сағат.",
    ),
}


def now() -> datetime:
    return datetime.now(UTC)


def aware(moment: datetime | None) -> datetime | None:
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


class PrepProblem(BaseModel):
    id: str
    topic: str
    prompt: str


class PrepTest(BaseModel):
    id: str
    problems: list[PrepProblem]
    secondsLeft: int
    minutes: int


class Checked(BaseModel):
    id: str
    prompt: str
    yourAnswer: str | None = None
    correct: bool
    answer: int
    solution: str


class PrepResult(BaseModel):
    id: str
    score: int
    total: int
    minutesUsed: int
    problems: list[Checked]


class HistoryItem(BaseModel):
    id: str
    score: int
    total: int
    at: datetime


class SubmitIn(BaseModel):
    model_config = {"extra": "forbid"}

    answers: dict[str, str] = Field(default_factory=dict, max_length=TEST_SIZE)
    lang: Language


def localized(pid: str, lang: str) -> tuple[str, str]:
    answer, topic, ru, kk, sol_ru, sol_kk = BANK[pid]
    return (kk, sol_kk) if lang == "kk" else (ru, sol_ru)


@router.post("/me/prep/tests", response_model=PrepTest, status_code=201)
async def start_test(user: Student, session: Session, lang: Language = "ru"):
    ids = list(BANK)
    picked = [ids.pop(secrets.randbelow(len(ids))) for _ in range(min(TEST_SIZE, len(BANK)))]
    test = MockTest(id=str(uuid.uuid4()), student_id=user.id, problem_ids=picked, started_at=now())
    session.add(test)
    await session.commit()
    return PrepTest(
        id=test.id,
        problems=[
            PrepProblem(id=p, topic=BANK[p][1], prompt=localized(p, lang)[0]) for p in picked
        ],
        secondsLeft=TEST_MINUTES * 60,
        minutes=TEST_MINUTES,
    )


@router.post("/me/prep/tests/{test_id}/submit", response_model=PrepResult)
async def submit_test(test_id: str, body: SubmitIn, user: Student, session: Session):
    test = await session.get(MockTest, test_id)
    if test is None or test.student_id != user.id:
        raise HTTPException(404, "test_not_found")
    if test.finished_at is not None:
        raise HTTPException(409, "already_submitted")
    deadline = aware(test.started_at) + timedelta(minutes=TEST_MINUTES) + GRACE
    late = now() > deadline
    answers = {} if late else {k: v[:32] for k, v in body.answers.items() if k in test.problem_ids}
    checked = []
    for pid in test.problem_ids:
        prompt, solution = localized(pid, body.lang)
        given = answers.get(pid)
        value = parse_equation_answer(given) if given else None
        checked.append(
            Checked(
                id=pid,
                prompt=prompt,
                yourAnswer=given,
                correct=value is not None and value == BANK[pid][0],
                answer=BANK[pid][0],
                solution=solution,
            )
        )
    test.answers = answers
    test.score = sum(c.correct for c in checked)
    test.finished_at = now()
    await session.commit()
    used = (test.finished_at - aware(test.started_at)).total_seconds() / 60
    return PrepResult(
        id=test.id,
        score=test.score,
        total=len(checked),
        minutesUsed=min(TEST_MINUTES, max(1, round(used))),
        problems=checked,
    )


@router.get("/me/prep/history", response_model=list[HistoryItem])
async def history(user: Student, session: Session, response: Response):
    response.headers["Cache-Control"] = "no-store"
    tests = (
        await session.scalars(
            select(MockTest)
            .where(MockTest.student_id == user.id, MockTest.finished_at.is_not(None))
            .order_by(MockTest.finished_at.desc())
            .limit(10)
        )
    ).all()
    return [
        HistoryItem(id=t.id, score=t.score or 0, total=len(t.problem_ids), at=aware(t.finished_at))
        for t in tests
    ]
