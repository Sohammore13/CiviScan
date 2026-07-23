# Cyberbullying Detection API — Server

A **FastAPI** backend that:
1. Loads a fine-tuned HuggingFace **sequence-classification model** (6 labels) from a local path.
2. Exposes a **`POST /predict`** endpoint.
3. Cross-checks input text against a **keyword CSV blocklist**.
4. Returns a structured JSON response.

---

## Project Structure

```
server/
├── main.py            ← FastAPI application (entry point)
├── requirements.txt   ← Python dependencies
├── .env.example       ← Environment variable template
├── keywords.csv       ← Sample keyword blocklist
└── tests/
    └── test_main.py   ← Pytest test suite
```

---

## Quick Start

### 1. Create & activate a virtual environment

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure environment variables

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set the paths to your model and keyword CSV:

```ini
MODEL_PATH=C:/path/to/your/fine-tuned-model
KEYWORDS_CSV=./keywords.csv
```

### 4. Run the server

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**.  
Interactive docs: **http://localhost:8000/docs**

---

## API Reference

### `GET /`
Health check.

```json
{ "status": "ok", "model_loaded": true, "keywords_loaded": true }
```

### `GET /health`
Detailed health check.

```json
{ "status": "ok", "model_loaded": true, "keywords_count": 24, "labels": [...] }
```

### `POST /predict`

**Request body:**
```json
{ "text": "Your input text here" }
```

**Response:**
```json
{
  "predicted_category": "ethnicity",
  "toxicity_score": 0.9200,
  "toxicity_level": "Severe",
  "matched_words": ["racist"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `predicted_category` | `string` | One of: `age`, `ethnicity`, `gender`, `religion`, `other_cyberbullying`, `not_cyberbullying` |
| `toxicity_score` | `float` | Probability in [0.0, 1.0] |
| `toxicity_level` | `string` | `Low` (< 0.25) · `Medium` (≥ 0.25) · `High` (≥ 0.50) · `Severe` (≥ 0.75) |
| `matched_words` | `string[]` | Keywords from the blocklist found in the text |

---

## Toxicity Score Logic

| Condition | Effect |
|-----------|--------|
| Model inference only | Raw softmax probability of the predicted class |
| Keyword match found | Score is forced to `max(model_score, 0.90)` |
| Keyword match found | `predicted_category` is overridden with the CSV category |

---

## Keyword CSV Format

The blocklist CSV must have **at least two columns**:

| Column | Description |
|--------|-------------|
| `word` | A single word (case-insensitive, whole-word matching) |
| `main_category` | One of the 6 label strings |

---

## Running Tests

```powershell
pip install pytest httpx
pytest tests/ -v
```

---

## Model Requirements

Place your fine-tuned HuggingFace model in a local directory containing:
- `config.json`
- `tokenizer_config.json` (and tokenizer files)
- `pytorch_model.bin` **or** `model.safetensors`

The model's `config.id2label` is used automatically if present; otherwise the default label order is assumed.
