"""FastAPI endpoints for the six-panel pizza fractions demo."""

import re
from fractions import Fraction
from typing import Annotated

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .content import FEEDBACK, HINTS, get_comic
from .schemas import CheckRequest, CheckResponse, Comic, HintResponse, Language

app = FastAPI(title="AI Math Comics Demo", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Restrict input to an integer numerator and denominator, allowing spaces and signs.
# No decimal conversion or floating-point comparison is involved.
FRACTION_PATTERN = re.compile(r"([+-]?[0-9]+)\s*/\s*([+-]?[0-9]+)")
EXPECTED_ANSWER = Fraction(3, 4)


@app.get("/api/comics/pizza-fractions", response_model=Comic)
def pizza_comic(lang: Language = "ru") -> Comic:
    return get_comic(lang)


@app.post("/api/exercises/pizza-share/check", response_model=CheckResponse)
def check_answer(request: CheckRequest) -> CheckResponse:
    match = FRACTION_PATTERN.fullmatch(request.answer.strip())
    if match is None:
        return CheckResponse(status="invalid", message=FEEDBACK[request.lang]["invalid"])

    numerator, denominator = map(int, match.groups())
    if denominator == 0:
        return CheckResponse(status="invalid", message=FEEDBACK[request.lang]["invalid"])

    status = "correct" if Fraction(numerator, denominator) == EXPECTED_ANSWER else "incorrect"
    return CheckResponse(status=status, message=FEEDBACK[request.lang][status])


@app.get("/api/exercises/pizza-share/hints", response_model=HintResponse)
def pizza_hint(
    lang: Language = "ru",
    step: Annotated[int, Query(ge=1, le=2)] = 1,
) -> HintResponse:
    return HintResponse(step=step, text=HINTS[lang][step], hasMore=step == 1)
