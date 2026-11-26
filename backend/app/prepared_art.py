"""Bundled portraits for prepared panels and live character references."""

import io
from functools import lru_cache

from PIL import Image, ImageOps

from .config import BACKEND_DIR

ART_DIR = BACKEND_DIR.parent / "frontend" / "public" / "mock-images"
PREPARED_PANELS = (
    ("pifik", "pifik.jpg", "Pifik, a robot in a graduation cap, winks outside the school. Greet."),
    ("aruna", "aruna.jpg", "Aruna, with a star hair clip, smiles outside. Introduce fair sharing."),
    (
        "aldiyar",
        "aldiyar.jpg",
        "Aldiyar, wearing headphones outdoors, raises a fist. Show enthusiasm.",
    ),
    ("pifik", "pifik-close.jpg", "Close-up of Pifik winking. Present the exercise."),
    ("aruna", "aruna-close.jpg", "Close-up of Aruna smiling. Encourage careful thinking."),
    ("aldiyar", "aldiyar-close.jpg", "Close-up of Aldiyar smiling. Encourage the reader."),
)
PREPARED_SPEAKERS = {"pifik": "Пифик", "aruna": "Аруна", "aldiyar": "Алдияр"}
# Portraits of the extra «Моя история» heroes, served after the six panels (ids 7-10).
HERO_PORTRAITS = ("timur.jpg", "timur-close.jpg", "dana.jpg", "dana-close.jpg")
PREPARED_FILES = tuple(file for _, file, _ in PREPARED_PANELS) + HERO_PORTRAITS


@lru_cache(maxsize=1)
def live_cast_reference() -> bytes:
    """An unlabeled reference strip ordered Aldiyar, Aruna, Pifik."""
    tile = (320, 240)
    strip = Image.new("RGB", (tile[0] * 3, tile[1]))
    for index, name in enumerate(("aldiyar", "aruna", "pifik")):
        with Image.open(ART_DIR / f"{name}.jpg") as portrait:
            strip.paste(ImageOps.fit(portrait.convert("RGB"), tile), (index * tile[0], 0))
    output = io.BytesIO()
    strip.save(output, "PNG")
    return output.getvalue()
