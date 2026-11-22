"""Pizza demo and durable AI comic job API. Generation runs in app.worker."""

import re
from fractions import Fraction
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import Settings
from .content import FEEDBACK, HINTS, get_comic
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


def get_store(request: Request) -> Store:
    return request.app.state.store


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="AI Math Comics", version="2.0.0")
    app.state.store = Store(settings.data_dir)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

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

    @app.post("/api/exercises/{exercise_id}/check", response_model=CheckResponse)
    def check_answer(exercise_id: str, body: CheckRequest, request: Request) -> CheckResponse:
        expected = EXPECTED_ANSWER
        if exercise_id != "pizza-share":
            exercise = get_store(request).exercise(exercise_id)
            if exercise is None:
                raise HTTPException(404, "exercise_not_found")
            if exercise_id.startswith(EXERCISE_PREFIX):
                return check_library_answer(body, int(exercise["expected"]))
            expected = Fraction(exercise["expected"])
        match = FRACTION_PATTERN.fullmatch(body.answer.strip())
        status = "invalid"
        if match is not None:
            numerator, denominator = map(int, match.groups())
            if denominator != 0:
                status = "correct" if Fraction(numerator, denominator) == expected else "incorrect"
        message = FEEDBACK[body.lang][status]
        if exercise_id != "pizza-share" and status == "incorrect":
            message = {
                "ru": "Пока неверно. Проверь общее количество пиццы и число друзей. "
                "При необходимости воспользуйся подсказкой.",
                "kk": "Әзірге дұрыс емес. Пиццаның жалпы мөлшері мен достар санын тексер. "
                "Қажет болса, кеңесті пайдалан.",
            }[body.lang]
        return CheckResponse(status=status, message=message)

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
