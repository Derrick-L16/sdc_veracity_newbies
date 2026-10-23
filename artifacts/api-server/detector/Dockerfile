# RunPod serverless GPU worker (OWLv2 object detector). Build context: this folder.
#   docker build --platform linux/amd64 -t <dockerhub-user>/veracity-counter:latest .
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 HF_HOME=/models
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "transformers>=4.44,<5" runpod

# Download the model into the image so a cold worker does not fetch ~600 MB.
RUN python -c "from transformers import Owlv2Processor, Owlv2ForObjectDetection as M; \
Owlv2Processor.from_pretrained('google/owlv2-base-patch16-ensemble'); \
M.from_pretrained('google/owlv2-base-patch16-ensemble')"

COPY count_objects.py owl_count.py runpod_handler.py ./
CMD ["python", "-u", "runpod_handler.py"]
