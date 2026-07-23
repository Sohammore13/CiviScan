"""
instagram_service.py
====================
Thin async wrapper around the Instagram Graph API v21.0.

All public functions accept an access_token string and return plain dicts /
lists — no framework coupling so they can be called from any router or test.

Graph API base: https://graph.instagram.com/v21.0
"""

import os
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GRAPH_BASE = "https://graph.instagram.com/v21.0"
OAUTH_BASE = "https://www.instagram.com/oauth"
TOKEN_URL  = "https://graph.instagram.com/oauth/access_token"  # short-lived
LONG_LIVED_URL = "https://graph.instagram.com/access_token"    # long-lived

# Media fields returned for each post
MEDIA_FIELDS = (
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
)

# Comment fields
COMMENT_FIELDS = "id,text,username,timestamp"

# How many posts / comments per page (Graph API max is 100)
MEDIA_LIMIT   = 20
COMMENT_LIMIT = 50   # capped; next_cursor returned for manual pagination


# ---------------------------------------------------------------------------
# Token exchange helpers
# ---------------------------------------------------------------------------

async def exchange_code_for_short_lived_token(
    code: str,
    app_id: str,
    app_secret: str,
    redirect_uri: str,
) -> dict[str, Any]:
    """
    Exchange the OAuth authorization code for a short-lived user access token.

    Returns the raw JSON from Meta (contains 'access_token', 'token_type',
    and optionally 'expires_in').
    """
    payload = {
        "client_id":     app_id,
        "client_secret": app_secret,
        "grant_type":    "authorization_code",
        "redirect_uri":  redirect_uri,
        "code":          code,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_URL, data=payload)
    resp.raise_for_status()
    data = resp.json()
    logger.info("Short-lived token obtained for user.")
    return data


async def exchange_for_long_lived_token(
    short_lived_token: str,
    app_secret: str,
) -> dict[str, Any]:
    """
    Exchange a short-lived token for a long-lived token (valid ~60 days).

    Returns the raw JSON from Meta (contains 'access_token', 'token_type',
    'expires_in' in seconds).
    """
    params = {
        "grant_type":        "ig_exchange_token",
        "client_secret":     app_secret,
        "access_token":      short_lived_token,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(LONG_LIVED_URL, params=params)
    resp.raise_for_status()
    data = resp.json()
    logger.info("Long-lived token obtained (expires_in=%s s).", data.get("expires_in"))
    return data


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

async def get_me(access_token: str) -> dict[str, Any]:
    """
    Return the authenticated user's Instagram profile fields.

    Fields: id, username, name, profile_picture_url, biography,
            followers_count, media_count, website
    """
    params = {
        "fields":       "id,username,name,profile_picture_url,biography,followers_count,media_count,website",
        "access_token": access_token,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GRAPH_BASE}/me", params=params)
    _raise_for_graph_error(resp)
    return resp.json()


# ---------------------------------------------------------------------------
# Media (posts)
# ---------------------------------------------------------------------------

async def get_user_media(access_token: str) -> list[dict[str, Any]]:
    """
    Return the user's most recent MEDIA_LIMIT posts.

    Each item contains: id, caption, media_type, media_url (or thumbnail_url
    for VIDEO), permalink, timestamp.
    """
    params = {
        "fields":       MEDIA_FIELDS,
        "limit":        MEDIA_LIMIT,
        "access_token": access_token,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GRAPH_BASE}/me/media", params=params)
    _raise_for_graph_error(resp)
    data = resp.json()
    posts = data.get("data", [])

    # For VIDEO posts, media_url may not be returned — fall back to thumbnail_url
    for post in posts:
        if post.get("media_type") == "VIDEO" and not post.get("media_url"):
            post["media_url"] = post.get("thumbnail_url", "")
        # Normalise: always present a display_url key the frontend can use
        post["display_url"] = post.get("media_url") or post.get("thumbnail_url", "")

    logger.info("Fetched %d media items.", len(posts))
    return posts


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

async def get_media_comments(
    media_id: str,
    access_token: str,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Return up to COMMENT_LIMIT comments for a given media_id.

    Parameters
    ----------
    media_id    : Instagram media (post) ID
    access_token: user access token
    after       : pagination cursor (from a previous call's next_cursor)

    Returns
    -------
    {
        "comments": [ { id, text, username, timestamp }, ... ],
        "next_cursor": "<string or None>"
    }
    """
    params: dict[str, Any] = {
        "fields":       COMMENT_FIELDS,
        "limit":        COMMENT_LIMIT,
        "access_token": access_token,
    }
    if after:
        params["after"] = after

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_BASE}/{media_id}/comments", params=params
        )
    _raise_for_graph_error(resp)
    data = resp.json()

    comments    = data.get("data", [])
    paging      = data.get("paging", {})
    cursors     = paging.get("cursors", {})
    next_cursor = cursors.get("after") if paging.get("next") else None

    logger.info(
        "Fetched %d comments for media_id=%s (next_cursor=%s).",
        len(comments), media_id, bool(next_cursor),
    )
    return {"comments": comments, "next_cursor": next_cursor}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _raise_for_graph_error(resp: httpx.Response) -> None:
    """
    Raise a descriptive ValueError if the Graph API returned an error payload,
    even with an HTTP 200 status (Meta does this sometimes).
    """
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Try to extract Meta's error message
        try:
            err = resp.json().get("error", {})
            msg = err.get("message", str(exc))
            code = err.get("code", resp.status_code)
        except Exception:
            msg, code = str(exc), resp.status_code
        logger.error("Graph API HTTP error %s: %s", code, msg)
        raise ValueError(f"Instagram Graph API error {code}: {msg}") from exc

    # Meta occasionally returns 200 with an error body
    try:
        body = resp.json()
    except Exception:
        return

    if "error" in body:
        err = body["error"]
        msg  = err.get("message", "Unknown Graph API error")
        code = err.get("code", 0)
        logger.error("Graph API logical error %s: %s", code, msg)
        raise ValueError(f"Instagram Graph API error {code}: {msg}")
