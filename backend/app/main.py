"""Pizza demo and durable AI comic job API. Generation runs in app.worker."""

import hmac
import logging
import secrets
from contextlib import asynccontextmanager
from fractions import Fraction
from typing import Annotated, Literal
from weakref import WeakValueDictionary

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .accounts import record_attempt, verify_chapter
from .accounts import router as accounts_router
from .answers import parse_answer, parse_equation_answer
from .assignments import (
    absolute_art,
    accessible_assignment,
    art_token,
    assignment_answer,
    assignment_for_exercise,
    record_assignment_hint,
)
from .assignments import router as assignments_router
from .auth import Session, enforce_generation_limit, lenient_user
from .billing import router as billing_router
from .chapters import router as chapters_router
from .classroom import router as classroom_router
from .config import Settings
from .content import FEEDBACK, HINTS, get_comic
from .daily import router as daily_router
from .db import Database, Role, User, default_database_url
from .family import router as family_router
from .item_lore import router as lore_router
from .lessons import router as lessons_router
from .library_episode import EXERCISE_PREFIX, check_library_answer
from .practice import router as practice_router
from .prepared_art import ART_DIR, PREPARED_FILES
from .roster import router as roster_router
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
from .shop import router as shop_router
from .side_episode import EXERCISE_PREFIX as SIDE_EXERCISE_PREFIX
from .side_episode import check_side_answer
from .storage import Store
from .summary import router as summary_router
from .voice import router as voice_router

# Restrict input to an integer numerator and denominator, allowing spaces and signs.
# No decimal conversion or floating-point comparison is involved.
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


def get_store(request: Request) -> Store:
    return request.app.state.store


logger = logging.getLogger(__name__)
Viewer = Annotated[User | None, Depends(lenient_user)]


def protect_draft(store: Store, user: User | None, *, job_id="", comic_id=""):
    author = store.draft_author(job_id=job_id, comic_id=comic_id)
    if author is not None and (not job_id or user is None or user.id != author):
        raise HTTPException(404, "job_not_found" if job_id else "comic_not_found")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            if settings.require_account_migrations:
                await app.state.database.ensure_schema()
            yield
        finally:
            await app.state.database.dispose()

    app = FastAPI(title="AI Math Comics", version="2.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.lore_locks = WeakValueDictionary()
    app.state.store = Store(settings.data_dir)
    app.state.database = Database(
        settings.database_url or default_database_url(settings.data_dir),
        require_migrations=settings.require_account_migrations,
    )
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
    app.include_router(shop_router)
    app.include_router(assignments_router)
    app.include_router(classroom_router)
    app.include_router(practice_router)
    app.include_router(roster_router)
    app.include_router(lessons_router)
    app.include_router(daily_router)
    app.include_router(summary_router)
    app.include_router(chapters_router)
    app.include_router(family_router)
    app.include_router(billing_router)
    app.include_router(lore_router)
    app.include_router(voice_router)

    @app.post("/api/comic-jobs", status_code=202, response_model=JobAccepted)
    async def create_job(
        body: JobRequest, request: Request, user: Viewer, session: Session
    ) -> JobAccepted:
        await enforce_generation_limit(request, session, user)
        return JobAccepted(jobId=get_store(request).enqueue(body, user.id if user else None))

    @app.post("/api/continuation-jobs", status_code=202, response_model=JobAccepted)
    async def create_continuation(
        body: ContinuationRequest, request: Request, user: Viewer, session: Session
    ) -> JobAccepted:
        await enforce_generation_limit(request, session, user)
        return JobAccepted(jobId=get_store(request).enqueue(body, user.id if user else None))

    @app.post(
        "/api/comic-jobs/{job_id}/resume",
        status_code=202,
        response_model=JobStatus,
        response_model_exclude_unset=True,
    )
    def resume_job(
        job_id: str, body: ResumeJobRequest, request: Request, user: Viewer
    ) -> JobStatus:
        store = get_store(request)
        protect_draft(store, user, job_id=job_id)
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
    def get_job(job_id: str, request: Request, user: Viewer) -> JobStatus:
        store = get_store(request)
        protect_draft(store, user, job_id=job_id)
        job = store.job(job_id)
        if job is None:
            raise HTTPException(404, "job_not_found")
        return job

    @app.get("/api/comics/{comic_id}", response_model=Comic, response_model_exclude_none=True)
    async def get_comic_by_id(
        comic_id: str,
        request: Request,
        session: Session,
        user: Viewer,
        lang: Language = "ru",
    ) -> Comic:
        if comic_id == "pizza-fractions":
            return get_comic(lang)
        store = get_store(request)
        protect_draft(store, user, comic_id=comic_id)
        payload = store.comic(comic_id)
        private_source = None
        if payload is None:
            assignment = await accessible_assignment(session, comic_id, user)
            if assignment is None:
                raise HTTPException(404, "comic_not_found")
            payload = assignment.content
            private_source = assignment.comic_id
        comic = Comic.model_validate(payload[lang])
        return absolute_art(request, comic, private_source)

    @app.get("/api/comic-images/{comic_id}/{panel_id}.png")
    def comic_image(
        comic_id: str,
        panel_id: int,
        request: Request,
        art: str = "",
        layer: Literal["background", "foreground"] | None = None,
    ) -> FileResponse:
        store = get_store(request)
        # Publication in SQLite gates access: incomplete attempts are never served.
        if panel_id not in range(1, 7) or store.comic(comic_id) is None:
            raise HTTPException(404, "image_not_found")
        if store.draft_author(comic_id=comic_id) is not None and (
            len(art) != 64
            or not art.isascii()
            or not hmac.compare_digest(art, art_token(request, comic_id))
        ):
            raise HTTPException(404, "image_not_found")
        filename = f"{panel_id}-{layer}.webp" if layer else f"{panel_id}.png"
        path = store.images_dir / comic_id / filename
        if not path.is_file():
            raise HTTPException(404, "image_not_found")
        return FileResponse(path, media_type="image/webp" if layer else "image/png")

    @app.get("/api/prepared-art/{panel_id}.jpg")
    def prepared_image(panel_id: int) -> FileResponse:
        if not 1 <= panel_id <= len(PREPARED_FILES):
            raise HTTPException(404, "image_not_found")
        path = ART_DIR / PREPARED_FILES[panel_id - 1]
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
        user: Viewer,
    ) -> CheckResponse:
        expected = EXPECTED_ANSWER
        exercise = None
        topic = "equations" if exercise_id.startswith("equations-") else "fractions"
        comic_id = exercise_id.split("-", 1)[-1][:36]
        store = get_store(request)
        assignment = None
        if exercise_id != "pizza-share":
            protect_draft(store, user, comic_id=comic_id)
            assignment = await assignment_for_exercise(session, exercise_id, user)
            if assignment is not None:
                expected = assignment_answer(assignment)
                exercise = {}
            else:
                exercise = store.exercise(exercise_id)
                if exercise is None:
                    raise HTTPException(404, "exercise_not_found")
                if exercise_id.startswith(EXERCISE_PREFIX):
                    return check_library_answer(body, int(exercise["expected"]))
                if exercise_id.startswith(SIDE_EXERCISE_PREFIX):
                    return check_side_answer(body, int(exercise["expected"]))
                expected = Fraction(exercise["expected"])
        value = (
            parse_equation_answer(body.answer) if assignment else parse_answer(body.answer, topic)
        )
        status = "invalid" if value is None else "correct" if value == expected else "incorrect"
        message = FEEDBACK[body.lang][status]
        if topic == "equations" and status != "incorrect":
            message = EQUATION_FEEDBACK[body.lang][status]
        if assignment is not None and status == "incorrect":
            message = {
                "ru": "Пока неверно. Проверь вычисления или попроси подсказку Пифика.",
                "kk": "Әзірге дұрыс емес. Есебіңді тексер немесе Пификтен кеңес сұра.",
            }[body.lang]
        elif exercise_id != "pizza-share" and status == "incorrect":
            message = INCORRECT[topic][body.lang]
        reward = None
        if exercise_id == "pizza-share" and status == "correct" and user is not None:
            if user.role == Role.student:
                await verify_chapter(session, user, "pizza-fractions")
        if user is not None and user.role == Role.student and exercise is not None:
            # Teacher analytics and, once every boss round is solved, coins and stars.
            reward = await record_attempt(
                session,
                user,
                exercise_id,
                exercise.get("skill"),
                status,
                body.answer,
                [exercise_id] if assignment else store.comic_exercises(comic_id),
            )
        return CheckResponse(status=status, message=message, reward=reward)

    @app.get("/api/exercises/{exercise_id}/hints", response_model=HintResponse)
    async def exercise_hint(
        exercise_id: str,
        request: Request,
        session: Session,
        user: Viewer,
        lang: Language = "ru",
        step: Annotated[int, Query(ge=1, le=2)] = 1,
    ) -> HintResponse:
        if exercise_id == "pizza-share":
            text = HINTS[lang][step]
        else:
            store = get_store(request)
            protect_draft(store, user, comic_id=exercise_id.partition("-")[2][:36])
            assignment = await assignment_for_exercise(session, exercise_id, user)
            if assignment is not None:
                if user is not None and user.role == Role.student:
                    await record_assignment_hint(session, assignment, user, step)
                text = assignment.content["hints"][lang][step - 1]
            else:
                exercise = store.exercise(exercise_id)
                if exercise is None:
                    raise HTTPException(404, "exercise_not_found")
                text = exercise["hints"][lang][step - 1]
        return HintResponse(step=step, text=text, hasMore=step == 1)

    return app


app = create_app()
