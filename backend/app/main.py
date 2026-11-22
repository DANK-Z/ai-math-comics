"""Pizza demo and durable AI comic job API. Generation runs in app.worker."""

import logging
import re
import secrets
from contextlib import asynccontextmanager
from fractions import Fraction
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .accounts import record_attempt
from .accounts import router as accounts_router
from .answers import parse_equation_answer
from .auth import Session, lenient_user
from .config import Settings
from .content import FEEDBACK, HINTS, get_comic
from .db import Database, Role, User, default_database_url
from .library_episode import EXERCISE_PREFIX, check_library_answer
from .prepared_art import ART_DIR, PREPARED_PANELS
from .schemas import (
    CheckRequest,
    CheckResponse,
    Comic,
    ContinuationRequest,
    HintResponse,
    JobAccepted,
    JobRequest,
    JobStatus,
    Language,
    ResumeJobRequest,
)
from .storage import Store

# Restrict input to an integer numerator and denominator, allowing spaces and signs.
# No decimal conversion or floating-point comparison is involved.
FRACTION_PATTERN = re.compile(r"([+-]?[0-9]+)\s*/\s*([+-]?[0-9]+)")
EXPECTED_ANSWER = Fraction(3, 4)
EQUATION_FEEDBACK = {
    "ru": {
        "correct": "Верно! Ты нашёл x — равенство выполняется. Отличная работа!",
        "invalid": "Запиши значение x числом: например 12, 12,0 или x = 12.",
    },
    "kk": {
        "correct": "Дұрыс! Сен x-ті таптың — теңдік орындалады. Жарайсың!",
        "invalid": "x мәнін санмен жаз: мысалы 12, 12,0 немесе x = 12.",
    },
}
INCORRECT = {
    "fractions": {
        "ru": "Пока неверно. Проверь общее количество пиццы и число друзей. "
        "При необходимости воспользуйся подсказкой.",
        "kk": "Әзірге дұрыс емес. Пиццаның жалпы мөлшері мен достар санын тексер. "
        "Қажет болса, кеңесті пайдалан.",
    },
    "equations": {
        "ru": "Пока неверно. Подставь своё число вместо x и проверь, выполняется ли равенство. "
        "При необходимости воспользуйся подсказкой.",
        "kk": "Әзірге дұрыс емес. Санды x орнына қойып, теңдік орындала ма, тексер. "
        "Қажет болса, кеңесті пайдалан.",
    },
}


def parse_answer(answer: str, topic: str) -> Fraction | None:
    """Fractions accept a/b; equations accept x = 3, 3, 3.0 … (see answers.py). Exact math."""
    answer = answer.strip()
    if topic == "equations":
        return parse_equation_answer(answer)
    match = FRACTION_PATTERN.fullmatch(answer)
    if match is None:
        return None
    numerator, denominator = map(int, match.groups())
    return None if denominator == 0 else Fraction(numerator, denominator)


def get_store(request: Request) -> Store:
    return request.app.state.store


logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await app.state.database.dispose()

    app = FastAPI(title="AI Math Comics", version="2.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.store = Store(settings.data_dir)
    app.state.database = Database(settings.database_url or default_database_url(settings.data_dir))
    app.state.jwt_secret = settings.jwt_secret
    if not app.state.jwt_secret:
        # Tokens then stop working after a restart; set JWT_SECRET in backend/.env.
        logger.warning("JWT_SECRET is not set; using a random secret for this process")
        app.state.jwt_secret = secrets.token_urlsafe(32)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(accounts_router)

    @app.post("/api/comic-jobs", status_code=202, response_model=JobAccepted)
    def create_job(body: JobRequest, request: Request) -> JobAccepted:
        return JobAccepted(jobId=get_store(request).enqueue(body))

    @app.post("/api/continuation-jobs", status_code=202, response_model=JobAccepted)
    def create_continuation(body: ContinuationRequest, request: Request) -> JobAccepted:
        return JobAccepted(jobId=get_store(request).enqueue(body))

    @app.post(
        "/api/comic-jobs/{job_id}/resume",
        status_code=202,
        response_model=JobStatus,
        response_model_exclude_unset=True,
    )
    def resume_job(job_id: str, body: ResumeJobRequest, request: Request) -> JobStatus:
        store = get_store(request)
        accepted = settings.art_mode == "live" and store.resume(job_id, body.resumeToken)
        job = store.job(job_id)
        if job is None:
            raise HTTPException(404, "job_not_found")
        if settings.art_mode != "live" or (not accepted and job.status != "ready"):
            raise HTTPException(409, "job_not_resumable")
        return job

    @app.get(
        "/api/comic-jobs/{job_id}", response_model=JobStatus, response_model_exclude_unset=True
    )
    def get_job(job_id: str, request: Request) -> JobStatus:
        job = get_store(request).job(job_id)
        if job is None:
            raise HTTPException(404, "job_not_found")
        return job

    @app.get("/api/comics/{comic_id}", response_model=Comic, response_model_exclude_none=True)
    def get_comic_by_id(comic_id: str, request: Request, lang: Language = "ru") -> Comic:
        if comic_id == "pizza-fractions":
            return get_comic(lang)
        payload = get_store(request).comic(comic_id)
        if payload is None:
            raise HTTPException(404, "comic_not_found")
        comic = Comic.model_validate(payload[lang])
        for panel in comic.panels:
            if panel.imageUrl is not None:
                panel.imageUrl = f"{settings.public_base_url.rstrip('/')}{panel.imageUrl}"
        return comic

    @app.get("/api/comic-images/{comic_id}/{panel_id}.png")
    def comic_image(comic_id: str, panel_id: int, request: Request) -> FileResponse:
        store = get_store(request)
        # Publication in SQLite gates access: incomplete attempts are never served.
        if panel_id not in range(1, 7) or store.comic(comic_id) is None:
            raise HTTPException(404, "image_not_found")
        path = store.images_dir / comic_id / f"{panel_id}.png"
        if not path.is_file():
            raise HTTPException(404, "image_not_found")
        return FileResponse(path, media_type="image/png")

    @app.get("/api/prepared-art/{panel_id}.jpg")
    def prepared_image(panel_id: int) -> FileResponse:
        if not 1 <= panel_id <= len(PREPARED_PANELS):
            raise HTTPException(404, "image_not_found")
        path = ART_DIR / PREPARED_PANELS[panel_id - 1][1]
        if not path.is_file():
            raise HTTPException(404, "image_not_found")
        return FileResponse(path, media_type="image/jpeg")

    @app.post(
        "/api/exercises/{exercise_id}/check",
        response_model=CheckResponse,
        response_model_exclude_none=True,
    )
    async def check_answer(
        exercise_id: str,
        body: CheckRequest,
        request: Request,
        session: Session,
        user: Annotated[User | None, Depends(lenient_user)],
    ) -> CheckResponse:
        expected = EXPECTED_ANSWER
        exercise = None
        topic = "equations" if exercise_id.startswith("equations-") else "fractions"
        if exercise_id != "pizza-share":
            exercise = get_store(request).exercise(exercise_id)
            if exercise is None:
                raise HTTPException(404, "exercise_not_found")
            if exercise_id.startswith(EXERCISE_PREFIX):
                return check_library_answer(body, int(exercise["expected"]))
            expected = Fraction(exercise["expected"])
        value = parse_answer(body.answer, topic)
        status = "invalid" if value is None else "correct" if value == expected else "incorrect"
        message = FEEDBACK[body.lang][status]
        if topic == "equations" and status != "incorrect":
            message = EQUATION_FEEDBACK[body.lang][status]
        if exercise_id != "pizza-share" and status == "incorrect":
            message = INCORRECT[topic][body.lang]
        reward = None
        if user is not None and user.role == Role.student and exercise is not None:
            # Teacher analytics and, once every boss round is solved, coins and stars.
            reward = await record_attempt(
                session,
                user,
                exercise_id,
                exercise.get("skill"),
                status,
                body.answer,
                get_store(request).comic_exercises(exercise_id.split("-", 1)[1][:36]),
            )
        return CheckResponse(status=status, message=message, reward=reward)

    @app.get("/api/exercises/{exercise_id}/hints", response_model=HintResponse)
    def exercise_hint(
        exercise_id: str,
        request: Request,
        lang: Language = "ru",
        step: Annotated[int, Query(ge=1, le=2)] = 1,
    ) -> HintResponse:
        if exercise_id == "pizza-share":
            text = HINTS[lang][step]
        else:
            exercise = get_store(request).exercise(exercise_id)
            if exercise is None:
                raise HTTPException(404, "exercise_not_found")
            text = exercise["hints"][lang][step - 1]
        return HintResponse(step=step, text=text, hasMore=step == 1)

    return app


app = create_app()
