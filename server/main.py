"""
FastAPI Cyberbullying Detection Backend
========================================
Endpoints
---------
GET  /              — health check
GET  /health        — detailed health check
POST /predict       — single text inference
POST /predict-batch — batched inference (single model forward pass)
POST /youtube/analyze — fetch YouTube video comments + run toxicity detection (see routers/youtube.py)

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
# Lifespan — load once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _keywords_df

    # Load model from HuggingFace Hub
    logger.info("Using Hugging Face Serverless Inference API for model: %s", MODEL_NAME)

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
    version="2.0.0",
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
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise HTTPException(
            status_code=500,
            detail="HF_TOKEN environment variable is not set.",
        )

    headers = {"Authorization": f"Bearer {hf_token}"}
    payload = {"inputs": texts}

    api_url = f"https://api-inference.huggingface.co/models/{MODEL_NAME}"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(api_url, headers=headers, json=payload, timeout=30.0)

    if response.status_code != 200:
        logger.error("HF API Error: %s", response.text)
        raise HTTPException(
            status_code=502,
            detail=f"Hugging Face API Error: {response.text}",
        )

    # API returns list of lists (batch size x num labels)
    results_json = response.json()
    
    results = []
    for predictions in results_json:
        best_pred = max(predictions, key=lambda x: x["score"])
        results.append((best_pred["label"], float(best_pred["score"])))
        
    return results


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
        "keywords_loaded": _keywords_df is not None,
    }


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "keywords_count": len(_keywords_df) if _keywords_df is not None else 0,
        "labels": LABELS,
    }


@app.post("/predict", response_model=PredictResponse, tags=["Inference"])
async def predict(request: PredictRequest) -> PredictResponse:
    """Classify a single piece of text."""
    text = clean_text(request.text)
    if not text:
        raise HTTPException(status_code=422, detail="Text is empty after cleaning.")

    model_results = await run_inference_batch([text])
    (predicted_category, toxicity_score) = model_results[0]
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
    Classify a list of texts in a single batched model forward pass.
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

    # Single batched forward pass for all texts
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
