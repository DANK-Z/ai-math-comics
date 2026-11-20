import asyncio
import base64
import io
import json
import os
import subprocess
import sys
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from test_generation import REQUEST, png, story_for

from app.config import BACKEND_DIR, Settings
from app.main import create_app
from app.providers import OpenAIHTTP, OpenAIImageProvider, OpenAITextProvider, ProviderError
from app.storage import Store
from app.worker import Worker


def test_full_flow_through_real_adapters_with_mock_http(tmp_path):
    settings = Settings(data_dir=tmp_path, api_key="server-only-test-key")
    requests = []

    def transport(request):
        requests.append(request)
        assert request.headers["authorization"] == "Bearer server-only-test-key"
        if request.url.path == "/v1/chat/completions":
            body = json.loads(request.content)
            assert body["model"] == settings.text_model
            assert body["reasoning_effort"] == "none"
            schema = body["response_format"]["json_schema"]
            assert schema["strict"] is True
            assert schema["schema"]["additionalProperties"] is False
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "finish_reason": "stop",
                            "message": {
                                "content": json.dumps(story_for(body["messages"][1]["content"]))
                            },
                        }
                    ]
                },
            )
        if request.url.path == "/v1/images/generations":
            body = json.loads(request.content)
            assert body["n"] == 1 and body["output_format"] == "png"
            assert body["model"] == settings.image_model
        else:
            assert request.url.path == "/v1/images/edits"
            assert "multipart/form-data" in request.headers["content-type"]
            assert b'filename="reference.png"' in request.content
            assert b'name="image"' in request.content
            assert png() in request.content
            assert b"No embedded text" in request.content
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(png()).decode()}]})

    with TestClient(create_app(settings)) as api:
        job_id = api.post("/api/comic-jobs", json=REQUEST).json()["jobId"]

        async def process():
            async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
                http = OpenAIHTTP(settings, client)
                worker = Worker(
                    Store(tmp_path), OpenAITextProvider(http), OpenAIImageProvider(http), settings
                )
                assert await worker.run_once()

        asyncio.run(process())
        status = api.get(f"/api/comic-jobs/{job_id}").json()
        assert status["status"] == "ready"
        comic = api.get(f"/api/comics/{status['comicId']}").json()
        assert "server-only-test-key" not in json.dumps(comic)
        for panel in comic["panels"]:
            image = api.get(panel["imageUrl"])
            assert image.status_code == 200
            Image.open(io.BytesIO(image.content)).verify()
    assert [r.url.path for r in requests] == [
        "/v1/chat/completions",
        "/v1/images/generations",
        *["/v1/images/edits"] * 5,
    ]


@pytest.mark.parametrize(
    "status,code",
    [
        (401, "provider_authentication"),
        (403, "provider_authentication"),
        (429, "provider_rate_limited"),
        (400, "provider_unavailable"),
        (500, "provider_unavailable"),
        (503, "provider_unavailable"),
        (302, "provider_unavailable"),
    ],
)
def test_safe_upstream_http_errors(status, code):
    async def run():
        def handler(request):
            return httpx.Response(status, text="secret provider details and key")

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with pytest.raises(ProviderError) as error:
                await OpenAIHTTP(Settings(api_key="secret-key"), client).post("test", json={})
            assert error.value.code == code
            assert str(error.value) == code

    asyncio.run(run())


@pytest.mark.parametrize("failure", ["timeout", "connection", "deadline", "no_key", "bad_json"])
def test_transport_and_configuration_errors(failure):
    async def run():
        async def handler(request):
            if failure == "timeout":
                raise httpx.ReadTimeout("secret details")
            if failure == "connection":
                raise httpx.ConnectError("secret details")
            if failure == "deadline":
                await asyncio.sleep(3)
            return httpx.Response(200, text="not json")

        settings = Settings(api_key="" if failure == "no_key" else "key", provider_timeout=0.01)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with pytest.raises(ProviderError) as error:
                await OpenAIHTTP(settings, client).post("test", json={})
            assert (
                error.value.code
                == {
                    "timeout": "provider_timeout",
                    "connection": "provider_unavailable",
                    "deadline": "provider_timeout",
                    "no_key": "provider_not_configured",
                    "bad_json": "invalid_provider_output",
                }[failure]
            )

    asyncio.run(run())


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"choices": []},
        {"choices": [None]},
        {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"refusal": "no"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "{bad"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "[]"}}]},
        {"choices": [{"finish_reason": "stop", "message": "invalid"}]},
    ],
)
def test_reject_text_provider_malformed_or_refused_output(body):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, json=body))
        ) as client:
            provider = OpenAITextProvider(OpenAIHTTP(Settings(api_key="key"), client))
            with pytest.raises(ProviderError, match="invalid_provider_output"):
                await provider.generate("prompt", {})

    asyncio.run(run())


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"data": []},
        {"data": [{"url": "https://untrusted.example/image"}]},
        {"data": [{"b64_json": "!!!"}]},
        {"data": [{"b64_json": base64.b64encode(b"invalid image").decode()}]},
    ],
)
def test_reject_bad_images_without_downloading_arbitrary_urls(body):
    async def run():
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(200, json=body)

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = OpenAIImageProvider(OpenAIHTTP(Settings(api_key="key"), client))
            with pytest.raises(ProviderError, match="invalid_provider_output"):
                await provider.generate("prompt")
        assert len(calls) == 1

    asyncio.run(run())


def test_optional_reasoning_field_is_omitted():
    async def run():
        def handler(request):
            assert "reasoning_effort" not in json.loads(request.content)
            return httpx.Response(
                200, json={"choices": [{"finish_reason": "stop", "message": {"content": "{}"}}]}
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            settings = replace(Settings(api_key="key"), text_reasoning_effort=None)
            assert (
                await OpenAITextProvider(OpenAIHTTP(settings, client)).generate("prompt", {}) == {}
            )

    asyncio.run(run())


@pytest.mark.parametrize("provider", ["openai", "gemini"])
def test_standalone_worker_cli_persists_configuration_failure(tmp_path, provider):
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as api:
        job_id = api.post("/api/comic-jobs", json=REQUEST).json()["jobId"]
    process = subprocess.run(
        [sys.executable, "-m", "app.worker", "--once"],
        cwd=BACKEND_DIR,
        env=dict(os.environ)
        | {
            "COMIC_PROVIDER": provider,
            "OPENAI_API_KEY": "",
            "GEMINI_API_KEY": "",
            "COMIC_DATA_DIR": str(tmp_path),
        },
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert process.returncode == 0
    with TestClient(create_app(settings)) as api:
        assert api.get(f"/api/comic-jobs/{job_id}").json() == {
            "jobId": job_id,
            "status": "failed",
            "comicId": None,
            "errorCode": "provider_not_configured",
        }
