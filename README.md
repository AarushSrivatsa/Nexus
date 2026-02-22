# NEXUS

> A production-grade AI chat backend with real-time web access, document memory, and vision — built on FastAPI, LangChain, and Pinecone.

---

## What it does

Nexus is a full-stack AI assistant backend that wraps a powerful LLM agent with:

- **Persistent conversations** — multi-turn chat stored in PostgreSQL, per-user isolated
- **RAG (document memory)** — upload PDFs, DOCX, or TXT files; the AI can query them semantically using Pinecone vector search + reranking
- **Vision** — upload images and the AI describes and reasons about them via Cloudflare Workers AI (LLaVA)
- **Live web access** — agent can search, crawl, extract, and map websites in real-time via Tavily
- **Auth** — email/password signup with OTP verification, JWT access tokens, rotating refresh tokens, password reset flow

---

## Stack

| Layer | Tech |
|---|---|
| Framework | FastAPI (async) |
| LLM | Kimi K2 via Groq (`moonshotai/kimi-k2-instruct-0905`) |
| Agent | LangChain |
| Vector DB | Pinecone |
| Embeddings | Ollama (`nomic-embed-text:v1.5`) |
| Vision | Cloudflare Workers AI (LLaVA 1.5 7B) |
| Web tools | Tavily (search, crawl, extract, map) |
| Database | PostgreSQL + SQLAlchemy (async) |
| Auth | Argon2 password hashing, JWT, rotating refresh tokens |
| Email | Brevo (transactional OTP emails) |
| Task scheduler | APScheduler |

---

## Project structure

```
.
├── main.py                  # FastAPI app, router registration, scheduler
├── config.py                # All env vars and constants
├── database/
│   ├── initialization.py    # Async engine + session factory
│   └── models.py            # SQLAlchemy models
├── routers/
│   ├── authentication.py    # Signup, login, OTP, refresh, password reset
│   ├── conversations.py     # Create, list, delete conversations
│   └── messages.py          # Send messages, upload docs, upload images
├── AI/
│   ├── LLM.py               # Agent setup, get_ai_response()
│   ├── RAG.py               # Pinecone ingestion + query tool
│   ├── image_processing.py  # Cloudflare LLaVA integration
│   └── tools.py             # Tavily tools + getDateAndTime
├── security/
│   ├── passwords.py         # Argon2 hash + verify
│   └── tokens.py            # JWT create + verify, refresh token management
└── utilities/
    ├── email.py             # Brevo OTP email sender
    └── scheduled_tasks.py   # Cleanup jobs (expired OTPs)
```

---

## Getting started

### 1. Clone and set up environment

```bash
git clone https://github.com/AarushSrivatsa/Chatbot-Wrapper-Project-Backend-OpenDocs
cd Chatbot-Wrapper-Project-Backend-OpenDocs
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Set up Ollama embeddings

```bash
ollama pull nomic-embed-text:v1.5
```

### 3. Configure environment variables

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/nexus
SECRET_KEY=your-secret-key-here

GROQ_API_KEY=your-groq-api-key
PINECONE_API_KEY=your-pinecone-api-key
TAVILY_API_KEY=your-tavily-api-key

CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-workers-ai-token

BREVO_API_KEY=your-brevo-api-key
```

### 4. Create database tables

```bash
python database/models.py
```

### 5. Run

```bash
uvicorn main:app --reload
```

The frontend is served at `http://localhost:8000/`.

---

## API overview

### Auth — `/api/v1/authentication`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup/send-otp` | Register with email + password, sends OTP |
| `POST` | `/signup/verify-otp/{email}` | Verify OTP, returns tokens |
| `POST` | `/login` | Login, returns tokens |
| `POST` | `/refresh` | Rotate refresh token, returns new token pair |
| `POST` | `/reset-password/send-otp` | Send password reset OTP |
| `POST` | `/reset-password/{email}` | Verify OTP + set new password, revokes all sessions |

### Conversations — `/api/v1/conversations`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Create a new conversation |
| `GET` | `/` | List all conversations for current user |
| `DELETE` | `/{conversation_id}` | Delete conversation + messages + RAG namespace |

### Messages — `/api/v1/conversations/{conversation_id}/messages`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Get all messages in a conversation |
| `POST` | `/` | Send a message, get AI response |
| `POST` | `/documents` | Upload PDF/DOCX/TXT, adds to RAG |
| `POST` | `/image` | Upload image, AI describes and responds |

All endpoints except auth require a Bearer token in the `Authorization` header.

---

## How the agent works

Every message goes through a LangChain agent with access to:

```
getDateAndTime  →  current IST date/time
search          →  Tavily web search (top 3 results)
extract         →  full content from a specific URL
crawl           →  deep multi-page website crawl
mapsite         →  website structure/sitemap
query_rag       →  semantic search over uploaded documents (conversation-scoped)
```

The agent follows a priority order: time-sensitive → RAG → web → own knowledge. Each conversation has its own isolated Pinecone namespace so documents never bleed across conversations.

---

## Auth flow

```
Signup:   email + password → OTP email → verify OTP → account created → tokens
Login:    email + password → tokens
Refresh:  refresh token → old token revoked → new token pair
Reset:    email → OTP email → verify OTP + new password → all sessions revoked → new tokens
```

Refresh tokens are stored hashed in the DB and rotated on every use. Password reset revokes all existing refresh tokens across all devices.

---

## Environment variables reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL async connection string |
| `SECRET_KEY` | JWT signing secret |
| `GROQ_API_KEY` | Groq API key for LLM inference |
| `PINECONE_API_KEY` | Pinecone vector DB key |
| `TAVILY_API_KEY` | Tavily web tools key |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_API_TOKEN` | Cloudflare Workers AI token (needs Workers AI permissions) |
| `BREVO_API_KEY` | Brevo transactional email key |

---

## Built by

**Aarush Srivatsa**
[LinkedIn](https://www.linkedin.com/in/aarushsrivatsa/) · [GitHub](https://github.com/AarushSrivatsa)