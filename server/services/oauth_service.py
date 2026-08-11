"""
services/oauth_service.py
==========================
Google OAuth 2.0 helpers for YouTube channel-owner authentication.

Stores tokens in a local JSON file (yt_token.json) so they persist across
server restarts. For a single-user / single-channel deployment this is
the simplest approach that actually works.

Required .env variables
-----------------------
YOUTUBE_CLIENT_ID      — from Google Cloud Console → Credentials
YOUTUBE_CLIENT_SECRET  — from Google Cloud Console → Credentials
YOUTUBE_REDIRECT_URI   — e.g. http://localhost:8000/youtube/callback

Required OAuth scope
--------------------
https://www.googleapis.com/auth/youtube.force-ssl
  → allows the authenticated channel owner to delete any comment on
    their own videos, even if commented by another user.
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request as GoogleRequest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CLIENT_ID = os.getenv("YOUTUBE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("YOUTUBE_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("YOUTUBE_REDIRECT_URI", "http://localhost:8000/youtube/callback")

SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]

# Persists the token across server restarts — safe for single-user use
TOKEN_FILE = Path(__file__).parent.parent / "yt_token.json"

# ---------------------------------------------------------------------------
# Module-level flow cache
# ---------------------------------------------------------------------------
# We keep the SAME Flow object alive between /auth (build_auth_url) and
# /callback (exchange_code_for_token).  This is the simplest way to preserve
# the PKCE code_verifier that google-auth-oauthlib generates automatically —
# no file tricks needed.

_pending_flow: Optional[Flow] = None


# ---------------------------------------------------------------------------
# Flow helpers
# ---------------------------------------------------------------------------

def _client_config() -> dict:
    """Build the client_config dict that google-auth-oauthlib expects."""
    if not CLIENT_ID or not CLIENT_SECRET:
        raise ValueError(
            "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env "
            "before using YouTube OAuth features."
        )
    return {
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uris": [REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def build_auth_url() -> str:
    """
    Create and return the Google OAuth consent screen URL.
    The user must visit this URL and grant permission.

    The Flow object is stored in _pending_flow so that the same instance
    (including its auto-generated PKCE code_verifier) is reused in
    exchange_code_for_token().
    """
    global _pending_flow
    _pending_flow = Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    auth_url, _ = _pending_flow.authorization_url(
        access_type="offline",   # request refresh_token
        prompt="consent",        # always show consent so we always get refresh_token
        include_granted_scopes="true",
    )
    logger.info("Generated OAuth auth URL (PKCE flow cached in memory).")
    return auth_url


def exchange_code_for_token(code: str) -> None:
    """
    Exchange the one-time authorization code (from the OAuth callback) for
    an access token + refresh token, then persist them to TOKEN_FILE.

    Uses the same Flow instance created in build_auth_url() so the
    PKCE code_verifier is automatically included — no manual handling needed.
    """
    global _pending_flow
    if _pending_flow is None:
        raise ValueError(
            "No pending OAuth flow found. Please start the flow again by "
            "visiting /youtube/auth first."
        )
    try:
        _pending_flow.fetch_token(code=code)
        creds = _pending_flow.credentials
        _save_token(creds)
        logger.info("OAuth token obtained and saved to %s.", TOKEN_FILE)
    finally:
        _pending_flow = None  # always clear after use


def get_valid_credentials() -> Optional[Credentials]:
    """
    Load credentials from TOKEN_FILE.
    If they are expired but a refresh_token exists, refresh them automatically.
    Returns None if no token file exists yet (user hasn't authenticated).
    """
    if not TOKEN_FILE.exists():
        return None

    creds = _load_token()
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            _save_token(creds)
            logger.info("OAuth token refreshed successfully.")
        except Exception as exc:
            logger.warning("Token refresh failed: %s", exc)
            return None

    return creds if creds and creds.valid else None


def is_authenticated() -> bool:
    """Return True if a valid (possibly auto-refreshed) token exists."""
    return get_valid_credentials() is not None


def revoke_token() -> None:
    """Delete the stored token file (logout)."""
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()
        logger.info("OAuth token revoked and token file deleted.")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _save_token(creds: Credentials) -> None:
    data: dict = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
    }
    # Save expiry as naive UTC ISO string (google-auth uses naive datetimes internally)
    if creds.expiry:
        # Strip timezone info — google-auth compares with naive datetime.utcnow()
        naive_expiry = creds.expiry.replace(tzinfo=None)
        data["expiry"] = naive_expiry.isoformat()
    TOKEN_FILE.write_text(json.dumps(data), encoding="utf-8")


def _load_token() -> Optional[Credentials]:
    try:
        data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
        # Restore expiry as naive UTC datetime (google-auth uses naive utcnow() internally)
        expiry = None
        if "expiry" in data:
            from datetime import datetime
            expiry = datetime.fromisoformat(data["expiry"]).replace(tzinfo=None)
        return Credentials(
            token=data["token"],
            refresh_token=data.get("refresh_token"),
            token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=data.get("client_id", CLIENT_ID),
            client_secret=data.get("client_secret", CLIENT_SECRET),
            scopes=data.get("scopes", SCOPES),
            expiry=expiry,
        )
    except Exception as exc:
        logger.error("Failed to load token from file: %s", exc)
        return None
