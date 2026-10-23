"""Count products in a photo with OWLv2, a pretrained open-vocabulary detector.

No training is needed: the detector looks for the product's name (for example
"Canned Coffee"), so different flavours or colours of the same kind of item
are still found. The staff-selected example box calibrates the result:
detections must be about the example's size and nearly as confident as the
detection on the example itself. If the name finds nothing at the example,
the example image itself is used as the query (image-guided detection).

Runs on a GPU on RunPod (falls back to CPU, which is much slower).
"""
import base64
import io

import torch
from PIL import Image, ImageOps
from transformers import Owlv2ForObjectDetection, Owlv2Processor

from count_objects import CountError

MODEL = 'google/owlv2-base-patch16-ensemble'
CANDIDATE_SCORE = 0.02   # Keep weak detections; the example decides the cut.
RELATIVE_SCORE = 0.1     # Keep detections at least this share of the example's score.
MIN_SCORE = 0.02
SIZE_RANGE = (0.3, 3.0)  # Allowed area relative to the example (nearer / farther items).
ASPECT_RANGE = 1.5       # Width/height may differ from the example's by at most this factor;
                         # rejects a pack's printed picture or a whole row of can lids.
OVERLAP = 0.3
CONTAINED = 0.6          # A box mostly inside a stronger one is part of that item.

device = 'cuda' if torch.cuda.is_available() else 'cpu'
processor = Owlv2Processor.from_pretrained(MODEL)
model = Owlv2ForObjectDetection.from_pretrained(MODEL).to(device).eval()


def _iou(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return 0.0
    inter = w * h
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)


def _inside(a, b):
    """Share of box a's area that lies inside box b."""
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return 0.0 if w <= 0 or h <= 0 else w * h / ((a[2] - a[0]) * (a[3] - a[1]))


def _detect_text(image, side, label):
    inputs = processor(text=[[label]], images=image, return_tensors='pt').to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    # OWLv2 pads to a square at the bottom/right, so boxes map straight back.
    result = processor.post_process_object_detection(
        outputs=outputs, threshold=CANDIDATE_SCORE, target_sizes=torch.tensor([[side, side]], device=device))[0]
    return result['boxes'].cpu(), result['scores'].cpu()


def _detect_example(image, side, example_crop):
    inputs = processor(images=image, query_images=example_crop, return_tensors='pt').to(device)
    with torch.no_grad():
        outputs = model.image_guided_detection(**inputs)
    result = processor.post_process_image_guided_detection(
        outputs=outputs, threshold=CANDIDATE_SCORE, nms_threshold=OVERLAP,
        target_sizes=torch.tensor([[side, side]], device=device))[0]
    return result['boxes'].cpu(), result['scores'].cpu()


def _select(boxes, scores, example, width, height):
    """Keep detections that look like the example in size and confidence."""
    example_area = (example[2] - example[0]) * (example[3] - example[1])
    example_aspect = (example[2] - example[0]) / (example[3] - example[1])
    if len(boxes) == 0:
        return None
    overlaps = [_iou(box.tolist(), example) for box in boxes]
    best = max(range(len(boxes)), key=lambda i: overlaps[i])
    if overlaps[best] < 0.3:
        return None  # Nothing detected at the example: this query does not describe it.
    threshold = max(MIN_SCORE, RELATIVE_SCORE * float(scores[best]))
    keep = []
    for i, box in enumerate(boxes):
        x0, y0, x1, y1 = [float(v) for v in box]
        x0, y0, x1, y1 = max(0.0, x0), max(0.0, y0), min(width, x1), min(height, y1)
        area = (x1 - x0) * (y1 - y0)
        if area <= 0 or not SIZE_RANGE[0] <= area / example_area <= SIZE_RANGE[1]:
            continue
        aspect = (x1 - x0) / (y1 - y0)
        if max(aspect / example_aspect, example_aspect / aspect) > ASPECT_RANGE:
            continue
        if float(scores[i]) >= threshold or i == best:
            keep.append((i, [x0, y0, x1, y1]))
    # Greedy suppression: the stronger of two overlapping boxes is the item,
    # and a box mostly inside (or around) a kept one is a part or a group.
    result = []
    for i, box in sorted(keep, key=lambda item: -float(scores[item[0]])):
        if all(_iou(box, other) <= OVERLAP and _inside(box, other) <= CONTAINED and _inside(other, box) <= CONTAINED
               for other, _ in result):
            result.append((box, float(scores[i])))
    return result or None


def count_with_owl(image_base64, exemplar, label=''):
    try:
        raw = base64.b64decode(image_base64.split(',', 1)[-1])
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
    except Exception as error:
        raise CountError('The photo could not be read. Use a JPG or PNG.') from error
    width, height = image.size
    try:
        x, y = max(0.0, float(exemplar['x'])), max(0.0, float(exemplar['y']))
        w, h = min(float(exemplar['width']), width - x), min(float(exemplar['height']), height - y)
    except (KeyError, TypeError, ValueError) as error:
        raise CountError('Draw a box around one item first.') from error
    if w < 8 or h < 8:
        raise CountError('The example box is too small. Draw it around one whole item.')
    example = [x, y, x + w, y + h]
    side = max(width, height)

    found = None
    query = ' '.join(str(label).split())[:80]
    if query:
        found = _select(*_detect_text(image, side, query), example, width, height)
    method = 'name'
    if found is None:
        found = _select(*_detect_example(image, side, image.crop(tuple(round(v) for v in example))), example, width, height)
        method = 'example'
    if found is None:
        found = [(example, 1.0)]

    boxes = [{
        'x': round(b[0], 1), 'y': round(b[1], 1), 'width': round(b[2] - b[0], 1), 'height': round(b[3] - b[1], 1),
        'score': round(score, 3),
    } for b, score in found]
    boxes.sort(key=lambda box: (round(box['y'] / max(1.0, h * 0.5)), box['x']))
    return {'count': len(boxes), 'boxes': boxes, 'imageWidth': width, 'imageHeight': height,
            'model': f'owlv2 ({method}, {device})'}
