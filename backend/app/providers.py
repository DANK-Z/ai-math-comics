"""Small async provider boundaries with real OpenAI REST adapters."""

import asyncio
import base64
import binascii
import io
import json
from typing import Protocol

import httpx
from PIL import Image, UnidentifiedImageError

from .config import Settings
from .schemas import ErrorCode

MAX_IMAGE_BYTES = 20 * 1024 * 1024


class ProviderError(Exception):
    def __init__(self, code: ErrorCode):
        super().__init__(code)
        self.code = code


class TextProvider(Protocol):
    async def generate(self, prompt: str, schema: dict) -> dict: ...


class ImageProvider(Protocol):
    async def generate(self, prompt: str, reference: bytes | None = None) -> bytes: ...


def normalize_png(data: bytes) -> bytes:
    """Reject corrupt/oversized images and strip provider metadata before publication."""
    try:
        if not data or len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Invalid image size")
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 16_777_216:
                raise ValueError("Image dimensions too large")
            image.load()
            output = io.BytesIO()
            image.convert("RGB").save(output, format="PNG")
            return output.getvalue()
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise ProviderError("invalid_provider_output") from exc


class OpenAIHTTP:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings = settings
        self.client = client

    async def post(self, path: str, **kwargs) -> dict:
        if not self.settings.api_key.strip():
            raise ProviderError("provider_not_configured")
        try:
            response = await asyncio.wait_for(
                self.client.post(
                    f"{self.settings.api_base_url.rstrip('/')}/{path}",
                    headers={"Authorization": f"Bearer {self.settings.api_key}"},
                    timeout=self.settings.provider_timeout,
                    **kwargs,
                ),
                timeout=self.settings.provider_timeout,
            )
        except (httpx.TimeoutException, asyncio.TimeoutError) as exc:
            raise ProviderError("provider_timeout") from exc
        except httpx.RequestError as exc:
            raise ProviderError("provider_unavailable") from exc
        if response.status_code in (401, 403):
            raise ProviderError("provider_authentication")
        if response.status_code == 429:
            raise ProviderError("provider_rate_limited")
        if not response.is_success:
            # Never expose or log upstream response bodies (they may contain secrets).
            raise ProviderError("provider_unavailable")
        try:
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError("Expected object")
            return result
        except ValueError as exc:
            raise ProviderError("invalid_provider_output") from exc


class OpenAITextProvider:
    def __init__(self, http: OpenAIHTTP):
        self.http = http

    async def generate(self, prompt: str, schema: dict) -> dict:
        result = await self.http.post(
            "chat/completions",
            json={
                "model": self.http.settings.text_model,
                "messages": [
                    {"role": "system", "content": "You write localized educational comics."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": "comic_story", "strict": True, "schema": schema},
                },
                "max_completion_tokens": 6000,
                **(
                    {"reasoning_effort": self.http.settings.text_reasoning_effort}
                    if self.http.settings.text_reasoning_effort
                    else {}
                ),
            },
        )
        try:
            choice = result["choices"][0]
            if choice["finish_reason"] != "stop" or choice["message"].get("refusal"):
                raise ValueError("Incomplete or refused output")
            raw = json.loads(choice["message"]["content"])
            if not isinstance(raw, dict):
                raise ValueError("Expected story object")
            return raw
        except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
            raise ProviderError("invalid_provider_output") from exc


class OpenAIImageProvider:
    def __init__(self, http: OpenAIHTTP):
        self.http = http

    async def generate(self, prompt: str, reference: bytes | None = None) -> bytes:
        fields = {
            "model": self.http.settings.image_model,
            "prompt": prompt,
            "size": "1024x1024",
            "quality": "low",
            "output_format": "png",
            "n": 1,
        }
        if reference is None:
            result = await self.http.post("images/generations", json=fields)
        else:
            result = await self.http.post(
                "images/edits",
                data={key: str(value) for key, value in fields.items()},
                files={"image": ("reference.png", reference, "image/png")},
            )
        try:
            encoded = result["data"][0]["b64_json"]
            if len(encoded) > MAX_IMAGE_BYTES * 4 // 3 + 4:
                raise ValueError("Image response too large")
            return normalize_png(base64.b64decode(encoded, validate=True))
        except (KeyError, IndexError, TypeError, ValueError, binascii.Error) as exc:
            raise ProviderError("invalid_provider_output") from exc
