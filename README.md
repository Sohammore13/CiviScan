<div align="center">

# 🛡️ CiviScan

### Cyberbullying Detection & YouTube Comment Analysis

Detect toxic, abusive, and cyberbullying content in YouTube comments using a fine-tuned Hugging Face model and the YouTube Data API v3.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![YouTube API](https://img.shields.io/badge/YouTube_Data_API-v3-FF0000?style=for-the-badge&logo=youtube&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-Models-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)

</div>

---

# 📌 Overview

CiviScan is a web application that analyses YouTube comments for cyberbullying and toxic behaviour.

The platform combines:

- 🤖 Fine-tuned Hugging Face Transformer model
- 📺 YouTube Data API v3
- ⚡ FastAPI Backend
- ⚛️ React + TypeScript Frontend
- 📊 Interactive Analytics Dashboard

The goal is to help users identify abusive behaviour and visualise toxicity trends across YouTube comment sections.

---

# ✨ Features

## 🔍 YouTube Comment Analysis

- Analyse comments from any public YouTube video
- Fetch comments directly using YouTube Data API v3
- Real-time prediction

## 🤖 Detection Engine

Detects:

- Age-based bullying
- Ethnicity-based bullying
- Gender-based bullying
- Religious hate
- General cyberbullying
- Non-cyberbullying comments

---

## 📈 Dashboard

- Toxicity distribution
- Category-wise analytics
- Interactive charts
- Comment table
- Confidence scores

---

## 🧠 Hybrid Detection

CiviScan combines:

- Fine-tuned Transformer Model
- Keyword-based detection
- Toxicity confidence scoring

for improved prediction accuracy.

---

# 🏗 Project Structure

```
CiviScan
│
├── client/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── server/
│   ├── routers/
│   ├── services/
│   ├── tests/
│   ├── main.py
│   ├── requirements.txt
│   ├── keywords.csv
│   ├── abusive_words.csv
│   └── .env.example
│
└── README.md
```

---

# 🛠 Tech Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Radix UI

## Backend

- FastAPI
- Python
- Hugging Face Transformers
- PyTorch
- Pandas
- HTTPX

## APIs

- YouTube Data API v3

## Machine Learning & NLP

- Hugging Face Fine-tuned Classification Model

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone https://github.com/Sohammore13/CiviScan.git

cd CiviScan
```

---

# Backend Setup

```bash
cd server

python -m venv .venv

source .venv/bin/activate
```

Windows

```powershell
.venv\Scripts\activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

---

## Environment Variables

Create

```
server/.env
```

using

```
server/.env.example
```

Example:

```env
MODEL_NAME=your-huggingface-model

KEYWORDS_CSV=./keywords.csv

YOUTUBE_API_KEY=YOUR_API_KEY
```

> ⚠️ Never commit `.env` to GitHub.

---

## Start Backend

```bash
uvicorn main:app --reload
```

Backend runs on

```
http://localhost:8000
```

Swagger Docs

```
http://localhost:8000/docs
```

---

# Frontend Setup

```bash
cd client

npm install

npm run dev
```

Runs on

```
http://localhost:5173
```

---

# API Endpoints

## Health

```
GET /
```

---

## Health Status

```
GET /health
```

---

## Predict Text

```
POST /predict
```

Example

```json
{
  "text":"This is an example comment"
}
```

---

## Analyse YouTube Comments

Uses YouTube Data API v3 to fetch comments before passing them through the AI model.

---

# Model Categories

| Label | Description |
|--------|-------------|
| Age | Age-based bullying |
| Ethnicity | Racial / ethnic bullying |
| Gender | Gender-based abuse |
| Religion | Religious hate |
| Other Cyberbullying | General toxic behaviour |
| Not Cyberbullying | Safe comment |

---

# Future Improvements

- User authentication
- Video history
- PDF report generation
- Multi-language support
- Batch video analysis
- Deploy backend on Hugging Face Spaces
- Docker deployment

---

# Security

- API keys stored in `.env`
- `.env` excluded using `.gitignore`
- No secrets committed to GitHub

---

# Contributors

- Sohammore13
- Nanak Tekchandani
- Mahek Khanwani 

---

# License

This project is intended for educational and research purposes.

---

<div align="center">

### ⭐ If you like this project, consider giving it a star!

Made with ❤️ using React, FastAPI, Hugging Face & YouTube Data API

</div>
