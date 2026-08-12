# ─────────────────────────────────────────────────────────────────────────────
# CiviScan — Deployment Dockerfile
# Uses HuggingFace Serverless Inference API (no PyTorch loaded locally)
# RAM usage: ~80-100 MB → fits Render / Koyeb / Railway free tier
#
# Build:  docker build -t civiscan-api .
# Run:    docker run -p 7860:7860 \
#           -e HF_TOKEN=hf_xxx \
#           -e YOUTUBE_API_KEY=xxx \
#           civiscan-api
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (required by some platforms e.g. HF Spaces)
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install lean dependencies (no torch/transformers — just ~80 MB)
COPY requirements_deploy.txt .
RUN pip install --no-cache-dir -r requirements_deploy.txt

# Copy application source
COPY main_deploy.py ./main_deploy.py
COPY abusive_words.csv .
COPY keywords.csv .
COPY routers/ ./routers/
COPY services/ ./services/

# Ensure non-root user owns the files
RUN chown -R appuser:appuser /app

USER appuser

# Port (Render uses $PORT env var, default 7860)
EXPOSE 7860

ENV MODEL_NAME="Sohammore13/cyberbullying-detector" \
    KEYWORDS_CSV="./abusive_words.csv" \
    PORT=7860

# Run the deployment version of the app
CMD ["uvicorn", "main_deploy:app", "--host", "0.0.0.0", "--port", "7860"]
