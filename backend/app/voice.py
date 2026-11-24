"""On-demand local recognition and conservative normalization of short spoken answers."""

import asyncio
import io
import re
import wave
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException, Request

from .answers import parse_equation_answer
from .schemas import Language

router = APIRouter(prefix="/api/voice")
AnswerKind = Literal["equation", "fraction"]
RATE = 16_000
MAX_FRAMES = RATE * 8
MAX_BYTES = MAX_FRAMES * 2 + 1024
INFERENCE = Lock()
MODEL_FILES = ("config.json", "model.bin", "tokenizer.json")

RU = {
    word: value
    for value, words in (
        (0, "ноль нулю"),
        (1, "один одна одному"),
        (2, "два две двум"),
        (3, "три трем"),
        (4, "четыре четырем"),
        (5, "пять пяти"),
        (6, "шесть шести"),
        (7, "семь семи"),
        (8, "восемь восьми"),
        (9, "девять девяти"),
        (10, "десять десяти"),
        (11, "одиннадцать одиннадцати"),
        (12, "двенадцать двенадцати"),
        (13, "тринадцать тринадцати"),
        (14, "четырнадцать четырнадцати"),
        (15, "пятнадцать пятнадцати"),
        (16, "шестнадцать шестнадцати"),
        (17, "семнадцать семнадцати"),
        (18, "восемнадцать восемнадцати"),
        (19, "девятнадцать девятнадцати"),
        (20, "двадцать двадцати"),
        (30, "тридцать тридцати"),
        (40, "сорок сорока"),
        (50, "пятьдесят пятидесяти"),
        (60, "шестьдесят шестидесяти"),
        (70, "семьдесят семидесяти"),
        (80, "восемьдесят восьмидесяти"),
        (90, "девяносто девяноста"),
        (100, "сто ста"),
        (200, "двести двумстам"),
        (300, "триста тремстам"),
        (400, "четыреста четыремстам"),
        (500, "пятьсот пятистам"),
        (600, "шестьсот шестистам"),
        (700, "семьсот семистам"),
        (800, "восемьсот восьмистам"),
        (900, "девятьсот девятистам"),
    )
    for word in words.split()
}
KK = {
    word: value
    for value, word in enumerate("нөл бір екі үш төрт бес алты жеті сегіз тоғыз он".split())
} | dict(zip("жиырма отыз қырық елу алпыс жетпіс сексен тоқсан".split(), range(20, 100, 10)))
RU_DENOMINATORS = {
    form: denominator
    for denominator, forms in enumerate(
        (
            "вторая вторых",
            "третья третьих",
            "четвертая четвертых",
            "пятая пятых",
            "шестая шестых",
            "седьмая седьмых",
            "восьмая восьмых",
            "девятая девятых",
            "десятая десятых",
        ),
        2,
    )
    for form in forms.split()
}


def number(text: str, lang: Language) -> int | None:
    negative = text.startswith("минус ")
    text = text.removeprefix("минус ")
    if not text:
        return None
    if lang == "kk":
        text = re.sub(r"-?(?:ға|ге|қа|ке)$", "", text)
    if re.fullmatch(r"[+-]?[0-9]{1,8}", text):
        if negative and text[0] in "+-":
            return None
        return int(text) * (-1 if negative else 1)
    words = text.split()
    if not words:
        return None
    values = RU if lang == "ru" else KK
    total = 0
    rank = 1000
    if lang == "kk" and "жүз" in words:
        before, after = words[: words.index("жүз")], words[words.index("жүз") + 1 :]
        if len(before) > 1 or (before and not 1 <= values.get(before[0], 0) <= 9):
            return None
        total = 100 * (values[before[0]] if before else 1)
        rank, words = 100, after
    if total and words in (["нөл"], ["ноль"]):
        return None
    for word in words:
        value = values.get(word)
        if value is None or (value == 0 and (total or len(words) > 1)):
            return None
        place = 100 if value >= 100 else 10 if value >= 10 else 1
        if place >= rank:
            return None
        total += value
        rank = 1 if 11 <= value <= 19 else place
    return -total if negative else total


def spoken_answer(transcript: str, lang: Language, kind: AnswerKind) -> str | None:
    text = " ".join(transcript.lower().replace("ё", "е").replace("−", "-").split())
    text = text.strip(" .!?")
    if not text or len(text) > 160:
        return None
    text = re.sub(r"^(?:ответ|жауап|жауабым)\s*:?\s+", "", text)
    if kind == "equation":
        if parse_equation_answer(text) is not None:
            return text
        text = re.sub(r"^(?:икс|икc|[xх])\s*(?:равен|равно|тең|мәні|=)?\s*", "", text)
        text = re.sub(r"\s+тең$", "", text)
        value = number(text, lang)
        return f"x = {value}" if value is not None else None
    direct = re.fullmatch(r"[+-]?[0-9]+\s*/\s*[+-]?[0-9]+", text)
    if direct and parse_equation_answer(text) is not None:
        return text
    division = re.fullmatch(r"(.+?) (?:делить на|на|бөлу) (.+)", text)
    numerator = denominator = None
    if division:
        numerator, denominator = (number(part, lang) for part in division.groups())
    elif lang == "ru":
        prefix, _, ending = text.rpartition(" ")
        numerator, denominator = number(prefix, lang), RU_DENOMINATORS.get(ending)
    else:
        fraction = re.fullmatch(r"(.+?)(?:-?[дтн][ае]н) (.+)", text)
        if fraction:
            denominator, numerator = (number(part, lang) for part in fraction.groups())
    if numerator is not None and denominator:
        return f"{numerator}/{denominator}"
    return None


@lru_cache(maxsize=1)
def voice_engine(path: Path):
    from faster_whisper import WhisperModel

    return WhisperModel(
        str(path), device="cpu", compute_type="int8", cpu_threads=2, local_files_only=True
    )


def transcribe(path: Path, samples: bytes, lang: Language) -> str:
    import numpy as np

    if not INFERENCE.acquire(blocking=False):
        raise HTTPException(429, "voice_busy")
    try:
        audio = np.frombuffer(samples, dtype="<i2").astype(np.float32) / 32768
        segments, _ = voice_engine(path).transcribe(
            audio,
            language=lang,
            beam_size=3,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return " ".join(segment.text for segment in segments if segment.no_speech_prob < 0.6)
    finally:
        INFERENCE.release()


def read_audio(data: bytearray) -> bytes:
    try:
        with wave.open(io.BytesIO(data), "rb") as signal:
            frames = signal.getnframes()
            if (signal.getnchannels(), signal.getsampwidth(), signal.getframerate()) != (
                1,
                2,
                RATE,
            ) or not RATE // 4 <= frames <= MAX_FRAMES:
                raise ValueError
            samples = signal.readframes(frames)
            if len(samples) != frames * 2:
                raise ValueError
            return samples
    except (EOFError, ValueError, wave.Error):
        raise HTTPException(422, "invalid_voice_audio") from None


def available(path: Path | None) -> bool:
    return path is not None and all((path / filename).is_file() for filename in MODEL_FILES)


@router.get("")
def voice_status(request: Request) -> dict[str, bool]:
    return {"enabled": available(request.app.state.settings.voice_model)}


@router.post("/{lang}")
async def recognize(lang: Language, kind: AnswerKind, request: Request) -> dict[str, str]:
    path = request.app.state.settings.voice_model
    if not available(path):
        raise HTTPException(503, "voice_unavailable")
    if request.headers.get("content-type", "").split(";")[0] != "audio/wav":
        raise HTTPException(415, "invalid_voice_audio")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "voice_audio_too_large")
        data.extend(chunk)
    samples = read_audio(data)
    try:
        transcript = await asyncio.wait_for(asyncio.to_thread(transcribe, path, samples, lang), 15)
    except HTTPException:
        raise
    except TimeoutError:
        raise HTTPException(504, "voice_timeout") from None
    except Exception:
        raise HTTPException(503, "voice_unavailable") from None
    answer = spoken_answer(transcript, lang, kind)
    if answer is None:
        raise HTTPException(422, "voice_unclear")
    return {"answer": answer}
