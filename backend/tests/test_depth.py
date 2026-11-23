import asyncio
import io
from dataclasses import replace

import pytest
from PIL import Image
from test_generation import DeterministicImages, DeterministicText, story_for
from test_generation import setup as setup

from app import worker
from app.story import Story, StoryRuleError, validate_story
from app.worker import Worker


class ExpressiveText(DeterministicText):
    async def generate(self, prompt, schema):
        output = await super().generate(prompt, schema)
        if "ru" in output:
            for lang in ("ru", "kk"):
                output[lang]["panels"][0]["emotion"] = "surprised"
        return output


@pytest.mark.parametrize("split_fails", [False, True])
def test_optional_layers_do_not_change_panel_progress(setup, monkeypatch, split_fails):
    settings, client, store = setup
    settings = replace(settings, depth_model=settings.data_dir / "model.onnx")
    png = io.BytesIO()
    Image.new("RGBA", (32, 32), (12, 34, 56, 128)).save(png, "WEBP")
    layer = png.getvalue()

    def split(source, model):
        assert source.is_file()
        assert model == settings.depth_model
        if split_fails:
            raise RuntimeError()
        return layer, layer

    monkeypatch.setattr(worker, "split_panel", split)
    job = client.post(
        "/api/comic-jobs",
        json={"grade": 5, "topic": "equations", "lang": "ru", "difficulty": "basic"},
    ).json()
    images = DeterministicImages()
    processor = Worker(store, ExpressiveText(), images, settings)
    assert asyncio.run(processor.run_once())
    status = client.get(f"/api/comic-jobs/{job['jobId']}").json()
    assert status["status"] == "ready"
    assert status["progress"]["completedPanels"] == 6
    assert len(images.calls) == 6
    for lang in ("ru", "kk"):
        comic = client.get(f"/api/comics/{status['comicId']}?lang={lang}").json()
        assert comic["panels"][0]["emotion"] == "surprised"
        assert "emotion" not in comic["panels"][1]
        for panel in comic["panels"]:
            assert client.get(panel["imageUrl"]).status_code == 200
            if split_fails:
                assert "layers" not in panel
            else:
                for url in panel["layers"].values():
                    response = client.get(url)
                    assert response.headers["content-type"] == "image/webp"
                    assert response.content == layer


def test_bilingual_emotion_validation():
    from app.problems import EquationProblem
    from app.schemas import JobRequest
    from app.story import text_prompt

    problem = EquationProblem("mul_add", 2, 5, 15)
    request = JobRequest(grade=5, topic="equations", lang="ru", difficulty="advanced")
    data = story_for(text_prompt(request, problem))
    assert validate_story(data, problem).ru.panels[0].emotion == "neutral"
    data["ru"]["panels"][0]["emotion"] = "happy"
    with pytest.raises(StoryRuleError, match="same_emotion_across_translations"):
        validate_story(data, problem)
    data["kk"]["panels"][0]["emotion"] = "unknown"
    with pytest.raises(ValueError):
        Story.model_validate(data)
