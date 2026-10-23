"""RunPod serverless worker for photo counting.

Input:  {"image": "<base64 JPG/PNG>", "exemplar": {"x", "y", "width", "height"}}
Output: {"count", "boxes", "imageWidth", "imageHeight"} or {"error": "..."}
"""
import runpod

from count_objects import CountError, count_objects


def handler(job):
    data = job.get('input') or {}
    try:
        return count_objects(data.get('image', ''), data.get('exemplar') or {})
    except CountError as error:
        return {'error': str(error)}


runpod.serverless.start({'handler': handler})
