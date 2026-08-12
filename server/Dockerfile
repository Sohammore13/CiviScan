# ─────────────────────────────────────────────────────────────────────────────
# CiviScan — Deployment Dockerfile
# Loads model locally via Transformers (CPU PyTorch)
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

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Install dependencies (CPU-only PyTorch + Transformers)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY main.py ./main.py
COPY main_deploy.py ./main_deploy.py
COPY abusive_words.csv .
COPY keywords.csv .
COPY routers/ ./routers/
COPY services/ ./services/

# Ensure non-root user owns the files
RUN chown -R appuser:appuser /app

USER appuser

# Port (Render sets $PORT env var dynamically)
EXPOSE 7860

ENV MODEL_NAME="Sohammore13/cyberbullying-detector" \
    KEYWORDS_CSV="./abusive_words.csv"

# Run main app, binding dynamically to $PORT
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"
