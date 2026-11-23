"""Optional local foreground segmentation for live panels."""

import io
from functools import lru_cache
from pathlib import Path

from PIL import Image

LAYERS = ("background", "foreground")


@lru_cache(maxsize=1)
def segmentation_session(model_path: Path):
    import onnxruntime

    if not model_path.is_file():
        raise FileNotFoundError("The local segmentation model is missing")
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 2
    return onnxruntime.InferenceSession(
        str(model_path),
        sess_options=options,
        providers=["CPUExecutionProvider"],
    )


def split_panel(source: Path, model_path: Path) -> tuple[bytes, bytes] | None:
    import cv2
    import numpy as np

    with Image.open(source) as original:
        art = original.convert("RGB")
    art.thumbnail((960, 960), Image.Resampling.LANCZOS)
    # U²-Net's RGB image normalization and 320 px input follow its reference inference.
    pixels = np.asarray(art.resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
    pixels /= max(1.0, float(pixels.max()))
    pixels = (pixels - (0.485, 0.456, 0.406)) / (0.229, 0.224, 0.225)
    session = segmentation_session(model_path)
    inputs = {session.get_inputs()[0].name: pixels.transpose(2, 0, 1)[None].astype(np.float32)}
    prediction = session.run([session.get_outputs()[0].name], inputs)[0][0, 0]
    low, high = float(prediction.min()), float(prediction.max())
    if not np.isfinite(low + high) or high - low < 1e-6:
        return None
    normalized = ((prediction - low) * (255 / (high - low))).clip(0, 255)
    alpha = Image.fromarray(normalized.astype(np.uint8)).resize(art.size, Image.Resampling.LANCZOS)
    mask = np.asarray(alpha)
    coverage = float((mask > 127).mean())
    if not 0.05 <= coverage <= 0.8:
        return None
    # Fill the cutout and a narrow edge margin so the old outline never shifts with the canvas.
    hole = cv2.dilate((mask > 64).astype(np.uint8), np.ones((5, 5), dtype=np.uint8))
    background = Image.fromarray(cv2.inpaint(np.asarray(art), hole, 5, cv2.INPAINT_TELEA))
    foreground = art.copy()
    foreground.putalpha(alpha)
    output = []
    for layer in (background, foreground):
        buffer = io.BytesIO()
        layer.save(buffer, format="WEBP", quality=87, method=4)
        output.append(buffer.getvalue())
    return output[0], output[1]
