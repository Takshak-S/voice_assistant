# Real-Time Voice Assistant

A production-quality, full-stack AI voice assistant that enables natural, real-time spoken conversations with an AI. Built with modern technologies including Next.js, FastAPI, WebSockets, and **free-tier AI providers**.

## Features

- **Real-time Voice Conversation**: Speak naturally and hear responses in real-time
- **Speech-to-Text**: Browser Web Speech API (SpeechRecognition) - no backend AI API required
- **AI Conversation**: Free-tier LLM (Groq Llama 3.1) with streaming responses and conversation memory
- **Text-to-Speech**: Browser Web Speech API (SpeechSynthesis) - no backend AI API required
- **Tool Calling**: Calculator, Time (with timezone support), Weather lookup (Open-Meteo, free)
- **WebSocket Communication**: Real-time streaming with state management
- **Modern UI**: Responsive, accessible interface with dark mode
- **Session Management**: Multiple conversations with history
- **Barge-In / Interruption**: User can interrupt assistant while speaking
- **Request Cancellation**: Cancel in-flight requests with unique request IDs
- **Voice Activity Detection**: Automatic speech detection with configurable thresholds
- **Structured Logging**: Comprehensive observability with request tracing

## Free-by-Default Architecture

The project is designed to work **without any paid API keys** for the default configuration:

| Component | Default Provider | Cost | API Key Required |
|-----------|------------------|------|------------------|
| **LLM** | Groq (Llama 3.1 70B) | Free tier (14,400 req/day) | `LLM_API_KEY` |
| **STT** | Browser Web Speech API | Free (browser built-in) | None |
| **TTS** | Browser SpeechSynthesis | Free (browser built-in) | None |
| **Weather** | Open-Meteo + OpenStreetMap | Free (no key required) | None |
| **Database** | PostgreSQL | Self-hosted | None |

> **Optional paid providers** (OpenAI, Gemini) are supported but **never required** for the default setup.

## Architecture

```mermaid
graph TB
    subgraph Frontend[Frontend - Next.js + React]
        UI[Voice UI Components]
        WS[WebSocket Client]
        SR[Speech Recognition (Web Speech API)]
        SS[Speech Synthesis (Web Speech API)]
    end

    subgraph Backend[Backend - FastAPI]
        WS_SERVER[WebSocket Server]
        CONV[Conversation Service]
        LLM[LLM Service]
        TOOLS[Tool Service]
        DB[(PostgreSQL Database)]
    end

    subgraph Providers[External Providers]
        GROQ[Groq API (Free Tier)]
        WEATHER[Open-Meteo + OpenStreetMap (Free)]
    end

    UI --> WS
    UI --> SR
    UI --> SS
    WS <---> WS_SERVER
    WS_SERVER --> CONV
    CONV --> LLM
    CONV --> TOOLS
    CONV --> DB
    LLM --> GROQ
    TOOLS --> WEATHER
```

## Technology Stack

### Frontend
- **Next.js 14** (App Router) - React framework with server components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **WebSocket API** - Real-time communication
- **Web Speech API** - SpeechRecognition (STT) + SpeechSynthesis (TTS)
- **Web Audio API** - Audio visualization & VAD

### Backend
- **FastAPI** - Modern, fast Python web framework
- **SQLAlchemy 2.0** - Async ORM with PostgreSQL
- **Groq Python SDK** - Free-tier LLM with tool calling
- **httpx** - HTTP client for weather API
- **WebSockets** - Native WebSocket support
- **Pydantic** - Data validation and settings

### External Services (Free by Default)
- **Groq** - Free-tier LLM (Llama 3.1 70B, 14,400 req/day)
- **Open-Meteo** - Free weather API (no key required)
- **OpenStreetMap Nominatim** - Free geocoding (no key required)

## Setup Instructions

### Prerequisites
- Node.js 20+
- Python 3.11+
- **Groq API key** (free from https://console.groq.com/keys)
- PostgreSQL (via Docker or local)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd realtime_voice_assistant
```

### 2. Configure Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your API keys
# Required: LLM_API_KEY (Groq free tier)
# Optional: OPENAI_API_KEY, GEMINI_API_KEY (for optional providers)
```

### 3. Run with Docker (Recommended)
```bash
docker-compose up --build
```
Access the application at `http://localhost:3000`

### 4. Run Locally (Development)

#### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys (LLM_API_KEY required)
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
npm run dev
```
Access the application at `http://localhost:3000`

## API Documentation

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/conversation/new` | Create new conversation |
| GET | `/api/conversation/{id}` | Get conversation history |
| GET | `/api/conversation` | List conversations |

### WebSocket Endpoint

```
WS /ws/conversation/{conversation_id}
```

#### Client Messages

All client messages include: `type`, `request_id`, `conversation_id`, `timestamp`, `data`

```json
{ "type": "user_message", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"content": "Hello"} }
{ "type": "start_listening", "request_id": "uuid", "conversation_id": 1, "timestamp": "..." }
{ "type": "stop_speaking", "request_id": "uuid", "conversation_id": 1, "timestamp": "..." }
{ "type": "cancel_request", "request_id": "uuid" }
{ "type": "new_conversation" }
{ "type": "ping" }
```

#### Server Messages

All server messages include: `type`, `request_id`, `conversation_id`, `timestamp`, `data`

```json
{ "type": "state_change", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"state": "listening"} }
{ "type": "transcription_started", "request_id": "uuid", "conversation_id": 1, "timestamp": "..." }
{ "type": "transcription_completed", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"text": "Hello", "is_final": true} }
{ "type": "thinking_started", "request_id": "uuid", "conversation_id": 1, "timestamp": "..." }
{ "type": "tool_execution_started", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"name": "calculator", "args": {"expression": "2+2"}} }
{ "type": "tool_execution_completed", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"name": "calculator", "result": 4, "error": null} }
{ "type": "response_chunk", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"content": "Hi there!"} }
{ "type": "response_complete", "request_id": "uuid", "conversation_id": 1, "timestamp": "..." }
{ "type": "request_cancelled", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"request_id": "uuid"} }
{ "type": "error", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"message": "Error details", "code": "ERROR_CODE"} }
{ "type": "conversation_created", "request_id": "uuid", "conversation_id": 1, "timestamp": "...", "data": {"conversation_id": 2} }
```

## Voice Pipeline (Free-by-Default)

```
User Speech
    ↓
Browser Speech Recognition (Web Speech API)
    ↓
Transcript Display (interim + final)
    ↓
User Message (WebSocket)
    ↓
LLM Processing (Groq Llama 3.1) + Tool Calling
    ↓
Streaming Response (WebSocket)
    ↓
Browser Speech Synthesis (Web Speech API)
    ↓
Audio Playback (HTMLAudioElement) with Interruption Support
```

## Tool System

Tools are implemented as modular classes with a standard interface:

```python
class BaseTool:
    @property
    def name(self) -> str: ...
    @property
    def description(self) -> str: ...
    @property
    def parameters(self) -> dict: ...
    async def execute(self, **kwargs) -> ToolResult: ...
```

### Available Tools

1. **Calculator** - Safe mathematical expression evaluation
   - Supports: `+`, `-`, `*`, `/`, `%`, `**`, parentheses
   - No `eval()` - uses AST parsing for security
   - Timeout protection (30s default)

2. **Time** - Timezone-aware current time
   - Uses IANA timezone names (e.g., `America/New_York`, `Asia/Tokyo`)
   - Requires Python 3.9+ or `backports.zoneinfo`

3. **Weather** - Current weather conditions (Open-Meteo, free)
   - No API key required
   - Free geocoding via OpenStreetMap Nominatim
   - Supports metric/imperial units

## New Features

### Barge-In / User Interruption
Users can interrupt the assistant while it's speaking:
1. User starts speaking during `SPEAKING` state
2. Frontend detects voice activity (VAD)
3. Sends `cancel_request` with current `request_id`
4. Backend cancels LLM stream and tool execution
6. State transitions to `INTERRUPTED` → `LISTENING`
6. New request begins with new `request_id`

### Request IDs and Cancellation
- Every interaction gets a unique `request_id` (UUID)
- All WebSocket events include `request_id`
- Frontend ignores events with stale `request_id`
- `cancel_request` event cancels in-flight processing
- `request_cancelled` event confirms cancellation

### Voice Activity Detection (VAD)
- Configurable threshold (`vadThreshold`, default 0.02)
- Configurable silence duration (`silenceDurationMs`, default 1500ms)
- Real-time audio level visualization
- Automatic `audio_completed` after silence

### State Machine

```
IDLE → LISTENING → TRANSCRIBING → THINKING → EXECUTING_TOOL → RESPONDING → SPEAKING → IDLE
                    ↘ ERROR ↗              ↘
                    ↘ INTERRUPTED ←─────────┘ (from any SPEAKING/RESPONDING/THINKING/EXECUTING_TOOL)
```

### Structured Logging
Backend logs include contextual identifiers:
- `request_id` - Unique request identifier
- `conversation_id` - Conversation identifier
- `tool_name` - Tool being executed
- `duration_ms` - Operation duration in milliseconds

Log events:
- `request_started` / `request_completed` / `request_error` / `request_cancelled`
- `llm_first_token` / `llm_completed`
- `tool_executed`
- `tts_first_chunk` / `tts_completed`

## Development

### Running Tests

#### Backend
```bash
cd backend
pytest -v
pytest --cov=app --cov-report=html
```

#### Frontend
```bash
cd frontend
npm test
npm run test:watch
```

### Code Quality

#### Backend
```bash
cd backend
ruff check .
ruff check . --fix
mypy app/
```

#### Frontend
```bash
cd frontend
npm run lint
npm run type-check
```

## Project Structure

```
realtime_voice_assistant/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/          # REST endpoints
│   │   │   └── websocket/       # WebSocket handlers
│   │   ├── core/                # Config, database
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Business logic
│   │   ├── providers/           # Provider abstractions
│   │   │   ├── llm/             # LLM providers (Groq, OpenAI, Gemini)
│   │   │   ├── stt/             # STT providers (browser-based)
│   │   │   └── tts/             # TTS providers (browser-based)
│   │   └── tools/               # Tool implementations
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── app/                     # Next.js App Router
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   ├── conversation/        # Chat components
│   │   ├── voice/               # Voice UI components
│   │   └── controls/            # Control components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities, API client
│   ├── services/                # Frontend services
│   ├── types/                   # TypeScript types
│   └── styles/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── REALTIME_ARCHITECTURE.md
│   └── UPGRADE_PLAN.md
├── docker-compose.yml
└── README.md
```

## Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LLM_API_KEY` | Groq API key (free tier) | **Yes** |
| `LLM_PROVIDER` | LLM provider: `groq`, `gemini`, `openai` | No (default: `groq`) |
| `LLM_MODEL` | Model name | No (default: `llama-3.1-70b-versatile`) |

### Optional Paid Providers

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | No |
| `OPENAI_MODEL` | OpenAI model | No (default: `gpt-4o`) |
| `GEMINI_API_KEY` | Google Gemini API key | No |
| `GEMINI_MODEL` | Gemini model | No (default: `gemini-1.5-flash`) |

### Database (PostgreSQL)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_DB` | `voice_assistant` | Database name |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `DATABASE_URL` | (auto) | Full connection string (overrides above) |

### Voice Activity Detection

| Variable | Default | Description |
|----------|---------|-------------|
| `VOICE_ACTIVITY_THRESHOLD` | `0.02` | VAD sensitivity (0-1) |
| `SILENCE_DURATION_MS` | `1500` | Silence duration before auto-stop |

### Weather (Free - Open-Meteo)

| Variable | Default | Description |
|----------|---------|-------------|
| `WEATHER_BASE_URL` | `https://api.open-meteo.com/v1` | Weather API base |
| `GEOCODING_BASE_URL` | `https://geocoding-api.open-meteo.com/v1` | Geocoding API base |

## Known Limitations

1. **Browser Speech Recognition**: Requires HTTPS in production (localhost works). Not all browsers support SpeechRecognition (Chrome/Edge/Safari supported, Firefox limited).
2. **Browser TTS Quality**: SpeechSynthesis quality varies by browser/OS. No voice selection in some browsers.
3. **Groq Rate Limits**: Free tier has rate limits (14,400 req/day, 30 RPM). Monitor usage.
4. **Weather API**: Open-Meteo has rate limits. No authentication but be respectful.
5. **WebSocket Reconnection**: Automatic reconnection with exponential backoff.
6. **Audio Format**: Browser STT uses browser's preferred format (typically WebM/Opus).
6. **Single User**: No authentication/multi-user support in MVP.

## Future Improvements

- [ ] Wake word detection (Porcupine/Picovoice)
- [ ] Persistent user memory with vector database
- [ ] User authentication and multi-tenancy
- [ ] Multi-language support
- [ ] Calendar integration (Google/Outlook)
- [ ] Email integration
- [ ] Advanced RAG with document upload
- [ ] Mobile application (React Native)
- [ ] Conversation summarization
- [ ] Export/import conversations
- [ ] Custom tool/plugin system
- [ ] Analytics and usage metrics

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Support

For issues and feature requests, please open a GitHub issue.