# Implementation Plan: Real-Time Voice Assistant

## Architecture Decisions

### Technology Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Python + FastAPI
- **Real-time**: WebSockets (via FastAPI's native WebSocket support)
- **Database**: SQLite (for conversation persistence)
- **LLM Provider**: OpenAI GPT-4o (with abstraction for future providers)
- **Speech-to-Text**: OpenAI Whisper API (with Web Speech API fallback)
- **Text-to-Speech**: OpenAI TTS API (with browser Web Speech API fallback)

### Architecture Pattern
- Clean architecture with provider abstractions
- Backend handles all API keys (never exposed to frontend)
- WebSocket for real-time streaming responses
- Session-based conversation memory

### Provider Choices
| Service | Primary Provider | Fallback |
|---------|-----------------|----------|
| LLM | OpenAI GPT-4o | None (required) |
| STT | OpenAI Whisper | Browser Web Speech API |
| TTS | OpenAI TTS | Browser Web Speech API |
| Weather | OpenWeatherMap | None (optional) |

---

## Feature Breakdown

### Phase 1: Project Foundation
- [ ] Frontend setup (Next.js + TypeScript + Tailwind)
- [ ] Backend setup (FastAPI + SQLite)
- [ ] Environment configuration (.env.example)
- [ ] Docker Compose for local development
- [ ] Health check endpoints
- [ ] Basic project structure

### Phase 2: Core Conversation
- [ ] LLM provider abstraction
- [ ] OpenAI LLM provider implementation
- [ ] Conversation API endpoints
- [ ] Conversation history (SQLite)
- [ ] Streaming responses via WebSocket
- [ ] System prompt / instructions

### Phase 3: Voice Input
- [ ] STT provider abstraction
- [ ] OpenAI Whisper provider
- [ ] Browser Web Speech API provider (fallback)
- [ ] Audio recording in frontend (MediaRecorder API)
- [ ] Microphone permission handling
- [ ] Transcript display (interim + final)
- [ ] Recording state UI

### Phase 4: Voice Output
- [ ] TTS provider abstraction
- [ ] OpenAI TTS provider
- [ ] Browser Web Speech API provider (fallback)
- [ ] Audio playback in frontend
- [ ] Mute/unmute controls
- [ ] Stop speaking functionality

### Phase 5: AI Tools
- [ ] Tool system abstraction
- [ ] Calculator tool (safe evaluation)
- [ ] Time tool (timezone-aware)
- [ ] Weather tool (OpenWeatherMap)
- [ ] Tool calling integration with LLM

### Phase 6: Real-Time Experience
- [ ] WebSocket connection management
- [ ] State machine (IDLE → LISTENING → TRANSCRIBING → THINKING → EXECUTING_TOOL → RESPONDING → SPEAKING → IDLE)
- [ ] Real-time UI updates
- [ ] Connection reconnection logic
- [ ] Progress events

### Phase 7: Polish
- [ ] Responsive UI design
- [ ] Loading states and animations
- [ ] Error handling and user-friendly messages
- [ ] Accessibility (ARIA, keyboard navigation)
- [ ] Theme support (light/dark)
- [ ] Mobile responsiveness

### Phase 8: Testing
- [ ] Backend unit tests (pytest)
- [ ] Frontend component tests (Jest + React Testing Library)
- [ ] E2E tests for critical flows
- [ ] Type checking (mypy, tsc)
- [ ] Linting (ruff, eslint)

### Phase 9: Documentation
- [ ] README.md
- [ ] ARCHITECTURE.md
- [ ] DEVELOPMENT.md
- [ ] API documentation

---

## API Design

### REST Endpoints
```
GET  /health                    # Health check
POST /api/conversation          # Send message (non-streaming)
POST /api/conversation/new      # Create new conversation
GET  /api/conversation/{id}     # Get conversation history
POST /api/transcribe            # Transcribe audio file
POST /api/speech                # Generate speech from text
```

### WebSocket Endpoint
```
WS   /ws/conversation/{id}      # Real-time conversation
```

### WebSocket Message Types
```typescript
// Client -> Server
{ type: "user_message", content: string }
{ type: "audio_chunk", data: string }  // base64 audio
{ type: "stop_speaking" }
{ type: "new_conversation" }

// Server -> Client
{ type: "state_change", state: AssistantState }
{ type: "transcript", text: string, is_final: boolean }
{ type: "response_chunk", text: string }
{ type: "response_complete" }
{ type: "tool_call", name: string, args: object }
{ type: "tool_result", name: string, result: object }
{ type: "speech_started" }
{ type: "speech_completed" }
{ type: "error", message: string, code: string }
```

---

## Component Structure

### Frontend (Next.js)
```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── providers.tsx
├── components/
│   ├── ui/                    # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── conversation/
│   │   ├── ConversationArea.tsx
│   │   ├── Message.tsx
│   │   └── MessageList.tsx
│   ├── voice/
│   │   ├── VoiceControl.tsx
│   │   ├── MicrophoneButton.tsx
│   │   ├── StateIndicator.tsx
│   │   └── TranscriptDisplay.tsx
│   └── controls/
│       ├── ConversationControls.tsx
│       ├── MuteToggle.tsx
│       └── ThemeToggle.tsx
├── hooks/
│   ├── useWebSocket.ts
│   ├── useVoiceAssistant.ts
│   ├── useAudioRecorder.ts
│   └── useSpeechSynthesis.ts
├── lib/
│   ├── api.ts
│   ├── websocket.ts
│   └── utils.ts
├── services/
│   ├── stt.ts
│   ├── tts.ts
│   └── audio.ts
├── types/
│   ├── conversation.ts
│   ├── websocket.ts
│   └── assistant.ts
└── styles/
    └── globals.css
```

### Backend (FastAPI)
```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── api/
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   ├── conversation.py
│   │   │   ├── transcribe.py
│   │   │   └── speech.py
│   │   └── websocket/
│   │       └── conversation_ws.py
│   ├── models/
│   │   └── conversation.py
│   ├── schemas/
│   │   ├── conversation.py
│   │   ├── websocket.py
│   │   └── tools.py
│   ├── services/
│   │   ├── conversation_service.py
│   │   ├── llm_service.py
│   │   ├── stt_service.py
│   │   ├── tts_service.py
│   │   └── tool_service.py
│   ├── providers/
│   │   ├── llm/
│   │   │   ├── base.py
│   │   │   └── openai_provider.py
│   │   ├── stt/
│   │   │   ├── base.py
│   │   │   ├── openai_provider.py
│   │   │   └── web_speech_provider.py
│   │   └── tts/
│   │       ├── base.py
│   │       ├── openai_provider.py
│   │       └── web_speech_provider.py
│   └── tools/
│       ├── base.py
│       ├── calculator.py
│       ├── time_tool.py
│       └── weather.py
├── tests/
│   ├── test_conversation.py
│   ├── test_tools.py
│   └── test_providers.py
├── requirements.txt
└── pyproject.toml
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API costs | High | Implement token limits, caching |
| WebSocket disconnections | Medium | Auto-reconnect with exponential backoff |
| Browser audio permissions | High | Clear permission UI, fallback to text |
| STT/TTS latency | Medium | Streaming responses, loading states |
| Rate limiting | Medium | Retry logic, user feedback |
| No API keys available | High | Document setup, provide mock modes |

---

## Implementation Order

1. **Foundation** - Both frontend and backend scaffolding
2. **Backend Core** - Database, config, health check
3. **LLM Integration** - Provider abstraction + OpenAI implementation
4. **Conversation API** - REST + WebSocket
5. **Frontend Chat** - Basic text conversation UI
6. **Voice Input** - STT providers + audio recording
7. **Voice Output** - TTS providers + audio playback
8. **Tools** - Calculator, Time, Weather
9. **Real-time Polish** - State machine, streaming UI
10. **Testing & Docs**