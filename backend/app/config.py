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
    gemini_api_key: str = field(default="", repr=False)
    gemini_text_model: str = "gemini-3.8-flash"
    gemini_image_model: str = "gemini-3.1-flash-image"
    provider_timeout: float = 180
    job_timeout: float = 1500
    poll_interval: float = 1
    text_attempts: int = 3
    # Accounts DB; empty = data/accounts.sqlite3. PostgreSQL: see docker-compose.yml.
    database_url: str = field(default="", repr=False)
    jwt_secret: str = field(default="", repr=False)
    jwt_hours: float = 12

    def __post_init__(self):
        if self.provider not in ("openai", "gemini"):
            raise ValueError("COMIC_PROVIDER must be openai or gemini")
        if self.art_mode not in ("live", "prepared"):
            raise ValueError("COMIC_ART_MODE must be live or prepared")
        if self.text_reasoning_effort not in (None, "none", "minimal", "low", "medium", "high"):
            raise ValueError("Unsupported text reasoning effort")
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
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            gemini_text_model=os.getenv("GEMINI_TEXT_MODEL", "gemini-3.8-flash"),
            gemini_image_model=os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image"),
            provider_timeout=float(os.getenv("PROVIDER_TIMEOUT_SECONDS", "180")),
            job_timeout=float(os.getenv("JOB_TIMEOUT_SECONDS", "1500")),
            poll_interval=float(os.getenv("WORKER_POLL_SECONDS", "1")),
            text_attempts=int(os.getenv("TEXT_ATTEMPTS", "3")),
            database_url=os.getenv("DATABASE_URL", "").strip(),
            jwt_secret=os.getenv("JWT_SECRET", "").strip(),
            jwt_hours=float(os.getenv("JWT_HOURS", "12")),
        )
