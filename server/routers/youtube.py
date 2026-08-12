"""
routers/youtube.py
===================
FastAPI router for YouTube Data API v3 integration.

Routes
------
POST   /youtube/analyze            — fetch comments + run toxicity detection
GET    /youtube/auth               — redirect user to Google OAuth consent screen
GET    /youtube/callback           — handle OAuth callback, store token
GET    /youtube/auth-status        — check if the server is authenticated
DELETE /youtube/comment/{id}       — delete a comment as channel owner (OAuth required)
POST   /youtube/logout             — revoke stored OAuth token

Auth
----
Analyzing comments uses the server-side YOUTUBE_API_KEY (read-only).
Deleting comments requires the channel owner to have authenticated via
/youtube/auth (OAuth 2.0 with youtube.force-ssl scope).
"""

import os
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from services import youtube_service as yt
from services import oauth_service as oauth

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

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
# OAuth routes — Connect YouTube channel owner account
# ---------------------------------------------------------------------------

@router.get(
    "/youtube/auth",
    summary="Redirect to Google OAuth consent screen to authenticate as channel owner",
)
async def youtube_auth():
    """
    Generates the Google OAuth URL and redirects the user to it.
    After granting permission, Google redirects back to /youtube/callback.
    """
    try:
        auth_url = oauth.build_auth_url()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RedirectResponse(url=auth_url)


@router.get(
    "/youtube/callback",
    summary="OAuth callback — exchanges authorization code for access token",
)
async def youtube_callback(code: str = "", error: str = ""):
    """
    Google redirects here after the user grants (or denies) permission.
    On success: exchanges the code for tokens and saves them, then redirects
    the user back to the frontend.
    """
    if error:
        logger.warning("OAuth callback received error: %s", error)
        return RedirectResponse(url=f"{FRONTEND_URL}?oauth_error={error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    try:
        oauth.exchange_code_for_token(code)
    except Exception as exc:
        logger.error("Token exchange failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {exc}")

    # Redirect back to the frontend with a success flag so the UI can update
    return RedirectResponse(url=f"{FRONTEND_URL}?oauth_success=1")


@router.get(
    "/youtube/auth-status",
    summary="Check whether the server has a valid YouTube OAuth token",
)
async def youtube_auth_status() -> dict[str, Any]:
    """Returns {'authenticated': true/false}."""
    return {"authenticated": oauth.is_authenticated()}


@router.post(
    "/youtube/logout",
    summary="Revoke stored OAuth token",
)
async def youtube_logout() -> dict[str, str]:
    """Deletes the stored token file. The user must re-authenticate to delete comments."""
    oauth.revoke_token()
    return {"status": "logged_out"}


# ---------------------------------------------------------------------------
# Comment deletion — requires channel-owner OAuth
# ---------------------------------------------------------------------------

@router.delete(
    "/youtube/comment/{comment_id}",
    summary="Delete a comment as the authenticated channel owner",
)
async def delete_comment(comment_id: str) -> dict[str, str]:
    """
    Permanently deletes the comment with the given ID from YouTube.

    Requires the channel owner to be authenticated (via /youtube/auth).
    The channel owner can delete ANY comment on their own videos, including
    comments posted by other users.
    """
    creds = oauth.get_valid_credentials()
    if creds is None:
        raise HTTPException(
            status_code=401,
            detail=(
                "Not authenticated. Please visit /youtube/auth to connect your "
                "YouTube channel owner account first."
            ),
        )

    try:
        await yt.delete_comment(comment_id, creds)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"status": "deleted", "comment_id": comment_id}


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
                "comment_id": "UgyXXX...",
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
    - comment_id is included so the frontend can pass it to DELETE /youtube/comment/{id}.
    - Uses the internal `run_inference_batch` function from main.py directly
      (no HTTP roundtrip — same process, single forward pass for all comments).
    - Requires YOUTUBE_API_KEY to be configured on the server.
    - Comments with empty text after cleaning are labelled 'not_cyberbullying'
      with a toxicity_score of 0.0.
    """
    # Import here to avoid circular imports at module load time.
    # Dynamically detects whether main_deploy (HF API) or main (local PyTorch) is running.
    import sys
    if "main_deploy" in sys.modules:
        from main_deploy import run_inference_batch, clean_text, keyword_check, build_response
    elif "main" in sys.modules:
        from main import run_inference_batch, clean_text, keyword_check, build_response
    else:
        try:
            from main_deploy import run_inference_batch, clean_text, keyword_check, build_response
        except ImportError:
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
            "authenticated": oauth.is_authenticated(),
        }

    # 4. Clean texts for inference
    cleaned_texts = [clean_text(c.get("text", "")) for c in comments]

    # 5. Separate empty comments (nothing to infer on) from non-empty ones
    non_empty_indices = [i for i, t in enumerate(cleaned_texts) if t]
    empty_indices = [i for i, t in enumerate(cleaned_texts) if not t]

    # 6. Batched inference on non-empty comments
    # run_inference_batch is sync in main.py (local) and async in main_deploy.py
    non_empty_texts = [cleaned_texts[i] for i in non_empty_indices]
    if non_empty_texts:
        import inspect
        if inspect.iscoroutinefunction(run_inference_batch):
            model_results = await run_inference_batch(non_empty_texts)
        else:
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
            results.append({
                "comment_id": comment.get("comment_id", ""),
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
                "comment_id": comment.get("comment_id", ""),
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
        "authenticated": oauth.is_authenticated(),  # tells frontend if delete is available
    }
