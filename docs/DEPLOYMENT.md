# Deployment Guide

## Architecture Overview

- **Frontend**: Next.js 14 on Render Web Service
- **Backend**: FastAPI on Render Web Service
- **Database**: Supabase PostgreSQL
- **LLM**: Groq (Llama 3.1 70B)
- **STT**: Browser Web Speech API (SpeechRecognition)
- **TTS**: Browser SpeechSynthesis
- **Weather**: Open-Meteo + OpenStreetMap Nominatim (free)

---

## 1. Local Development

```bash
# Clone and navigate
git clone <repo-url>
cd realtime_voice_assistant

# Copy environment files
cp .env.example .env
# Edit .env with your API keys

# Start with Docker (recommended)
docker-compose up --build

# Access:
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

Or run manually:

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your keys
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
npm run dev
```

---

## 2. Production Deployment

### Prerequisites

1. **Supabase Account** - Create project at https://supabase.com
2. **Groq API Key** - Get free key from https://console.groq.com/keys
3. **Render Account** - Sign up at https://render.com

---

## 3. Supabase PostgreSQL Setup

1. Create new Supabase project
2. Go to Settings → Database
3. Copy the connection string (URI format):
   ```
   postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
   ```
4. Note: Supabase uses `postgresql://` not `postgresql+psycopg://` - SQLAlchemy handles the driver

---

## 4. Environment Variables

### Backend (.env)
```bash
# =============================================================================
# FREE-BY-DEFAULT CONFIGURATION
# =============================================================================

# LLM Provider (default: groq - free tier)
LLM_PROVIDER=groq
LLM_API_KEY=your_groq_api_key_here
LLM_MODEL=llama-3.1-70b-versatile

# Optional paid providers (not required)
# OPENAI_API_KEY=
# OPENAI_MODEL=gpt-4o
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-1.5-flash

# =============================================================================
# DATABASE (Supabase PostgreSQL)
# =============================================================================
# Production: Use Supabase connection string
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Local dev only (docker-compose uses these)
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=postgres
# POSTGRES_DB=voice_assistant
# POSTGRES_HOST=postgres
# POSTGRES_PORT=5432

# Optional: Override with direct URL
# DATABASE_URL=postgresql://...

# =============================================================================
# CORS & APPLICATION
# =============================================================================
# Production: Set to your frontend URL
CORS_ORIGINS=https://your-frontend.onrender.com

# Local dev
# CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# =============================================================================
# APPLICATION
# =============================================================================
LOG_LEVEL=INFO
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

---

## 5. Deploy to Render

### Backend Service
1. Create new **Web Service** on Render
2. Connect your GitHub repo
2. Settings:
   - **Runtime**: Docker
   - **Build Command**: (handled by Dockerfile)
   - **Start Command**: `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"`
   - **Health Check Path**: `/health`
   - **Port**: 8000 (auto-assigned by Render)

### Environment Variables (Backend)
Add all variables from the Backend .env section above.

### Frontend Service
1. Create new **Web Service** on Render
2. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Port**: 3000 (auto-assigned)

### Frontend Environment Variables
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

### CORS Configuration
After both services are deployed:
1. Copy frontend URL (e.g., `https://voice-frontend.onrender.com`)
2. Add to backend `CORS_ORIGINS`:
   ```bash
   CORS_ORIGINS=https://your-frontend.onrender.com
   ```
3. Redeploy backend

---

## 6. Database Migrations

### Option A: Automatic (Docker Startup)
The Dockerfile runs `alembic upgrade head` on startup. This works but may slow startup.

### Option B: Manual (Recommended for Production)
```bash
# Run once after deploy
alembic upgrade head
```

On Render, you can run this via:
1. Render Shell (in dashboard)
2. Or as a one-off job

---

## 6. Health Checks

- **Backend**: `GET /health` returns `{status: "healthy", database: "healthy"}`
- **Frontend**: Render checks `/` endpoint

---

## 7. Post-Deployment Verification

1. **Health Check**: `GET https://your-backend.onrender.com/health`
2. **WebSocket**: Open frontend, should connect to WebSocket
3. **Text Chat**: Type a message, verify response
4. **Voice Input**: Click microphone, speak, verify transcription
5. **Voice Output**: Verify browser speaks response
6. **Tools**: Test calculator, time, weather tools
4. **Interruption**: Speak while assistant is talking, verify barge-in

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| WebSocket fails | Check CORS_ORIGINS matches frontend URL exactly |
| WebSocket disconnects | Check Render logs for timeout, increase timeout if needed |
| Groq rate limited | Check Groq dashboard, implement retry/backoff |
| SpeechRecognition fails | Ensure HTTPS, check browser support (Chrome/Edge/Safari) |
| SpeechSynthesis not working | Check browser autoplay policy, user interaction required |
| Database connection failed | Verify DATABASE_URL, check Supabase IP allowlist (0.0.0.0/0) |
| Migration fails | Check alembic version, run `alembic upgrade head` manually |

---

## 8. Free Tier Limitations

| Service | Limit |
|---------|-------|
| Groq | 14,400 req/day, 30 RPM |
| Supabase | 500MB DB, 1GB bandwidth |
| Render Free | 750 hrs/mo, spins down after 15min idle |
| Browser STT | Chrome/Edge/Safari only |
| Browser TTS | Quality varies by browser/OS |

---

## 5. Render Build/Start Commands

### Backend
- **Runtime**: Docker
- **Build Command**: (Dockerfile handles build)
- **Start Command**: `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"`
- **Health Check Path**: `/health`

### Frontend
- **Runtime**: Node
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`

---

## 17. Validation Results

| Check | Result |
|-------|--------|
| Backend pytest | ✅ 45 passed |
| Backend mypy | ✅ Clean |
| Backend ruff | ✅ Clean |
| Frontend type-check | ✅ PASS |
| Frontend lint | ✅ PASS |
| Frontend build | ✅ PASS |

---

## Known Limitations

1. **Browser Speech Recognition**: Only works in Chrome, Edge, Safari. Firefox has limited support.
2. **Browser TTS Quality**: Varies by browser/OS; no voice selection in some browsers.
3. **Groq Rate Limits**: 14,400 req/day, 30 RPM on free tier.
4. **Render Free Tier**: Spins down after 15min idle (cold start ~10-30s).
5. **Supabase Free Tier**: 500MB DB, 1GB egress/month.
6. **Automated Tests**: Use SQLite in-memory, not full PostgreSQL integration coverage.
6. **WebSocket**: Render free tier may have connection limits.

---

## Verdict

**READY FOR DEPLOYMENT**

The application has been inspected and validated for Render + Supabase + Groq deployment. All tests pass, type-checking passes, linting passes, and production builds succeed.