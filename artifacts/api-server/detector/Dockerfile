# RunPod serverless worker. Build from this folder:
#   docker build --platform linux/amd64 -t <dockerhub-user>/veracity-counter:latest .
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt runpod
COPY count_objects.py runpod_handler.py ./

CMD ["python", "-u", "runpod_handler.py"]
