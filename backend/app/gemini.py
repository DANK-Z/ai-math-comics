"""Gemini Developer API adapters using the official Google Gen AI SDK."""

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from google import genai
from google.genai import errors, types
from google.genai.models import AsyncModels

from .config import Settings
from .providers import ImageProvider, ProviderError, TextProvider, normalize_png


class GeminiContent:
    def __init__(self, models: AsyncModels | None, timeout: float):
        self.models = models
        self.timeout = timeout

    async def generate(
        self, model: str, parts: list[types.Part], config: types.GenerateContentConfig
    ) -> list[types.Part]:
        if self.models is None:
            raise ProviderError("provider_not_configured")
        try:
            response = await asyncio.wait_for(
                self.models.generate_content(model=model, contents=parts, config=config),
                timeout=self.timeout,
            )
        except (asyncio.TimeoutError, httpx.TimeoutException) as exc:
            raise ProviderError("provider_timeout", stage="gemini_request_timeout") from exc
        except httpx.RequestError as exc:
            raise ProviderError("provider_unavailable", stage="gemini_transport_error") from exc
        except errors.APIError as exc:
            # Only the numeric HTTP status is safe to log, never the upstream error body.
            stage = f"gemini_http:{exc.code}" if isinstance(exc.code, int) else "gemini_http"
            payload = exc.details if isinstance(exc.details, dict) else {}
            error = payload.get("error", payload)
            details = error.get("details") if isinstance(error, dict) else None
            if exc.code in (401, 403) or any(
                isinstance(detail, dict) and detail.get("reason") == "API_KEY_INVALID"
                for detail in (details or [])
            ):
                raise ProviderError("provider_authentication", stage=stage) from None
            if exc.code == 429:
                raise ProviderError("provider_rate_limited", stage=stage) from None
            if exc.code in (408, 504):
                raise ProviderError("provider_timeout", stage=stage) from None
            raise ProviderError("provider_unavailable", stage=stage) from None
        except ValueError:
            raise ProviderError("invalid_provider_output", stage="sdk_response") from None

        candidates = response.candidates or []
        if not candidates:
            blocked = response.prompt_feedback and response.prompt_feedback.block_reason
            stage = "blocked_response" if blocked else "empty_response"
            raise ProviderError("invalid_provider_output", stage=stage)
        candidate = candidates[0]
        if candidate.finish_reason != types.FinishReason.STOP:
            reason = candidate.finish_reason
            stage = f"incomplete_response:{reason.value}" if reason else "incomplete_response"
            raise ProviderError("invalid_provider_output", stage=stage)
        content = candidate.content
        parts = [part for part in content.parts or [] if not part.thought] if content else []
        if not parts:
            raise ProviderError("invalid_provider_output", stage="empty_response")
        return parts


class GeminiTextProvider:
    def __init__(self, content: GeminiContent, model: str):
        self.content = content
        self.model = model

    async def generate(self, prompt: str, schema: dict) -> dict:
        parts = await self.content.generate(
            self.model,
            [types.Part.from_text(text=prompt)],
            types.GenerateContentConfig(
                system_instruction="You write localized educational comics.",
                response_mime_type="application/json",
                response_json_schema=schema,
                max_output_tokens=8192,
            ),
        )
        text = "".join(part.text for part in parts if part.text)
        if not text.strip():
            raise ProviderError("invalid_provider_output", stage="empty_story_text")
        try:
            story = json.loads(text)
        except ValueError:
            raise ProviderError("invalid_provider_output", stage="story_json_parsing") from None
        if not isinstance(story, dict):
            raise ProviderError("invalid_provider_output", stage="story_json_object")
        return story


class GeminiImageProvider:
    def __init__(self, content: GeminiContent, model: str):
        self.content = content
        self.model = model

    async def generate(self, prompt: str, reference: bytes | None = None) -> bytes:
        inputs = [types.Part.from_text(text=prompt)]
        if reference is not None:
            inputs.append(types.Part.from_bytes(data=reference, mime_type="image/png"))
        parts = await self.content.generate(
            self.model,
            inputs,
            types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            ),
        )
        for part in parts:
            blob = part.inline_data
            if (
                blob
                and blob.mime_type
                and blob.mime_type.startswith("image/")
                and isinstance(blob.data, bytes)
            ):
                try:
                    return normalize_png(blob.data)
                except ProviderError:
                    raise ProviderError("invalid_provider_output", stage="image_decode") from None
        raise ProviderError("invalid_provider_output", stage="missing_inline_image")


@asynccontextmanager
async def gemini_providers(
    settings: Settings,
) -> AsyncIterator[tuple[TextProvider, ImageProvider | None]]:
    def adapters(models: AsyncModels | None) -> tuple[TextProvider, ImageProvider | None]:
        content = GeminiContent(models, settings.provider_timeout)
        image = (
            GeminiImageProvider(content, settings.gemini_image_model)
            if settings.art_mode == "live"
            else None
        )
        return GeminiTextProvider(content, settings.gemini_text_model), image

    key = settings.gemini_api_key.strip()
    if not key:
        yield adapters(None)
        return
    client = genai.Client(
        api_key=key,
        vertexai=False,
        http_options=types.HttpOptions(retry_options=types.HttpRetryOptions(attempts=1)),
    )
    with client:
        async with client.aio as async_client:
            yield adapters(async_client.models)
