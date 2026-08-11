# ─────────────────────────────────────────────────────────────────────────────
# Cyberbullying Detection API — Dockerfile
# Target: Hugging Face Spaces (Docker SDK)
#
# HF Spaces requires:
#   • The app listens on port 7860
#   • The container runs as a non-root user (UID 1000) — HF enforces this
#
# Build:  docker build -t cyberbully-api .
# Run:    docker run -p 7860:7860 cyberbully-api
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (UID 1000 as required by HF Spaces)
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy dependency file first (better layer caching)
COPY requirements.txt .

# Install Python dependencies
# The --extra-index-url for CPU torch is already in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Ensure non-root user owns the files
RUN chown -R appuser:appuser /app

USER appuser

# HF Spaces expects the app on port 7860
EXPOSE 7860

# Set env defaults (can be overridden via HF Space secrets)
ENV MODEL_NAME="Sohammore13/cyberbullying-detector" \
    KEYWORDS_CSV="./abusive_words.csv" \
    PORT=7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
