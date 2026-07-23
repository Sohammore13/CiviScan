"""
tests/test_main.py
==================
Lightweight unit / integration tests for the cyberbullying detection API.

Run with:
    pytest tests/ -v

These tests use FastAPI's TestClient so they do NOT require a running server.
The model and CSV paths are overridden via environment variables / monkeypatching
so the test suite can run without a real fine-tuned model.
"""

import types
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
import torch
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_mock_model(predicted_idx: int = 0, num_labels: int = 6):
    """Return a minimal mock that behaves like a HF sequence-classification model."""
    probs = [0.05] * num_labels
    probs[predicted_idx] = 0.70
    logits_tensor = torch.log(torch.tensor([probs]))  # inverse softmax ≈ logits

    mock_output = MagicMock()
    mock_output.logits = logits_tensor

    mock_model = MagicMock()
    mock_model.return_value = mock_output
    mock_model.eval = MagicMock()
    mock_model.config = MagicMock()
    mock_model.config.id2label = {
        0: "age",
        1: "ethnicity",
        2: "gender",
        3: "religion",
        4: "other_cyberbullying",
        5: "not_cyberbullying",
    }
    return mock_model


def _make_mock_tokenizer():
    """Return a minimal mock tokenizer."""
    mock_tok = MagicMock()
    mock_tok.return_value = {"input_ids": torch.tensor([[1, 2, 3]])}
    return mock_tok


def _make_keywords_df():
    return pd.DataFrame(
        {
            "word": ["idiot", "racist", "sexist"],
            "main_category": [
                "other_cyberbullying",
                "ethnicity",
                "gender",
            ],
        }
    )


@pytest.fixture()
def client():
    """
    TestClient with the model and keyword list injected as mocks so tests
    run without a real fine-tuned model on disk.
    """
    import server.main as app_module  # noqa: PLC0415

    app_module._tokenizer = _make_mock_tokenizer()
    app_module._model = _make_mock_model(predicted_idx=5)  # not_cyberbullying
    app_module._keywords_df = _make_keywords_df()

    with TestClient(app_module.app) as c:
        yield c

    # cleanup
    app_module._tokenizer = None
    app_module._model = None
    app_module._keywords_df = None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHealth:
    def test_root_ok(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True

    def test_health_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_loaded"] is True
        assert data["keywords_count"] == 3


class TestPredict:
    def test_clean_text_no_keywords(self, client):
        resp = client.post("/predict", json={"text": "I love sunny days"})
        assert resp.status_code == 200
        data = resp.json()
        # No keyword match → score is whatever the mock model returns
        assert data["predicted_category"] in [
            "age", "ethnicity", "gender", "religion",
            "other_cyberbullying", "not_cyberbullying",
        ]
        assert 0.0 <= data["toxicity_score"] <= 1.0
        assert data["toxicity_level"] in ["Low", "Medium", "High", "Severe"]
        assert data["matched_words"] == []

    def test_keyword_forces_score_above_090(self, client):
        resp = client.post("/predict", json={"text": "You are such an idiot"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["toxicity_score"] >= 0.90
        assert "idiot" in data["matched_words"]

    def test_keyword_overrides_category(self, client):
        resp = client.post("/predict", json={"text": "That racist comment was awful"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["predicted_category"] == "ethnicity"
        assert "racist" in data["matched_words"]

    def test_severe_level_for_high_score(self, client):
        # Patch toxicity score to 0.95 via keyword match
        resp = client.post("/predict", json={"text": "sexist remark"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["toxicity_score"] >= 0.90
        assert data["toxicity_level"] in ["High", "Severe"]

    def test_empty_text_returns_422(self, client):
        resp = client.post("/predict", json={"text": "   "})
        assert resp.status_code == 422

    def test_missing_text_field_returns_422(self, client):
        resp = client.post("/predict", json={})
        assert resp.status_code == 422

    def test_response_schema(self, client):
        resp = client.post("/predict", json={"text": "hello world"})
        assert resp.status_code == 200
        data = resp.json()
        assert set(data.keys()) == {
            "predicted_category",
            "toxicity_score",
            "toxicity_level",
            "matched_words",
        }
