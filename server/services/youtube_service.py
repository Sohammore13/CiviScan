"""
youtube_service.py
===================
Thin async wrapper around the YouTube Data API v3.

All public functions accept an api_key string and return plain dicts /
lists — no framework coupling so they can be called from any router or test.

YouTube Data API base: https://www.googleapis.com/youtube/v3
"""

import re
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

# How many comments per page (YouTube Data API max is 100) and the overall
# cap for a single /youtube/analyze call.
COMMENT_PAGE_SIZE = 100
COMMENT_LIMIT = 100

# Regex patterns covering the video-URL shapes we need to support:
#   https://www.youtube.com/watch?v=VIDEO_ID
#   https://youtu.be/VIDEO_ID
#   https://www.youtube.com/shorts/VIDEO_ID
_VIDEO_ID_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?.*?v=)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtu\.be/)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/shorts/)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/embed/)([A-Za-z0-9_-]{11})"),
]


# ---------------------------------------------------------------------------
# URL parsing
# ---------------------------------------------------------------------------

def extract_video_id(url: str) -> Optional[str]:
    """
    Extract the 11-character YouTube video ID from any of the supported
    URL formats. Returns None if the URL doesn't match a known pattern.
    """
    if not url:
        return None

    url = url.strip()
    for pattern in _VIDEO_ID_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)

    return None


# ---------------------------------------------------------------------------
# Video metadata
# ---------------------------------------------------------------------------

async def get_video_details(video_id: str, api_key: str) -> dict[str, Any]:
    """
    Return basic metadata for a video: title and channel title.

    Raises ValueError if the video is not found or the API returns an error.
    """
    params = {
        "part": "snippet",
        "id": video_id,
        "key": api_key,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{YOUTUBE_API_BASE}/videos", params=params)
    _raise_for_api_error(resp)
    data = resp.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"No video found for video_id={video_id}.")

    snippet = items[0].get("snippet", {})
    return {
        "video_id": video_id,
        "title": snippet.get("title", ""),
        "channel_title": snippet.get("channelTitle", ""),
    }


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

async def get_video_comments(
    video_id: str,
    api_key: str,
    limit: int = COMMENT_LIMIT,
) -> list[dict[str, Any]]:
    """
    Fetch top-level comments for a video, handling pagination transparently
    until `limit` comments have been collected (or comments run out).

    Returns
    -------
    [ { "text": "...", "author": "...", "published_at": "..." }, ... ]
    """
    comments: list[dict[str, Any]] = []
    page_token: Optional[str] = None

    async with httpx.AsyncClient() as client:
        while len(comments) < limit:
            params: dict[str, Any] = {
                "part": "snippet",
                "videoId": video_id,
                "maxResults": min(COMMENT_PAGE_SIZE, limit - len(comments)),
                "order": "relevance",
                "textFormat": "plainText",
                "key": api_key,
            }
            if page_token:
                params["pageToken"] = page_token

            resp = await client.get(
                f"{YOUTUBE_API_BASE}/commentThreads", params=params
            )
            _raise_for_api_error(resp)
            data = resp.json()

            for item in data.get("items", []):
                top_comment = (
                    item.get("snippet", {})
                    .get("topLevelComment", {})
                    .get("snippet", {})
                )
                comments.append({
                    "text": top_comment.get("textDisplay", ""),
                    "author": top_comment.get("authorDisplayName", ""),
                    "published_at": top_comment.get("publishedAt", ""),
                })
                if len(comments) >= limit:
                    break

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    logger.info(
        "Fetched %d comments for video_id=%s.", len(comments), video_id
    )
    return comments


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _raise_for_api_error(resp: httpx.Response) -> None:
    """
    Raise a descriptive ValueError if the YouTube Data API returned an error
    payload, even with an HTTP 200 status.
    """
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            err = resp.json().get("error", {})
            msg = err.get("message", str(exc))
            code = err.get("code", resp.status_code)
        except Exception:
            msg, code = str(exc), resp.status_code
        logger.error("YouTube Data API HTTP error %s: %s", code, msg)
        raise ValueError(f"YouTube Data API error {code}: {msg}") from exc

    # The API occasionally returns 200 with an error body
    try:
        body = resp.json()
    except Exception:
        return

    if "error" in body:
        err = body["error"]
        msg = err.get("message", "Unknown YouTube Data API error")
        code = err.get("code", 0)
        logger.error("YouTube Data API logical error %s: %s", code, msg)
        raise ValueError(f"YouTube Data API error {code}: {msg}")
