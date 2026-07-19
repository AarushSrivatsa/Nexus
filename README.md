# NEXUS

A full-stack AI chat application built with FastAPI and LangChain. Nexus supports multi-turn conversations, document memory via RAG, image understanding, and live web access — all behind a clean, dark-themed web UI.

---

## Features

- **Persistent conversations** — multi-turn chat stored in PostgreSQL, scoped per user
- **Document memory (RAG)** — upload PDFs, DOCX, or TXT files; the AI queries them semantically via Pinecone vector search, isolated per conversation
- **Vision** — upload images; the AI describes and reasons about them via Cloudflare Workers AI (LLaVA 1.5 7B)
- **Live web access** — the agent can search, crawl, extract content from, and map websites in real time via Tavily
- **Model selector** — switch between any available LLM per message from the chat UI; the provider is inferred automatically
- **Auth system** — email/password signup with OTP verification, JWT access tokens, and rotating refresh tokens
- **Password reset** — OTP-based reset flow that revokes all existing sessions on success
- **Scheduled cleanup** — APScheduler job runs nightly to prune expired OTP records
- **File storage** — uploaded images stored in Cloudflare R2 and deleted when the conversation is deleted

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI (async) |
| LLM inference | Groq (multi-model) |
| Agent orchestration | LangChain |
| Vector database | Pinecone |
| Embeddings | Voyage AI (`voyage-3-lite`, 512 dimensions) |
| Vision | Cloudflare Workers AI (LLaVA 1.5 7B) |
| Image storage | Cloudflare R2 (via boto3 S3 API) |
| Web tools | Tavily (search, crawl, extract, map) |
| Database | PostgreSQL + SQLAlchemy (async, asyncpg) |
| Auth | Argon2 password hashing, JWT, rotating refresh tokens |
| Email (OTP) | Brevo transactional email API |
| Task scheduler | APScheduler (AsyncIOScheduler, cron) |
| Frontend | Vanilla JS + Tailwind CSS (CDN) |

---

## Project Structure

```
.
├── main.py                        # FastAPI app entry point, router registration, scheduler setup
├── settings.py                    # All env vars, constants, and the VoyageEmbeddings adapter
├── requirements.txt
├── Dockerfile
├── start.sh
│
├── database/
│   ├── __init__.py
│   ├── initialization.py          # Async SQLAlchemy engine, session factory, get_db dependency
│   └── models.py                  # ORM models: User, Conversation, Message, RefreshToken, OTPVerification
│
├── routers/
│   ├── authentication.py          # Signup (send/verify OTP), login, token refresh, password reset
│   ├── conversations.py           # Create, list, delete conversations; cleans up RAG + R2 on delete
│   ├── messages.py                # Send messages, upload documents, upload images
│   └── models.py                  # GET /api/v1/models/get_models — available model list
│
├── AI/
│   ├── LLM.py                     # Agent setup with LangChain, get_ai_response(), db→LangChain history converter
│   ├── RAG.py                     # Pinecone ingestion (add_to_rag), per-conversation query tool factory, clear_rag
│   ├── image_processing.py        # Cloudflare LLaVA integration: image_to_text, describe_image_from_url, view_image tool factory
│   └── tools.py                   # Tavily tools (search, crawl, extract, map) + getDateAndTime
│
├── security/
│   ├── passwords.py               # Argon2 hash + verify
│   └── tokens.py                  # JWT create/verify, rotating refresh token management, get_user_from_access_token dependency
│
├── utilities/
│   ├── __init__.py
│   ├── email.py                   # Brevo OTP email sender with custom Nexus-styled HTML template
│   ├── scheduled_tasks.py         # Nightly cleanup: deletes used OTP records from the DB
│   └── cloudflare_client.py       # boto3 S3 client for Cloudflare R2: upload_file, delete_files
│
└── static/
    ├── index.html                 # Landing page — redirects to /app or /login based on localStorage token
    ├── login.html
    ├── signup.html
    ├── reset.html
    ├── app.html                   # Main chat UI
    ├── css/
    │   └── theme.css              # Custom CSS: markdown rendering, animations, modal/sidebar mechanics
    └── js/
        ├── tailwind.config.js     # Tailwind theme extension (colors, fonts, shadows)
        ├── common.js              # Nexus namespace: token storage, authenticated fetch with 401 retry, toast, helpers
        ├── app.js                 # Main app logic: conversations, messaging, file upload, model selector, markdown renderer
        ├── login.js
        ├── signup.js              # Two-step signup: email+password → OTP verify, with resend timer
        └── reset.js               # Two-step password reset: send OTP → verify + set new password
```

---

## API Reference

All endpoints except auth routes and `/api/v1/models/get_models` require a `Bearer` token in the `Authorization` header.

### Auth — `/api/v1/authentication`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup/send-otp` | Register with email + password; sends a 6-digit OTP via email |
| `POST` | `/signup/verify-otp/{email}` | Verify OTP, create account, return token pair |
| `POST` | `/login` | Authenticate with email + password, return token pair |
| `POST` | `/refresh` | Rotate refresh token; old token is revoked, new pair returned |
| `POST` | `/reset-password/send-otp` | Send password reset OTP (silent no-op if email doesn't exist) |
| `POST` | `/reset-password/{email}` | Verify OTP, update password, revoke all sessions, return new token pair |

### Conversations — `/api/v1/conversations`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Create a new conversation |
| `GET` | `/` | List all conversations for the authenticated user, ordered by creation date |
| `DELETE` | `/{conversation_id}` | Delete conversation, all its messages, its Pinecone namespace, and any R2 images |

### Messages — `/api/v1/conversations/{conversation_id}/messages`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Retrieve all messages in a conversation, ordered chronologically |
| `POST` | `/` | Send a text message with `model` and `provider`; returns the AI response |
| `POST` | `/documents` | Upload a PDF, DOCX, or TXT file (max 10 MB); adds to RAG, AI acknowledges |
| `POST` | `/image` | Upload a PNG, JPG, JPEG, or WEBP image (max 10 MB); AI describes it |

### Models — `/api/v1/models`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/get_models` | Returns the list of available models with `id`, `name`, and `provider` fields |

---

## Agent Tools

Every message goes through a LangChain agent with the following tools:

| Tool | Trigger condition |
|---|---|
| `getDateAndTime` | Any time-relative question ("today", "latest", "current") |
| `search` | Current events, prices, anything beyond training data |
| `extract` | User provides a specific URL and wants its content |
| `crawl` | User explicitly wants broad, multi-page site coverage |
| `mapsite` | Site structure or sitemap questions |
| `query_rag` | Always called before web search if documents have been uploaded to the conversation |
| `view_image` | User asks a specific follow-up question about a previously uploaded image |

The agent decision order is: time-sensitive → RAG → image → web → own knowledge.

Each conversation has its own isolated Pinecone namespace, so documents never bleed across conversations.

---

## Auth Flow

```
Signup:   email + password → OTP email → verify OTP → account created → token pair
Login:    email + password → token pair
Refresh:  refresh token → old token revoked → new token pair
Reset:    email → OTP email → verify OTP + new password → all sessions revoked → new token pair
```

Refresh tokens are stored as SHA-256 hashes in the database and rotated on every use. Password reset revokes all active refresh tokens across all devices before issuing fresh ones.

OTP codes are 6 digits, expire after 5 minutes, and are cleaned up nightly by the scheduler.

---

## Getting Started

### 1. Clone and set up the environment

```bash
git clone <repo-url>
cd <repo-directory>
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/nexus

# Security
SECRET_KEY=your-secret-key-here

# AI / ML
GROQ_API_KEY=your-groq-api-key
PINECONE_API_KEY=your-pinecone-api-key
VOYAGE_API_KEY=your-voyage-api-key
TAVILY_API_KEY=your-tavily-api-key

# Cloudflare
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-workers-ai-token
R2_BUCKET_NAME=your-r2-bucket-name
R2_PUBLIC_URL=https://your-r2-public-url
R2_API_TOKEN=your-r2-api-token

# Email
BREVO_API_KEY=your-brevo-api-key

# Optional: absolute public URL of the app, used only for the logo in OTP emails
# PUBLIC_APP_URL=https://nexus.yourdomain.com
```

The app will refuse to start if any of `DATABASE_URL`, `GROQ_API_KEY`, `PINECONE_API_KEY`, `TAVILY_API_KEY`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `BREVO_API_KEY`, or `SECRET_KEY` are missing.

### 3. Create the Pinecone index

In the Pinecone console, create an index named `nexus` with:
- **Dimensions:** 512
- **Metric:** cosine
- **Cloud:** AWS, region `us-east-1`

### 4. Create database tables

```bash
python database/models.py
```

### 5. Run the development server

```bash
uvicorn main:app --reload
```

The app is served at `http://localhost:8000/`. API docs are available at `/docs` only when the `DEBUG` environment variable is set to `true`.

---

## Docker

A `Dockerfile` is included. Build and run with:

```bash
docker build -t nexus .
docker run -p 8080:8080 --env-file .env nexus
```

The app listens on port `8080` inside the container.

---

## Available Models

The model list is defined in `routers/models.py` and served to the frontend dynamically. To add or remove models, edit the `MODELS` list there — no frontend changes are needed.

| Model ID | Display Name | Provider |
|---|---|---|
| `openai/gpt-oss-120b` | GPT OSS 120B | Groq |
| `openai/gpt-oss-20b` | GPT OSS 20B | Groq |
| `qwen/qwen3-32b` | Qwen3 32B | Groq |
| `llama-3.1-8b-instant` | Llama 3.1 8B | Groq |
| `llama-3.3-70b-versatile` | Llama 3.3 70B | Groq |
| `groq/compound` | Groq Compound Mini | Groq |

---

## Configuration Reference

All tunable constants live in `settings.py`:

| Constant | Default | Description |
|---|---|---|
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `24` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token lifetime |
| `INDEX_NAME` | `nexus` | Pinecone index name |
| `DIMENSIONS` | `512` | Embedding dimensions (Voyage voyage-3-lite) |
| `CHUNK_SIZE` | `400` | RAG text chunk size (characters) |
| `CHUNK_OVERLAP` | `75` | RAG chunk overlap |
| `BASE_K` | `20` | Number of chunks retrieved before reranking |
| `TOP_N` | `5` | Number of chunks returned after reranking |
| `USE_RERANKING` | `False` | Toggle FlashrankRerank post-retrieval reranking |
| `MESSAGE_LIMIT` | `25` | Max recent messages passed to the agent as context |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL async connection string (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | ✅ | JWT signing secret |
| `GROQ_API_KEY` | ✅ | Groq API key for LLM inference |
| `PINECONE_API_KEY` | ✅ | Pinecone vector DB key |
| `VOYAGE_API_KEY` | ✅ | Voyage AI embeddings key |
| `TAVILY_API_KEY` | ✅ | Tavily web tools key |
| `CF_API_TOKEN` | ✅ | Cloudflare Workers AI API token |
| `CF_ACCOUNT_ID` | ✅ | Cloudflare account ID |
| `BREVO_API_KEY` | ✅ | Brevo transactional email key |
| `R2_BUCKET_NAME` | ⬜ | Cloudflare R2 bucket name (required for image uploads) |
| `R2_PUBLIC_URL` | ⬜ | Public base URL of the R2 bucket |
| `R2_API_TOKEN` | ⬜ | R2 API token |
| `PUBLIC_APP_URL` | ⬜ | Absolute URL of the deployed app, used for the logo in OTP emails |
| `DEBUG` | ⬜ | Set to `true` to enable `/docs`, `/redoc`, and `/openapi.json` |

---

## Notes

- The scheduler runs `delete_unnecessary_otps_in_db` every day at midnight IST, deleting OTP records where `is_used = True`.
- Each conversation's documents are stored in a dedicated Pinecone namespace (`str(conversation_id)`). Deleting a conversation calls `clear_rag` to wipe the namespace and `delete_files` to remove all associated R2 images.
- The `view_image` tool looks up the R2 URL server-side by filename from the database, so the model never needs to handle or reproduce the full URL.
- API docs (`/docs`, `/redoc`) are hidden in production and only exposed when `DEBUG=true`.