"""
routers/instagram.py
====================
FastAPI router for Instagram Graph API integration.

Routes
------
GET  /auth/instagram/login                   — redirect to Meta OAuth consent screen
GET  /auth/instagram/callback                — handle code → token exchange, set session
POST /auth/instagram/logout                  — clear session cookie
GET  /auth/instagram/me                      — return logged-in user's IG profile
GET  /instagram/media                        — list user's recent posts
GET  /instagram/media/{media_id}/comments    — fetch comments for a post (paginated)
GET  /instagram/media/{media_id}/analyze     — fetch comments + run toxicity prediction

Session storage
---------------
The long-lived Instagram access token is stored in a server-side signed cookie
(Starlette SessionMiddleware with itsdangerous).  The raw token is NEVER sent
to the browser.

CSRF protection
---------------
A random `state` value is generated at login time, stored in the session, and
verified on callback to prevent CSRF token theft.
"""

import os
import secrets
import logging
import urllib.parse
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

from services import instagram_service as ig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config — read from environment (set via .env locally, HF Secrets in prod)
# ---------------------------------------------------------------------------

INSTAGRAM_APP_ID      = os.getenv("INSTAGRAM_APP_ID", "")
INSTAGRAM_APP_SECRET  = os.getenv("INSTAGRAM_APP_SECRET", "")
INSTAGRAM_REDIRECT_URI = os.getenv(
    "INSTAGRAM_REDIRECT_URI",
    "http://localhost:8000/auth/instagram/callback",
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Scopes for Instagram Business / Creator accounts
# instagram_business_basic     → read profile + media
# instagram_business_manage_comments → read comments
INSTAGRAM_SCOPES = "instagram_business_basic,instagram_business_manage_comments"

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["Instagram"])


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_token(request: Request) -> str:
    """
    Pull the access token from the session cookie.
    Raises 401 if the user is not logged in.
    """
    token = request.session.get("instagram_access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Visit /auth/instagram/login first.",
        )
    return token


# ---------------------------------------------------------------------------
# OAuth routes
# ---------------------------------------------------------------------------

@router.get(
    "/auth/instagram/login",
    summary="Redirect user to Instagram OAuth consent screen",
    response_class=RedirectResponse,
)
async def instagram_login(request: Request) -> RedirectResponse:
    """
    Generate a CSRF-safe `state` token, store it in the session, then
    redirect the browser to Meta's OAuth dialog.
    """
    if not INSTAGRAM_APP_ID:
        raise HTTPException(
            status_code=500,
            detail="INSTAGRAM_APP_ID is not configured on the server.",
        )

    # Generate and store CSRF state
    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state

    params = {
        "client_id":     INSTAGRAM_APP_ID,
        "redirect_uri":  INSTAGRAM_REDIRECT_URI,
        "scope":         INSTAGRAM_SCOPES,
        "response_type": "code",
        "state":         state,
    }
    auth_url = (
        "https://www.instagram.com/oauth/authorize?"
        + urllib.parse.urlencode(params)
    )
    logger.info("Redirecting to Instagram OAuth (%s).", auth_url[:80])
    return RedirectResponse(url=auth_url)


@router.get(
    "/auth/instagram/callback",
    summary="Handle OAuth callback — exchange code for token",
)
async def instagram_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_reason: str | None = None,
) -> RedirectResponse:
    """
    Meta redirects here after the user grants (or denies) permission.

    1. Verify CSRF state.
    2. Exchange `code` for a short-lived token.
    3. Exchange short-lived token for a long-lived token (~60 days).
    4. Store the long-lived token in the signed session cookie.
    5. Redirect to the frontend.
    """
    # --- User denied access ---
    if error:
        logger.warning("Instagram OAuth denied: %s — %s", error, error_reason)
        redirect = f"{FRONTEND_URL}?instagram_error={urllib.parse.quote(error_reason or error)}"
        return RedirectResponse(url=redirect)

    # --- CSRF check ---
    expected_state = request.session.get("oauth_state")
    if not state or state != expected_state:
        logger.error("OAuth state mismatch. Expected=%s Got=%s", expected_state, state)
        raise HTTPException(status_code=400, detail="Invalid OAuth state. Possible CSRF attack.")
    request.session.pop("oauth_state", None)  # consume the state token

    if not code:
        raise HTTPException(status_code=400, detail="Missing `code` parameter from Meta callback.")

    # --- Exchange code → short-lived token ---
    try:
        short_data = await ig.exchange_code_for_short_lived_token(
            code=code,
            app_id=INSTAGRAM_APP_ID,
            app_secret=INSTAGRAM_APP_SECRET,
            redirect_uri=INSTAGRAM_REDIRECT_URI,
        )
    except Exception as exc:
        logger.error("Short-lived token exchange failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {exc}")

    short_token = short_data.get("access_token")
    if not short_token:
        raise HTTPException(status_code=502, detail="No access_token in Meta response.")

    # --- Exchange → long-lived token (~60 days) ---
    try:
        long_data = await ig.exchange_for_long_lived_token(
            short_lived_token=short_token,
            app_secret=INSTAGRAM_APP_SECRET,
        )
    except Exception as exc:
        logger.error("Long-lived token exchange failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Long-lived token exchange failed: {exc}")

    long_token = long_data.get("access_token")
    if not long_token:
        raise HTTPException(status_code=502, detail="No long-lived access_token in Meta response.")

    # --- Store in session ---
    request.session["instagram_access_token"] = long_token
    request.session["instagram_token_expires_in"] = long_data.get("expires_in")
    logger.info("Long-lived token stored in session (expires_in=%s s).", long_data.get("expires_in"))

    # --- Redirect to frontend ---
    return RedirectResponse(url=f"{FRONTEND_URL}?instagram_auth=success")


@router.post(
    "/auth/instagram/logout",
    summary="Clear the Instagram session",
)
async def instagram_logout(request: Request) -> dict[str, str]:
    """Remove the stored token from the session cookie."""
    request.session.pop("instagram_access_token", None)
    request.session.pop("instagram_token_expires_in", None)
    logger.info("Instagram session cleared.")
    return {"status": "logged_out"}


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@router.get(
    "/auth/instagram/me",
    summary="Return the authenticated user's Instagram profile",
)
async def get_me(request: Request) -> dict[str, Any]:
    """
    Lightweight probe the frontend can call on load to check auth state.
    Returns 401 if not authenticated, 200 + profile data if authenticated.
    """
    token = _get_token(request)
    try:
        profile = await ig.get_me(token)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return profile


# ---------------------------------------------------------------------------
# Media (posts)
# ---------------------------------------------------------------------------

@router.get(
    "/instagram/media",
    summary="List the authenticated user's recent Instagram posts",
)
async def list_media(request: Request) -> dict[str, Any]:
    """
    Returns the user's most recent 20 posts.

    Each item:
    ```json
    {
        "id": "...",
        "caption": "...",
        "media_type": "IMAGE | VIDEO | CAROUSEL_ALBUM",
        "display_url": "https://...",
        "permalink": "https://www.instagram.com/p/...",
        "timestamp": "2024-01-01T12:00:00+0000"
    }
    ```
    """
    token = _get_token(request)
    try:
        posts = await ig.get_user_media(token)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"media": posts, "count": len(posts)}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

@router.get(
    "/instagram/media/{media_id}/comments",
    summary="Fetch comments for a specific post (paginated, max 50 per page)",
)
async def get_comments(
    media_id: str,
    request: Request,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Returns up to 50 comments for the given media_id.

    Query params:
    - `after` (optional): pagination cursor returned as `next_cursor` in a
      previous response.

    Response:
    ```json
    {
        "media_id": "...",
        "comments": [
            { "id": "...", "text": "...", "username": "...", "timestamp": "..." }
        ],
        "next_cursor": "<string or null>"
    }
    ```
    """
    token = _get_token(request)
    try:
        result = await ig.get_media_comments(media_id, token, after=after)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {
        "media_id":    media_id,
        "comments":    result["comments"],
        "next_cursor": result["next_cursor"],
    }


# ---------------------------------------------------------------------------
# Analyze — comments + toxicity prediction
# ---------------------------------------------------------------------------

@router.get(
    "/instagram/media/{media_id}/analyze",
    summary="Fetch comments and run toxicity detection on each one",
)
async def analyze_comments(
    media_id: str,
    request: Request,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Fetches up to 50 comments for the given post and runs each through the
    cyberbullying detection model in a single batched forward pass.

    Response:
    ```json
    {
        "media_id": "...",
        "next_cursor": "<string or null>",
        "results": [
            {
                "comment_id":         "...",
                "text":               "...",
                "username":           "...",
                "timestamp":          "...",
                "predicted_category": "gender",
                "toxicity_score":     0.9231,
                "toxicity_level":     "Severe",
                "matched_words":      ["word1"]
            }
        ],
        "summary": {
            "total_comments":    10,
            "toxic_count":       3,
            "toxicity_rate":     0.3
        }
    }
    ```

    Notes
    -----
    - Uses the internal `run_inference_batch` function from main.py directly
      (no HTTP roundtrip — same process, single forward pass for all comments).
    - Requires the user to be authenticated via /auth/instagram/login.
    - Comments with empty text after cleaning are labelled 'not_cyberbullying'
      with a toxicity_score of 0.0.
    """
    # Import here to avoid circular imports at module load time.
    # main.py is the app entry point; we pull only what we need.
    from main import run_inference_batch, clean_text, keyword_check, build_response

    token = _get_token(request)

    # 1. Fetch comments from Graph API
    try:
        result = await ig.get_media_comments(media_id, token, after=after)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    comments    = result["comments"]
    next_cursor = result["next_cursor"]

    if not comments:
        return {
            "media_id":   media_id,
            "next_cursor": next_cursor,
            "results":    [],
            "summary": {
                "total_comments": 0,
                "toxic_count":    0,
                "toxicity_rate":  0.0,
            },
        }

    # 2. Clean texts for inference
    cleaned_texts = [clean_text(c.get("text", "")) for c in comments]

    # 3. Separate empty comments (nothing to infer on) from non-empty ones
    non_empty_indices = [i for i, t in enumerate(cleaned_texts) if t]
    empty_indices     = [i for i, t in enumerate(cleaned_texts) if not t]

    # 4. Batched inference on non-empty comments
    non_empty_texts = [cleaned_texts[i] for i in non_empty_indices]
    if non_empty_texts:
        model_results = run_inference_batch(non_empty_texts)
    else:
        model_results = []

    # 5. Build per-comment results, preserving original order
    model_iter = iter(model_results)
    combined = []
    for idx, comment in enumerate(comments):
        raw_text = comment.get("text", "")
        cleaned  = cleaned_texts[idx]

        if idx in empty_indices or not cleaned:
            # Empty comment — trivially safe
            combined.append({
                "comment_id":         comment.get("id"),
                "text":               raw_text,
                "username":           comment.get("username", ""),
                "timestamp":          comment.get("timestamp", ""),
                "predicted_category": "not_cyberbullying",
                "toxicity_score":     0.0,
                "toxicity_level":     "Low",
                "matched_words":      [],
            })
        else:
            predicted_category, toxicity_score = next(model_iter)
            matched_words, keyword_category    = keyword_check(cleaned)
            pred = build_response(
                predicted_category, toxicity_score,
                matched_words, keyword_category,
            )
            combined.append({
                "comment_id":         comment.get("id"),
                "text":               raw_text,
                "username":           comment.get("username", ""),
                "timestamp":          comment.get("timestamp", ""),
                "predicted_category": pred.predicted_category,
                "toxicity_score":     pred.toxicity_score,
                "toxicity_level":     pred.toxicity_level,
                "matched_words":      pred.matched_words,
            })

    # 6. Summary stats
    toxic_count = sum(
        1 for r in combined if r["predicted_category"] != "not_cyberbullying"
    )
    total = len(combined)

    logger.info(
        "analyze_comments media_id=%s total=%d toxic=%d",
        media_id, total, toxic_count,
    )

    return {
        "media_id":    media_id,
        "next_cursor": next_cursor,
        "results":     combined,
        "summary": {
            "total_comments": total,
            "toxic_count":    toxic_count,
            "toxicity_rate":  round(toxic_count / total, 4) if total else 0.0,
        },
    }
