"""RunPod serverless worker for photo counting.

Input:  {"image": "<base64 JPG/PNG>", "exemplar": {"x", "y", "width", "height"},
         "label": "<product name, optional>"}
Output: {"count", "boxes", "imageWidth", "imageHeight", "model"} or {"error": "..."}

Uses the OWLv2 detector (owl_count.py) when PyTorch is installed, as in the
GPU image built by the Dockerfile; otherwise the template matcher.
"""
import runpod

from count_objects import CountError, count_objects

try:
    from owl_count import count_with_owl
except ImportError:  # Lightweight CPU image without PyTorch.
    count_with_owl = None


def handler(job):
    data = job.get('input') or {}
    try:
        if count_with_owl:
            return count_with_owl(data.get('image', ''), data.get('exemplar') or {}, data.get('label') or '')
        return {**count_objects(data.get('image', ''), data.get('exemplar') or {}), 'model': 'template matching'}
    except CountError as error:
        return {'error': str(error)}


runpod.serverless.start({'handler': handler})
