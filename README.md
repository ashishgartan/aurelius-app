# Aurelius

Aurelius is a Next.js 16 AI assistant app with:

- Groq-powered chat
- optional local Qwen routing
- uploaded-document search and summarization
- email sending through SMTP
- structured long-term user memory
- artifact extraction from generated code
- usage analytics and per-session chat history

## Features

- Auth with email OTP and JWT cookies
- Multi-agent routing for general chat, research, code, math, docs, and email
- Session-based RAG for PDFs, DOCX, code, and text files
- Automatic code artifact extraction from fenced blocks
- Email drafting and sending with delivery history
- User settings for instructions, tone, language, response length, and enabled tools
- Cross-session memory for profile, preferences, interests, and working context
- Usage dashboard and chat/session management

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- MongoDB + Mongoose
- Groq via LangChain
- Optional LM Studio / OpenAI-compatible local endpoint
- Tavily for live web search
- Nodemailer for SMTP email delivery
- Cloudinary for code artifacts

## Local Development

Install dependencies:

```bash
npm install
```

Create an env file:

```bash
cp .env.example .env.local
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

Minimum app boot requirements:

```env
MONGODB_URI=
JWT_SECRET=
APP_URL=http://localhost:3000
```

Recommended auth/security settings:

```env
ALLOWED_ORIGINS=http://localhost:3000
```

## Optional Integrations

Groq:

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_ROUTER_MODEL=llama-3.1-8b-instant
```

Local Qwen / LM Studio:

```env
LM_STUDIO_URL=http://localhost:1234
```

Live web search:

```env
TAVILY_API_KEY=
```

SMTP email:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Cloudinary artifacts:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Scanned PDF OCR with Tesseract:

```env
ENABLE_TESSERACT_PDF_OCR=1
```

This OCR path only works when the server also has these binaries installed:

- `pdftoppm`
- `tesseract`

Example for Ubuntu/Debian:

```bash
apt-get update && apt-get install -y poppler-utils tesseract-ocr
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test -- --runInBand
```

## Product Areas

### Chat

- `/chat`
- `/chat/[chatId]`
- session history, regenerate, edit-and-resend, stop generation

### User Pages

- `/profile`
- `/options`
- `/tools`
- `/memory`
- `/dashboard`

### Documents

- upload per session
- indexed into MongoDB chunks
- searchable through the knowledge agent
- previously uploaded bad PDFs must be re-uploaded or reprocessed after extractor changes

### Memory

Structured memory is stored separately from raw chat history.

Types:

- `profile`
- `preference`
- `interest`
- `working`

Memory is:

- learned conservatively from user messages
- editable from `/memory`
- injected back into future prompts

## API Surface

Main routes:

- `POST /api/chat`
- `GET /api/models`
- `GET /api/tools`
- `GET|PUT /api/settings`
- `GET|POST /api/memory`
- `PATCH|DELETE /api/memory/[memoryId]`
- `GET /api/usage`
- `GET|POST /api/sessions`
- `GET /api/sessions/[sessionId]`
- `GET|POST /api/sessions/[sessionId]/documents`

## Deployment Notes

- Set `ALLOWED_ORIGINS` and/or `APP_URL` in production so CSRF protection stays closed-by-default.
- SMTP sending requires server SMTP transport config and user SMTP credentials saved in the app.
- Tesseract OCR is opt-in and disabled unless `ENABLE_TESSERACT_PDF_OCR=1`.
- If Groq is configured and LM Studio is also available, lightweight prompts may use Qwen while code-heavy prompts stay on Groq.

## Quality Checks

Before deploy:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
```

## Known Operational Limits

- OCR for scanned PDFs requires external system packages on the server.
- Existing bad document chunks are not auto-migrated; affected files need re-upload or future reprocessing support.
- Code assistance is generation-only; repo execution/sandboxed code running is not exposed to end users.
