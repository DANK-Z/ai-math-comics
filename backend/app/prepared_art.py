"""The six dialogue-free character portraits already bundled with the frontend."""

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
