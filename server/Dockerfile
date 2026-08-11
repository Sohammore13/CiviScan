# ─────────────────────────────────────────────────────────────────────────────
# CiviScan Backend — Dockerfile
# Architecture: FastAPI + Hugging Face Serverless Inference API
#
# No PyTorch or model weights are downloaded at build time.
# The model runs on HF's servers; this container just handles API routing.
#
# Build:  docker build -t civiscan-api .
# Run:    docker run -p 7860:7860 civiscan-api
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency file first (better layer caching)
COPY requirements.txt .

# Install Python dependencies (lean — no torch/transformers)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

EXPOSE 7860

ENV MODEL_NAME="Sohammore13/cyberbullying-detector" \
    KEYWORDS_CSV="./abusive_words.csv" \
    PORT=7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
