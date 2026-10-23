"""Build-time check: run the worker once so a missing package fails the
RunPod build instead of the first staff request."""
import base64
import io

from PIL import Image

from owl_count import count_with_owl

buffer = io.BytesIO()
Image.new('RGB', (96, 64), 'white').save(buffer, 'PNG')
result = count_with_owl(base64.b64encode(buffer.getvalue()).decode(), {'x': 8, 'y': 8, 'width': 32, 'height': 32}, 'red square')
assert 'count' in result, result
print('smoke test passed:', result['count'], result['model'])
