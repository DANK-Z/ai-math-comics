import asyncio
import base64
import json

import httpx
import pytest
from google import genai
from google.genai import types
from test_generation import png

from app.config import Settings
from app.gemini import GeminiContent, GeminiImageProvider, GeminiTextProvider
from app.providers import ProviderError
from app.story import Story
from app.worker import configured_providers


def fake_sdk(handler):
    return genai.Client(
        api_key="test-key",
        vertexai=False,
        http_options=types.HttpOptions(
            async_client_args={"transport": httpx.MockTransport(handler)},
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )


def candidate(parts, finish="STOP"):
    return {"candidates": [{"content": {"parts": parts, "role": "model"}, "finishReason": finish}]}


def test_story_requests_schema_and_parses_only_final_text():
    schema = Story.model_json_schema()

    def handler(request):
        assert request.url.path.endswith("/models/story-model:generateContent")
        body = json.loads(request.content)
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert body["generationConfig"]["responseJsonSchema"] == schema
        assert body["contents"][0]["parts"][0]["text"] == "story prompt"
        return httpx.Response(
            200, json=candidate([{"text": "thinking", "thought": True}, {"text": '{"kk":{}}'}])
        )

    async def run():
        with fake_sdk(handler) as client:
            async with client.aio as sdk:
                provider = GeminiTextProvider(GeminiContent(sdk.models, 5), "story-model")
                assert await provider.generate("story prompt", schema) == {"kk": {}}

    asyncio.run(run())


@pytest.mark.parametrize("use_reference", [False, True])
def test_image_requests_and_selects_final_inline_image(use_reference):
    encoded = base64.b64encode(png()).decode()

    def handler(request):
        assert request.url.path.endswith("/models/image-model:generateContent")
        body = json.loads(request.content)
        assert body["generationConfig"]["responseModalities"] == ["IMAGE"]
        parts = body["contents"][0]["parts"]
        assert parts[0]["text"] == "image prompt"
        if use_reference:
            blob = parts[1]["inlineData"]
            assert blob.get("mimeType", blob.get("mime_type")) == "image/png"
            assert base64.urlsafe_b64decode(blob["data"]) == png()
        else:
            assert len(parts) == 1
        return httpx.Response(
            200,
            json=candidate(
                [
                    {"inlineData": {"data": "YmFk", "mimeType": "image/png"}, "thought": True},
                    {"inlineData": {"data": encoded, "mimeType": "image/png"}},
                ]
            ),
        )

    async def run():
        with fake_sdk(handler) as client:
            async with client.aio as sdk:
                provider = GeminiImageProvider(GeminiContent(sdk.models, 5), "image-model")
                assert (
                    await provider.generate("image prompt", png() if use_reference else None)
                    == png()
                )

    asyncio.run(run())


@pytest.mark.parametrize(
    ("body", "image", "stage"),
    [
        ({}, False, "empty_response"),
        ({"promptFeedback": {"blockReason": "SAFETY"}}, False, "blocked_response"),
        (candidate([{"text": "{}"}], finish="MAX_TOKENS"), False, "incomplete_response:MAX_TOKENS"),
        (candidate([{"text": "   "}]), False, "empty_story_text"),
        (candidate([{"text": "{"}]), False, "story_json_parsing"),
        (candidate([{"text": "[]"}]), False, "story_json_object"),
        (candidate([{"text": "no image"}]), True, "missing_inline_image"),
        (
            candidate([{"inlineData": {"data": "YmFk", "mimeType": "image/png"}}]),
            True,
            "image_decode",
        ),
    ],
)
def test_invalid_gemini_responses(body, image, stage):
    async def run():
        with fake_sdk(lambda _: httpx.Response(200, json=body)) as client:
            async with client.aio as sdk:
                content = GeminiContent(sdk.models, 5)
                with pytest.raises(ProviderError, match="^invalid_provider_output$") as err:
                    if image:
                        await GeminiImageProvider(content, "image-model").generate("prompt")
                    else:
                        await GeminiTextProvider(content, "story-model").generate("prompt", {})
                assert err.value.stage == stage

    asyncio.run(run())


@pytest.mark.parametrize(
    ("status", "reason", "code"),
    [
        (400, "API_KEY_INVALID", "provider_authentication"),
        (403, None, "provider_authentication"),
        (429, None, "provider_rate_limited"),
        (500, None, "provider_unavailable"),
        (504, None, "provider_timeout"),
    ],
)
def test_sdk_errors_are_safe_and_not_retried(status, reason, code):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            status,
            json={
                "error": {
                    "code": status,
                    "message": "private upstream data",
                    "details": [{"reason": reason}] if reason else [],
                }
            },
        )

    async def run():
        with fake_sdk(handler) as client:
            async with client.aio as sdk:
                content = GeminiContent(sdk.models, 5)
                with pytest.raises(ProviderError, match=f"^{code}$") as err:
                    await GeminiTextProvider(content, "story-model").generate("prompt", {})
                assert err.value.stage == f"gemini_http:{status}"

    asyncio.run(run())
    assert len(calls) == 1


def test_missing_key_and_wall_clock_deadline():
    async def slow_handler(_):
        await asyncio.sleep(30)

    async def run():
        async with configured_providers(Settings(provider="gemini")) as (text, image):
            with pytest.raises(ProviderError, match="^provider_not_configured$"):
                await text.generate("prompt", {})
            with pytest.raises(ProviderError, match="^provider_not_configured$"):
                await image.generate("prompt")
        with fake_sdk(slow_handler) as client:
            async with client.aio as sdk:
                with pytest.raises(ProviderError, match="^provider_timeout$"):
                    await GeminiImageProvider(GeminiContent(sdk.models, 0.01), "image").generate(
                        "prompt"
                    )

    asyncio.run(run())
