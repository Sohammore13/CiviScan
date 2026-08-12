"""
FastAPI Cyberbullying Detection Backend — DEPLOYMENT VERSION
=============================================================
Uses Hugging Face Serverless Inference API instead of loading
PyTorch / Transformers locally.

Benefits for free-tier hosting (Render, Koyeb, Railway):
 - RAM usage: ~80–100 MB (no torch, no model weights in memory)
 - Cold start: fast (no model loading)
 - Requires HF_TOKEN env var (free HF account → Settings → Access Tokens)

Endpoints
---------
GET  /              — health check
GET  /health        — detailed health check
POST /predict       — single text inference
POST /predict-batch — batched inference
POST /youtube/analyze — fetch YouTube video comments + run toxicity detection

Model: Sohammore13/cyberbullying-detector (HuggingFace Hub)
Keyword override: abusive_words.csv (word, main_category, toxicity_level, harm_type)
"""

import os
import re
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

MODEL_NAME: str = os.getenv("MODEL_NAME", "Sohammore13/cyberbullying-detector")
KEYWORDS_CSV: str = os.getenv("KEYWORDS_CSV", "./abusive_words.csv")
HF_TOKEN: str = os.getenv("HF_TOKEN", "")  # HF Inference API token (free)

# HF Serverless Inference endpoint
HF_INFERENCE_URL = f"https://api-inference.huggingface.co/models/{MODEL_NAME}"

# Canonical label set — must match the model's id2label ordering
LABELS = [
    "age",
    "ethnicity",
    "gender",
    "religion",
    "other_cyberbullying",
    "not_cyberbullying",
]

# CSV main_category → model label
CATEGORY_MAP = {
    "general": "other_cyberbullying",
    "gender": "gender",
    "age": "age",
    "ethnicity": "ethnicity",
    "religion": "religion",
    "other_cyberbullying": "other_cyberbullying",
    "not_cyberbullying": "not_cyberbullying",
}

# Toxicity score → level
TOXICITY_THRESHOLDS = [
    (0.85, "Severe"),
    (0.60, "High"),
    (0.30, "Medium"),
    (0.00, "Low"),
]

KEYWORD_HIT_MIN_SCORE = 0.90

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

_keywords_df: Optional[pd.DataFrame] = None  # pre-processed keyword list


# ---------------------------------------------------------------------------
# Lifespan — load CSV at startup (no model loading needed)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _keywords_df

    if not HF_TOKEN:
        logger.warning(
            "HF_TOKEN is not set. Inference API calls will be rate-limited "
            "(~10 req/min for unauthenticated). Set HF_TOKEN for higher limits."
        )

    # Warm-up: ping the model so HF loads it before first real request
    try:
        logger.info("Warming up HF Inference API model: %s", MODEL_NAME)
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}
            r = await client.post(
                HF_INFERENCE_URL,
                headers=headers,
                json={"inputs": ["hello world"]},
            )
        if r.status_code in (200, 503):
            # 503 = model loading, that's OK — it will be ready for real requests
            logger.info("HF Inference API warm-up done (status=%d).", r.status_code)
        else:
            logger.warning("HF warm-up returned unexpected status=%d.", r.status_code)
    except Exception as exc:
        logger.warning("HF warm-up failed (non-fatal): %s", exc)

    # Load keyword CSV
    csv_path = Path(KEYWORDS_CSV)
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        df.columns = [c.strip().lower() for c in df.columns]

        required = {"word", "main_category"}
        if not required.issubset(df.columns):
            logger.error("CSV missing required columns. Found: %s", list(df.columns))
        else:
            df["word"] = df["word"].astype(str).str.strip().str.lower()
            df["main_category"] = df["main_category"].astype(str).str.strip().str.lower()
            # Sort longest phrases first so multi-word matches take priority
            df = df.sort_values("word", key=lambda s: s.str.len(), ascending=False)
            _keywords_df = df.reset_index(drop=True)
            logger.info("Loaded %d keywords from '%s'.", len(_keywords_df), csv_path)
    else:
        logger.warning("Keywords CSV '%s' not found — keyword matching disabled.", csv_path)

    yield

    logger.info("Shutting down.")
    _keywords_df = None


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Cyberbullying Detection API",
    description="Classifies text into cyberbullying categories with keyword-override support.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

from routers.youtube import router as youtube_router  # noqa: E402
app.include_router(youtube_router)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to classify")


class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, description="List of texts to classify")


class PredictResponse(BaseModel):
    predicted_category: str
    toxicity_score: float
    toxicity_level: str
    matched_words: list[str]


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Strip URLs, @mentions, and normalise whitespace."""
    text = re.sub(r"https?://\S+", "", text)          # remove URLs
    text = re.sub(r"@\w+", "", text)                   # remove @mentions
    text = re.sub(r"\s+", " ", text).strip()           # collapse whitespace
    return text


def toxicity_level(score: float) -> str:
    for threshold, label in TOXICITY_THRESHOLDS:
        if score >= threshold:
            return label
    return "Low"


def keyword_check(text: str) -> tuple[list[str], Optional[str]]:
    """
    Scan cleaned text for abusive keywords/phrases.

    Handles both:
    - Multi-word phrases (substring match within the text)
    - Single words     (whole-word boundary match)

    Returns (matched_words, top_category).
    """
    if _keywords_df is None:
        return [], None

    text_lower = text.lower()
    matched = []

    for _, row in _keywords_df.iterrows():
        kw = row["word"]
        if " " in kw:
            # Multi-word phrase — simple substring match
            if kw in text_lower:
                matched.append(row)
        else:
            # Single word — whole-word boundary to avoid false positives
            if re.search(rf"\b{re.escape(kw)}\b", text_lower):
                matched.append(row)

    if not matched:
        return [], None

    matched_df = pd.DataFrame(matched)
    matched_words = matched_df["word"].unique().tolist()
    top_category = matched_df["main_category"].value_counts().idxmax()
    return matched_words, top_category


async def run_inference_batch(texts: list[str]) -> list[tuple[str, float]]:
    """
    Call Hugging Face Serverless Inference API.
    Returns list of (predicted_label, toxicity_score) tuples.

    HF API returns: list of list of {"label": ..., "score": ...}
    One inner list per input text.
    """
    if not HF_TOKEN:
        headers = {}
    else:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    payload = {"inputs": texts}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(HF_INFERENCE_URL, headers=headers, json=payload)

    if response.status_code == 503:
        # Model is loading on HF side — retry hint
        raise HTTPException(
            status_code=503,
            detail="Model is loading on HuggingFace, please retry in 20 seconds.",
        )

    if response.status_code != 200:
        logger.error("HF API Error %d: %s", response.status_code, response.text)
        raise HTTPException(
            status_code=502,
            detail=f"HuggingFace API error: {response.status_code} — {response.text[:200]}",
        )

    results_json = response.json()

    # Handle both single-text (list of dicts) and batch (list of list of dicts)
    if texts and isinstance(results_json[0], dict):
        # Single input returned as flat list — wrap it
        results_json = [results_json]

    output = []
    for predictions in results_json:
        best = max(predictions, key=lambda x: x["score"])
        output.append((best["label"], float(best["score"])))

    return output


def build_response(
    predicted_category: str,
    toxicity_score: float,
    matched_words: list[str],
    keyword_category: Optional[str],
) -> PredictResponse:
    """Apply keyword override logic and assemble the final response."""
    if matched_words:
        toxicity_score = max(toxicity_score, KEYWORD_HIT_MIN_SCORE)
        if keyword_category:
            mapped = CATEGORY_MAP.get(keyword_category.lower(), "other_cyberbullying")
            predicted_category = mapped

    return PredictResponse(
        predicted_category=predicted_category,
        toxicity_score=round(toxicity_score, 4),
        toxicity_level=toxicity_level(toxicity_score),
        matched_words=matched_words,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "mode": "hf-inference-api",
        "model": MODEL_NAME,
        "keywords_loaded": _keywords_df is not None,
    }


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "mode": "hf-inference-api",
        "model": MODEL_NAME,
        "hf_token_set": bool(HF_TOKEN),
        "keywords_count": len(_keywords_df) if _keywords_df is not None else 0,
        "labels": LABELS,
    }


@app.post("/predict", response_model=PredictResponse, tags=["Inference"])
async def predict(request: PredictRequest) -> PredictResponse:
    """Classify a single piece of text."""
    text = clean_text(request.text)
    if not text:
        raise HTTPException(status_code=422, detail="Text is empty after cleaning.")

    (predicted_category, toxicity_score) = (await run_inference_batch([text]))[0]
    matched_words, keyword_category = keyword_check(text)

    response = build_response(predicted_category, toxicity_score, matched_words, keyword_category)

    logger.info(
        "predict → category=%s  score=%.4f  level=%s  keywords=%s",
        response.predicted_category,
        response.toxicity_score,
        response.toxicity_level,
        response.matched_words,
    )
    return response


@app.post("/predict-batch", response_model=BatchPredictResponse, tags=["Inference"])
async def predict_batch(request: BatchPredictRequest) -> BatchPredictResponse:
    """
    Classify a list of texts in a single HF Inference API call.
    Each text is cleaned and keyword-checked individually.
    """
    if not request.texts:
        raise HTTPException(status_code=422, detail="texts list must not be empty.")

    # Clean all texts first
    cleaned = [clean_text(t) for t in request.texts]
    empty_indices = [i for i, t in enumerate(cleaned) if not t]
    if empty_indices:
        raise HTTPException(
            status_code=422,
            detail=f"Texts at indices {empty_indices} are empty after cleaning.",
        )

    # Single batched API call for all texts
    model_results = await run_inference_batch(cleaned)

    # Apply keyword override per text
    responses = []
    for text, (predicted_category, toxicity_score) in zip(cleaned, model_results):
        matched_words, keyword_category = keyword_check(text)
        responses.append(
            build_response(predicted_category, toxicity_score, matched_words, keyword_category)
        )

    logger.info("predict-batch → %d texts processed.", len(responses))
    return BatchPredictResponse(results=responses)
