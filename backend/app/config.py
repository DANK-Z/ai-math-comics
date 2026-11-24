"""Server-only configuration shared by the API and standalone worker."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    data_dir: Path = BACKEND_DIR / "data"
    public_base_url: str = "http://127.0.0.1:8000"
    api_key: str = field(default="", repr=False)
    api_base_url: str = "https://api.openai.com/v1"
    text_model: str = "gpt-6-luna"
    text_reasoning_effort: str | None = "none"
    image_model: str = "gpt-image-2.5-flare"
    provider: Literal["openai", "gemini"] = "openai"
    art_mode: Literal["live", "prepared"] = "live"
    depth_model: Path | None = None
    voice_model: Path | None = None
    gemini_api_key: str = field(default="", repr=False)
    gemini_text_model: str = "gemini-3.8-flash"
    gemini_image_model: str = "gemini-3.1-flash-image"
    provider_timeout: float = 180
    job_timeout: float = 1500
    poll_interval: float = 1
    text_attempts: int = 3
    # Accounts DB; empty = data/accounts.sqlite3. PostgreSQL: see docker-compose.yml.
    database_url: str = field(default="", repr=False)
    require_account_migrations: bool = False
    jwt_secret: str = field(default="", repr=False)
    jwt_hours: float = 12
    # Story cache (app/story_cache.py). Off unless enabled; from_env enables it by default.
    story_cache: bool = False
    redis_url: str = field(default="", repr=False)
    cache_variants: int = 1
    semantic_threshold: float = 0.92
    embedding_model: str = ""
    # Daily comic generation limits (0 = no limit). from_env sets pilot defaults: the AI
    # provider is paid per comic and the site is public.
    generation_daily_total: int = 0
    generation_daily_student: int = 0
    generation_daily_teacher: int = 0
    generation_daily_guest: int = 0
    # Guests (no account) may generate comics; off on the public site (COMIC_GUESTS=1 turns it on).
    generation_guests: bool = True
    # Parent payments: "test" credits at once without money (no provider yet), "off" hides them.
    payments_mode: str = "test"

    def __post_init__(self):
        if self.provider not in ("openai", "gemini"):
            raise ValueError("COMIC_PROVIDER must be openai or gemini")
        if self.art_mode not in ("live", "prepared"):
            raise ValueError("COMIC_ART_MODE must be live or prepared")
        if self.text_reasoning_effort not in (None, "none", "minimal", "low", "medium", "high"):
            raise ValueError("Unsupported text reasoning effort")
        if not 1 <= self.cache_variants <= 20:
            raise ValueError("CACHE_VARIANTS must be between 1 and 20")
        if not 0 < self.semantic_threshold <= 1:
            raise ValueError("SEMANTIC_THRESHOLD must be in (0, 1]")
        if not 1 <= self.text_attempts <= 5:
            raise ValueError("TEXT_ATTEMPTS must be between 1 and 5")
        for value in (self.provider_timeout, self.job_timeout, self.poll_interval):
            if not 0 < value < float("inf"):
                raise ValueError("Timeouts and polling interval must be positive and finite")
        for url in (self.public_base_url, self.api_base_url):
            if not url.startswith(("http://", "https://")):
                raise ValueError("Base URLs must be absolute HTTP(S) URLs")

    @classmethod
    def from_env(cls):
        load_dotenv(BACKEND_DIR / ".env", override=False)
        data_dir = Path(os.getenv("COMIC_DATA_DIR", str(BACKEND_DIR / "data"))).expanduser()
        depth_model = os.getenv("COMIC_DEPTH_MODEL", "").strip()
        voice_model = os.getenv("COMIC_VOICE_MODEL", "").strip()
        if not data_dir.is_absolute():
            data_dir = BACKEND_DIR / data_dir
        return cls(
            data_dir=data_dir.resolve(),
            public_base_url=os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000").rstrip("/"),
            api_key=os.getenv("OPENAI_API_KEY", ""),
            api_base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
            text_model=os.getenv("OPENAI_TEXT_MODEL", "gpt-6-luna"),
            text_reasoning_effort=os.getenv("OPENAI_TEXT_REASONING_EFFORT", "none") or None,
            image_model=os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2.5-flare"),
            provider=os.getenv("COMIC_PROVIDER", "openai").strip().lower(),
            art_mode=os.getenv("COMIC_ART_MODE", "live").strip().lower(),
            depth_model=(BACKEND_DIR / Path(depth_model).expanduser()).resolve()
            if depth_model
            else None,
            voice_model=(BACKEND_DIR / Path(voice_model).expanduser()).resolve()
            if voice_model
            else None,
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            gemini_text_model=os.getenv("GEMINI_TEXT_MODEL", "gemini-3.8-flash"),
            gemini_image_model=os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image"),
            provider_timeout=float(os.getenv("PROVIDER_TIMEOUT_SECONDS", "180")),
            job_timeout=float(os.getenv("JOB_TIMEOUT_SECONDS", "1500")),
            poll_interval=float(os.getenv("WORKER_POLL_SECONDS", "1")),
            text_attempts=int(os.getenv("TEXT_ATTEMPTS", "3")),
            database_url=os.getenv("DATABASE_URL", "").strip(),
            require_account_migrations=os.getenv("REQUIRE_ACCOUNT_MIGRATIONS", "0").strip().lower()
            in ("1", "true", "yes"),
            jwt_secret=os.getenv("JWT_SECRET", "").strip(),
            jwt_hours=float(os.getenv("JWT_HOURS", "12")),
            story_cache=os.getenv("STORY_CACHE", "1").strip().lower() not in ("0", "false", "no"),
            redis_url=os.getenv("REDIS_URL", "").strip(),
            cache_variants=int(os.getenv("CACHE_VARIANTS", "1")),
            semantic_threshold=float(os.getenv("SEMANTIC_THRESHOLD", "0.92")),
            generation_daily_total=int(os.getenv("COMIC_DAILY_TOTAL", "300")),
            generation_daily_student=int(os.getenv("COMIC_DAILY_PER_STUDENT", "10")),
            generation_daily_teacher=int(os.getenv("COMIC_DAILY_PER_TEACHER", "40")),
            generation_daily_guest=int(os.getenv("COMIC_DAILY_PER_GUEST_IP", "3")),
            generation_guests=os.getenv("COMIC_GUESTS", "0").strip() == "1",
            payments_mode=os.getenv("PAYMENTS_MODE", "test").strip() or "test",
            embedding_model=os.getenv(
                "EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
            ).strip(),
        )
