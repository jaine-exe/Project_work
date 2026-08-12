# GST Lite — Backend

FastAPI backend for GST Lite: authentication, invoice upload, OCR, AI multi-agent
compliance checking, risk scoring, and GST return generation.

## Architecture

```
Upload (FastAPI route)
   -> stored to disk, Invoice row created (status=uploaded)
   -> background task runs the pipeline:

      ManagerAgent.process_invoice()          [app/services/ai_service.py]
        1. OCR extraction                     [app/services/ocr_service.py]
        2. ValidationAgent   — sanity-checks extracted fields
        3. ComplianceAgent   — runs the hand-written rule engine
                                [app/services/compliance_engine.py]
        4. RiskAgent         — aggregates findings into a risk label

   -> Invoice status becomes "validated" or "flagged", ComplianceIssue rows created
```

`ManagerAgent` is written as plain orchestration code today — the classes and call
shape are deliberately structured so it can be swapped for a real LangGraph graph
(ManagerAgent as the supervisor/router node) without changing any other route.

The GST rule checks in `compliance_engine.py` are genuine hand-written logic
(GSTIN format, GSTR-2B reconciliation, e-invoice IRN threshold, HSN confidence,
valid tax slabs) — not an LLM guessing. The AI layer's job is only to *explain*
these findings in plain language via `/api/chat/ask`.

## Setup

```bash
cd gstlite-backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

uvicorn app.main:app --reload
```

Server runs at **http://localhost:8000**. Interactive API docs: **http://localhost:8000/docs**.

By default it uses SQLite (`gstlite.db`, created automatically) and mock OCR/AI —
nothing external is required to run it end to end.

## Connecting the frontend

Set `CORS_ORIGINS=http://localhost:3000` in `.env` (already the default) and point
the Next.js frontend's API calls at `http://localhost:8000`.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create a user + business, returns JWT |
| POST | `/api/auth/login` | — | Form-encoded login (`username`=email), returns JWT |
| POST | `/api/auth/login-json` | — | JSON-body login alternative |
| GET | `/api/auth/me` | ✅ | Current user + business profile |
| POST | `/api/invoices` | ✅ | Upload an invoice file (multipart), kicks off the pipeline |
| GET | `/api/invoices` | ✅ | List all invoices for the business |
| GET | `/api/invoices/{id}` | ✅ | Single invoice with its compliance issues |
| GET | `/api/compliance/issues?severity=high` | ✅ | All compliance issues, optionally filtered |
| GET | `/api/compliance/readiness` | ✅ | Filing readiness score (0–100) |
| GET | `/api/gst/summary?period=2026-07` | ✅ | Tax liability, ITC, net payable, rate-slab breakdown |
| POST | `/api/gst/returns/generate` | ✅ | Generates a GSTR-1/3B-style return (blocked if invoices are flagged) |
| POST | `/api/gst/returns/{id}/file` | ✅ | Marks a generated return as filed |
| GET | `/api/chat/history` | ✅ | Past chat messages for the business |
| POST | `/api/chat/ask` | ✅ | Ask the AI advisor a question, optionally scoped to an invoice |
| GET | `/api/health` | — | Health check |

Authenticated routes expect `Authorization: Bearer <token>` from the login/register response.

## Swapping in real services

- **OCR**: set `OCR_PROVIDER=tesseract` in `.env` and install the Tesseract binary
  (`apt install tesseract-poppler-utils` / `brew install tesseract poppler`) —
  `ocr_service.py` already has the pytesseract + pdf2image code path wired up.
- **AI advisor**: set `OPENAI_API_KEY` in `.env` — `ai_service.py` will call GPT-4o
  automatically instead of returning canned responses.
- **Multi-agent orchestration**: replace the classes in `ai_service.py` with a real
  LangGraph `StateGraph`; keep `ManagerAgent.process_invoice(file_path)` as the
  single entry point so `invoices.py` doesn't need to change.
- **Database**: set `DATABASE_URL` to a Postgres connection string for production.

## Project structure

```
app/
  core/       settings, JWT + password hashing
  db/         SQLAlchemy models + session
  schemas/    Pydantic request/response models
  api/
    deps.py       auth dependencies (get_current_user/business)
    routes/       auth, invoices, compliance, gst, chat
  services/
    ocr_service.py         OCR extraction (mock or tesseract)
    ai_service.py           Manager/Validation/Compliance/Risk agents + chat advisor
    compliance_engine.py    hand-written GST rule checks
    gst_calculator.py       return/summary aggregation
  utils/
    storage.py    file upload handling
  main.py     FastAPI app, router wiring, CORS
```
