# Development Guide

## Local Development Setup

### Prerequisites
- Node.js 20+ and npm
- Python 3.11+
- Git
- **Groq API key** (free from https://console.groq.com/keys)
- Optional: OpenAI API key, Google Gemini API key
- Optional: OpenWeatherMap API key (not needed for default Open-Meteo)

### Quick Start

```bash
# Clone and navigate
git clone <repo-url>
cd realtime_voice_assistant

# Copy environment files
cp .env.example .env
# Edit .env with your API keys

# Start with Docker (easiest)
docker-compose up --build

# Or start services manually (see below)
```

### Manual Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run database migrations (if using Alembic)
# alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Manual Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Start development server
npm run dev
```

## Project Structure

### Backend (FastAPI)
```
backend/
├── app/
│   ├── main.py                 # FastAPI app entry point
│   ├── core/
│   │   ├── config.py           # Pydantic settings
│   │   └── database.py         # SQLAlchemy setup
│   ├── api/
│   │   ├── routes/             # REST endpoints
│   │   └── websocket/          # WebSocket handlers
│   ├── models/                 # SQLAlchemy models
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic
│   ├── providers/              # External provider abstractions
│   │   ├── llm/
│   │   ├── stt/
│   │   └── tts/
│   └── tools/                  # Tool implementations
├── tests/                      # Pytest tests
├── requirements.txt
├── pyproject.toml
└── Dockerfile
```

### Frontend (Next.js)
```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main page
│   ├── globals.css             # Global styles
│   └── providers.tsx           # Context providers
├── components/
│   ├── ui/                     # Base UI components
│   ├── conversation/           # Chat components
│   ├── voice/                  # Voice UI components
│   └── controls/               # Control components
├── hooks/                      # Custom React hooks
├── lib/                        # Utilities, API client
├── services/                   # Frontend services
├── types/                      # TypeScript types
└── styles/
```

## Running Tests

### Backend Tests
```bash
cd backend

# Run all tests
pytest -v

# Run with coverage
pytest --cov=app --cov-report=term-missing --cov-report=html

# Run specific test file
pytest tests/test_tools.py -v

# Run with pattern
pytest -k "calculator" -v

# Run websocket tests
pytest tests/test_websocket.py -v
```

### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Code Quality

### Backend Linting & Type Checking
```bash
cd backend

# Lint with Ruff
ruff check .
ruff check . --fix

# Type check with MyPy
mypy app/

# Format with Ruff
ruff format .
```

### Frontend Linting & Type Checking
```bash
cd frontend

# ESLint
npm run lint

# TypeScript check
npm run type-check

# Format with Prettier (if configured)
npx prettier --write .
```

## Adding New Tools

### 1. Create Tool Class
```python
# backend/app/tools/my_tool.py
from app.tools.base import BaseTool
from app.schemas.tools import ToolParameter, ToolResult

class MyTool(BaseTool):
    @property
    def name(self) -> str:
        return "my_tool"

    @property
    def description(self) -> str:
        return "Description of what this tool does"

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "param1": ToolParameter(type="string", description="Description"),
        }

    @property
    def required(self) -> list[str]:
        return ["param1"]

    async def execute(self, param1: str) -> ToolResult:
        try:
            # Implementation
            result = do_something(param1)
            return ToolResult(success=True, result=result)
        except Exception as e:
            return ToolResult(success=False, error=str(e))
```

### 2. Register Tool
```python
# backend/app/services/tool_service.py
from app.tools.my_tool import MyTool

class ToolService:
    def _register_default_tools(self):
        # ... existing tools
        self.register(MyTool())
```

### 3. Add Tests
```python
# backend/tests/test_tools.py
import pytest
from app.tools.my_tool import MyTool

@pytest.mark.asyncio
async def test_my_tool():
    tool = MyTool()
    result = await tool.execute(param1="test")
    assert result.success
```

## Adding New LLM Providers

### 1. Implement Provider Interface
```python
# backend/app/providers/llm/custom_provider.py
from app.providers.llm.base import LLMProvider
from app.schemas.tools import ToolSchema
from typing import AsyncGenerator, list, dict

class CustomLLMProvider(LLMProvider):
    async def generate(self, messages: list[dict], tools: list[ToolSchema] | None = None, **kwargs) -> dict:
        # Implementation
        pass

    async def stream(self, messages: list[dict], tools: list[ToolSchema] | None = None, **kwargs) -> AsyncGenerator[str, None]:
        # Implementation
        yield "chunk"

    async def close(self):
        # Cleanup
        pass
```

### 2. Update Service to Use New Provider
```python
# backend/app/services/llm_service.py
from app.providers.llm.custom_provider import CustomLLMProvider

class LLMService:
    @property
    def provider(self) -> LLMProvider:
        if self._provider is None:
            # Choose provider based on config
            if settings.use_custom_llm:
                self._provider = CustomLLMProvider()
            else:
                self._provider = OpenAILLMProvider()
        return self._provider
```

## Database Migrations

### Creating Migrations
```bash
cd backend

# Generate migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Environment Variables

### Backend (.env) - Free-by-Default Configuration

```bash
# =============================================================================
# FREE-BY-DEFAULT CONFIGURATION (No paid API keys required for default setup)
# =============================================================================

# LLM Provider Selection (default: groq - free tier available)
# Options: groq, gemini, openai
LLM_PROVIDER=groq

# Groq API Key (required for default Groq provider)
# Get free key from: https://console.groq.com/keys
LLM_API_KEY=your_groq_api_key_here

# Groq Model (default: llama-3.1-70b-versatile)
LLM_MODEL=llama-3.1-70b-versatile

# =============================================================================
# OPTIONAL PAID PROVIDERS (Not required for default setup)
# =============================================================================

# Optional: OpenAI Provider
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4o

# Optional: Google Gemini Provider
# GEMINI_API_KEY=your_gemini_api_key_here
# GEMINI_MODEL=gemini-1.5-flash

# =============================================================================
# WEATHER (Free - uses Open-Meteo, no API key required)
# =============================================================================
# No API key needed for default Open-Meteo weather provider

# =============================================================================
# DATABASE (PostgreSQL)
# =============================================================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=voice_assistant
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Optional: Direct database URL (overrides POSTGRES_* settings)
# DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/voice_assistant

# =============================================================================
# CORS & APPLICATION
# =============================================================================
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# =============================================================================
# Frontend Environment Variables
# Copy this to frontend/.env.local
# =============================================================================
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Debugging

### Backend Debugging
- Use `uvicorn --reload` for auto-reload
- Add `breakpoint()` in code for interactive debugging
- Check logs in terminal
- Use `/health` endpoint for health checks

### Frontend Debugging
- React DevTools for component inspection
- Network tab for WebSocket/REST inspection
- Console for errors and logs
- Redux DevTools (if using Redux)

### WebSocket Debugging
- Browser DevTools → Network → WS
- Inspect frames for message flow
- Check connection state

## Common Issues

### Microphone Not Working
- Ensure HTTPS (required for production)
- Check browser permissions
- Try different browser
- Check `navigator.mediaDevices.getUserMedia` support

### WebSocket Connection Failed
- Verify backend is running on correct port
- Check CORS configuration
- Ensure WebSocket URL uses `ws://` or `wss://`
- Check firewall/proxy settings

### Groq API Errors
- Verify API key is valid
- Check rate limits (14,400 req/day free tier)
- Ensure sufficient credits
- Check model availability

### Browser Speech Recognition Issues
- Ensure HTTPS (required for production)
- Check browser permissions
- Try different browser (Chrome/Edge/Safari best support)
- Check `navigator.mediaDevices.getUserMedia` support

### Browser Speech Synthesis Issues
- Check browser autoplay policy
- Ensure user interaction before play
- Verify audio format support
- Check volume/mute settings
- Quality varies by browser/OS

### Audio Playback Issues
- Check browser autoplay policy
- Ensure user interaction before play
- Verify audio format support
- Check volume/mute settings

## New Features Development

### Implementing Barge-In / Interruption

The system supports user interruption during assistant speech:

1. **Frontend VAD Detection**: `useAudioRecorder` monitors audio level during playback
2. **Cancel Request**: Frontend sends `cancel_request` with current `request_id`
3. **Backend Cancellation**: `ConnectionManager.cancel_request()` cancels LLM and tool tasks
4. **State Transition**: `SPEAKING` → `INTERRUPTED` → `LISTENING`

### Voice Activity Detection (VAD)

Configure VAD in `useAudioRecorder`:
```typescript
const { startRecording } = useAudioRecorder({
  vadThreshold: 0.02,      // Audio level 0-1
  silenceDurationMs: 1500, // ms of silence before auto-stop
  onVoiceActivity: (isActive) => {
    // Handle VAD state changes
  }
});
```

### Request IDs and Cancellation

Every interaction gets a unique `request_id`:
- Generated with `crypto.randomUUID()` on frontend
- Included in all WebSocket events
- Used for cancellation and stale event filtering

```typescript
// Frontend cancellation
const handleInterruption = () => {
  speech.stop();
  if (activeRequestIdRef.current) {
    sendCancelRequest();
    activeRequestIdRef.current = null;
  }
};
```

### Testing Interruption Scenarios

```python
# backend/tests/test_websocket.py
@pytest.mark.asyncio
async def test_interruption_during_speaking():
    # 1. Start request
    # 2. Send cancel_request
    # 3. Verify TTS cancelled
    # 4. Verify state transition to INTERRUPTED
```

## Free-by-Default Provider Configuration

### LLM Provider Selection

The default LLM provider is **Groq** (free tier). Configure via environment:

```bash
# Required for default Groq provider
LLM_API_KEY=your_groq_key_here
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-70b-versatile

# Optional: Switch to other providers
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_key
# OPENAI_MODEL=gpt-4o

# LLM_PROVIDER=gemini
# GEMINI_API_KEY=your_key
# GEMINI_MODEL=gemini-1.5-flash
```

### Groq Free Tier
- **Model**: `llama-3.1-70b-versatile` (default)
- **Rate Limit**: 14,400 requests/day, 30 RPM
- **Context**: 128k tokens
- **Get Key**: https://console.groq.com/keys

### Optional Paid Providers
```bash
# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o

# Google Gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-1.5-flash
```

### STT/TTS - Browser Native (No Backend Required)

The default architecture uses browser-native APIs:
- **STT**: `window.SpeechRecognition` / `webkitSpeechRecognition`
- **TTS**: `window.speechSynthesis`

No backend API keys or services needed for default STT/TTS!

### Weather - Open-Meteo (Free, No Key)

```bash
# No API key required for default weather provider
# Uses Open-Meteo + OpenStreetMap Nominatim (both free)
WEATHER_BASE_URL=https://api.open-meteo.com/v1
GEOCODING_BASE_URL=https://geocoding-api.open-meteo.com/v1
```

## Git Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation

### Commit Messages
```
type(scope): description

[optional body]

[optional footer]
```
Types: feat, fix, docs, style, refactor, test, chore

### Pull Request Process
1. Create feature branch
2. Implement changes
3. Run tests and linting
4. Update documentation
5. Submit PR with description
6. Code review
7. Merge after approval

## Performance Profiling

### Backend
```bash
# Profile with py-spy
py-spy record -o profile.svg -- uvicorn app.main:app

# Or use cProfile
python -m cProfile -o profile.stats -m uvicorn app.main:app
```

### Frontend
- Chrome DevTools Performance tab
- React DevTools Profiler
- Lighthouse for overall performance

## CI/CD Pipeline (Recommended)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: cd backend && pip install -r requirements.txt
      - run: cd backend && ruff check .
      - run: cd backend && mypy app/
      - run: cd backend && pytest

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run type-check
      - run: cd frontend && npm test
```

## Release Process

1. Update version in `pyproject.toml` and `package.json`
2. Update CHANGELOG.md
3. Create release tag
4. Build Docker images
5. Deploy to staging
6. Run smoke tests
7. Deploy to production

## Free-by-Default Cost Analysis

| Component | Provider | Cost | Notes |
|-----------|----------|------|-------|
| **LLM** | Groq (Llama 3.1 70B) | Free tier (14,400 req/day) | Rate limited |
| **STT** | Browser SpeechRecognition | Free | Browser-dependent |
| **TTS** | Browser SpeechSynthesis | Free | Quality varies by browser |
| **Weather** | Open-Meteo + Nominatim | Free | No rate limits published |
| **Database** | PostgreSQL | Self-hosted | Infrastructure cost |

> **Note**: Free tiers have rate limits. The application is designed for development and portfolio demonstrations. Production deployments should evaluate paid tiers for higher availability and rate limits.