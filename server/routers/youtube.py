"""
routers/youtube.py
===================
FastAPI router for YouTube Data API v3 integration.

Routes
------
POST /youtube/analyze   — fetch a video's comments and run toxicity prediction

Flow
----
Paste YouTube Video URL → Fetch YouTube comments → Send comments to the
existing cyberbullying detection model (same one used by /predict-batch).

Auth
----
Unlike the previous Instagram integration, this endpoint requires no user
login — it uses a single server-side API key (YOUTUBE_API_KEY) read from
the environment.
"""

import os
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import youtube_service as yt

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config — read from environment (set via .env locally, HF Secrets in prod)
# ---------------------------------------------------------------------------

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["YouTube"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class YouTubeAnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=1, description="YouTube video URL")


# ---------------------------------------------------------------------------
# Analyze — comments + toxicity prediction
# ---------------------------------------------------------------------------

@router.post(
    "/youtube/analyze",
    summary="Fetch a YouTube video's comments and run toxicity detection on each one",
)
async def analyze_video(request: YouTubeAnalyzeRequest) -> dict[str, Any]:
    """
    Extracts the video ID from the given URL, fetches up to 100 top-level
    comments via the YouTube Data API v3, and runs each comment through the
    cyberbullying detection model in a single batched forward pass.

    Response:
    ```json
    {
        "video_title": "...",
        "total_comments": 100,
        "results": [
            {
                "comment": "...",
                "author": "...",
                "published_at": "...",
                "prediction": "...",
                "confidence": 0.98
            }
        ]
    }
    ```

    Notes
    -----
    - Uses the internal `run_inference_batch` function from main.py directly
      (no HTTP roundtrip — same process, single forward pass for all comments).
    - Requires YOUTUBE_API_KEY to be configured on the server.
    - Comments with empty text after cleaning are labelled 'not_cyberbullying'
      with a toxicity_score of 0.0.
    """
    # Import here to avoid circular imports at module load time.
    # main.py is the app entry point; we pull only what we need.
    from main import run_inference_batch, clean_text, keyword_check, build_response

    if not YOUTUBE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="YOUTUBE_API_KEY is not configured on the server.",
        )

    # 1. Extract video ID from the pasted URL
    video_id = yt.extract_video_id(request.url)
    if not video_id:
        raise HTTPException(
            status_code=422,
            detail="Invalid YouTube URL. Expected a youtube.com/watch, "
                   "youtu.be, or youtube.com/shorts link.",
        )

    # 2. Fetch video metadata (title)
    try:
        details = await yt.get_video_details(video_id, YOUTUBE_API_KEY)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # 3. Fetch comments (paginated, capped at 100)
    try:
        comments = await yt.get_video_comments(video_id, YOUTUBE_API_KEY)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if not comments:
        return {
            "video_title": details["title"],
            "total_comments": 0,
            "results": [],
        }

    # 4. Clean texts for inference
    cleaned_texts = [clean_text(c.get("text", "")) for c in comments]

    # 5. Separate empty comments (nothing to infer on) from non-empty ones
    non_empty_indices = [i for i, t in enumerate(cleaned_texts) if t]
    empty_indices = [i for i, t in enumerate(cleaned_texts) if not t]

    # 6. Batched inference on non-empty comments
    non_empty_texts = [cleaned_texts[i] for i in non_empty_indices]
    if non_empty_texts:
        model_results = run_inference_batch(non_empty_texts)
    else:
        model_results = []

    # 7. Build per-comment results, preserving original order
    model_iter = iter(model_results)
    results = []
    for idx, comment in enumerate(comments):
        raw_text = comment.get("text", "")
        cleaned = cleaned_texts[idx]

        if idx in empty_indices or not cleaned:
            # Empty comment — trivially safe
            results.append({
                "comment": raw_text,
                "author": comment.get("author", ""),
                "published_at": comment.get("published_at", ""),
                "prediction": "not_cyberbullying",
                "confidence": 0.0,
            })
        else:
            predicted_category, toxicity_score = next(model_iter)
            matched_words, keyword_category = keyword_check(cleaned)
            pred = build_response(
                predicted_category, toxicity_score,
                matched_words, keyword_category,
            )
            results.append({
                "comment": raw_text,
                "author": comment.get("author", ""),
                "published_at": comment.get("published_at", ""),
                "prediction": pred.predicted_category,
                "confidence": pred.toxicity_score,
            })

    logger.info(
        "analyze_video video_id=%s total=%d",
        video_id, len(results),
    )

    return {
        "video_title": details["title"],
        "channel_title": details.get("channel_title", ""),
        "total_comments": len(results),
        "results": results,
    }
