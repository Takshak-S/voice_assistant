# Architecture Documentation

## System Overview

The Real-Time Voice Assistant is a full-stack application consisting of a Next.js frontend and a FastAPI backend, communicating via WebSockets for real-time interaction and REST APIs for auxiliary operations.

**Free-by-Default Architecture**: The default configuration uses only free-tier services:
- **LLM**: Groq (Llama 3.1 70B) - free tier
- **STT**: Browser Web Speech API (SpeechRecognition)
- **TTS**: Browser Web Speech API (SpeechSynthesis)
- **Weather**: Open-Meteo + OpenStreetMap (free, no API key)
- **Database**: PostgreSQL (self-hosted)

## Data Flow

### Voice Input Pipeline (Browser-based STT)

```
1. User clicks microphone button
2. Frontend requests microphone permission
3. Browser SpeechRecognition starts (Web Speech API)
4. Interim transcripts sent via WebSocket for display
5. Final transcript sent via WebSocket as user_message
6. Backend processes message through LLM pipeline
```

### Conversation Processing Pipeline

```
1. User message received (text from browser STT)
2. Message saved to database
3. Conversation history retrieved
4. Messages formatted for LLM (including system prompt)
5. LLM generates response (with tool calling if needed)
6. If tools called:
   a. Tool executed
   b. Result added to conversation
   c. LLM generates final response
7. Response streamed to frontend via WebSocket
8. Response saved to database
9. Frontend uses browser SpeechSynthesis for TTS
10. Audio played via HTMLAudioElement
```

### Real-Time Communication

WebSocket message flow with state machine:

```
IDLE → LISTENING → TRANSCRIBING → THINKING → [EXECUTING_TOOL] → RESPONDING → SPEAKING → IDLE
                                    ↓
                              (error) → ERROR → IDLE
                                    ↓
                              INTERRUPTED ←─────────┘ (from SPEAKING/RESPONDING/THINKING/EXECUTING_TOOL)
```

## Component Architecture

### Backend Services

#### ConversationService
- Manages conversation lifecycle
- Handles message persistence
- Coordinates LLM, tool services
- Provides streaming processing

#### LLMService
- Abstracts LLM provider (Groq default, OpenAI/Gemini optional)
- Handles tool calling integration
- Manages conversation context
- Supports streaming responses with tool execution

#### ToolService
- Registry of available tools
- Handles tool execution and validation
- Provides OpenAI function schemas
- Timeout protection for tool execution

### Provider Abstractions

All external services use provider patterns for flexibility:

```
LLMProvider (ABC)
    ├── GroqProvider (default, free)
    ├── OpenAIProvider (optional)
    └── GeminiProvider (optional)

STTProvider (ABC)
    └── BrowserSpeechRecognition (no backend implementation)

TTSProvider (ABC)
    └── BrowserSpeechSynthesis (no backend implementation)
```

This allows swapping providers without changing business logic.

### Frontend Architecture

#### Custom Hooks
- `useWebSocket` - WebSocket connection management with reconnection
- `useSpeechRecognition` - Browser SpeechRecognition (Web Speech API)
- `useSpeechSynthesis` - Browser SpeechSynthesis (Web Speech API)
- `useVoiceAssistant` - Main orchestrator hook combining all functionality

#### Component Hierarchy
```
Page
├── Header (connection status, theme toggle)
├── ConversationArea
│   └── MessageList
│       └── MessageItem
├── VoiceControl
│   ├── StateIndicator
│   ├── MicrophoneButton (with audio visualizer)
│   └── TranscriptDisplay
└── Controls
    ├── ConversationControls
    ├── MuteToggle
    └── ThemeToggle
```

## State Management

### Backend State Machine

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| IDLE | Waiting for input | → LISTENING |
| LISTENING | Recording audio | → TRANSCRIBING, → IDLE (cancel) |
| TRANSCRIBING | Processing speech | → THINKING, → ERROR |
| THINKING | LLM processing | → EXECUTING_TOOL, → RESPONDING, → ERROR |
| EXECUTING_TOOL | Running tool | → THINKING, → RESPONDING, → ERROR |
| RESPONDING | Generating response | → SPEAKING, → ERROR |
| SPEAKING | Playing audio | → IDLE, → INTERRUPTED |
| INTERRUPTED | Request cancelled | → LISTENING, → IDLE |
| ERROR | Error occurred | → IDLE |

### Frontend State

Frontend mirrors backend state via WebSocket messages and manages local UI state:
- Connection status
- Recording state
- Transcript display (interim + final)
- Message history
- Audio playback queue
- Settings (mute, volume, theme)
- Active request ID for cancellation tracking
- STT support detection

## Request Lifecycle & Cancellation

### Request IDs

Every user interaction gets a unique `request_id` (UUID v4):
- Generated on frontend when interaction starts
- Included in all WebSocket events
- Used for cancellation and stale event filtering

### Request Lifecycle

```
User
  ↓
Request ID created (UUID)
  ↓
Voice/Text input
  ↓
Processing
  ↓
Optional Tool Execution
  ↓
Streaming Response
  ↓
Browser Speech Synthesis (TTS)
  ↓
Completed
```

### Cancellation Flow

```
Assistant Speaking
  ↓
User Speech Detected (VAD)
  ↓
Request Cancelled (cancel_request)
  ↓
Audio Stopped (Frontend + Backend)
  ↓
Old Events Invalidated (stale request_id)
  ↓
New Request Created (new request_id)
  ↓
Processing Resumes
```

### Concurrency Safety

**Backend**
- `ConnectionManager` tracks active requests per conversation
- `manager.is_request_active(request_id)` checked before sending events
- Cancelled requests removed from active set
- `asyncio.Lock` protects shared state

**Frontend**
- `activeRequestIdRef` tracks current request
- All event handlers verify `message.request_id === activeRequestIdRef.current`
- `useSpeechSynthesis` tracks `currentRequestIdRef`, skips stale audio
- Queue cleared on interruption

### Race Condition Handling

| Scenario | Protection |
|----------|------------|
| User sends request A, then quickly request B | Request B gets new `request_id`; A's events ignored |
| Assistant speaking, user interrupts | `cancel_request` sent; stale `speech_chunk` ignored |
| Tool executing, user cancels | Backend checks `is_request_active` before sending tool result |
| WebSocket reconnects mid-request | Old `request_id` invalidated; new request started |
| Multiple `response_chunk` events | All checked against active `request_id` |

## Free-by-Default Provider Architecture

### LLM Providers

| Provider | Model | Free Tier | Tool Calling | Streaming |
|----------|-------|-----------|--------------|-----------|
| **Groq (default)** | Llama 3.1 70B Versatile | 14,400 req/day | ✅ | ✅ |
| OpenAI | GPT-4o | Paid | ✅ | ✅ |
| Google Gemini | Gemini 1.5 Flash | Free tier | ✅ | ✅ |

**Default**: Groq with `llama-3.1-70b-versatile`

### STT Provider

| Provider | Implementation | Cost | Browser Support |
|----------|----------------|------|-----------------|
| **Browser SpeechRecognition (default)** | Web Speech API | Free | Chrome, Edge, Safari |
| OpenAI Whisper | Backend API | Paid | Universal |

**Default**: Browser SpeechRecognition (Web Speech API)

### TTS Provider

| Provider | Implementation | Cost | Browser Support |
|----------|----------------|------|-----------------|
| **Browser SpeechSynthesis (default)** | Web Speech API | Free | All modern browsers |
| OpenAI TTS | Backend API | Paid | Universal |

**Default**: Browser SpeechSynthesis (Web Speech API)

### Weather Provider

| Provider | API | Cost | Geocoding |
|----------|-----|------|-----------|
| **Open-Meteo (default)** | Free, no key | Free | OpenStreetMap Nominatim (free) |
| OpenWeatherMap | Paid API | Paid | Built-in |

**Default**: Open-Meteo + OpenStreetMap Nominatim (both free, no keys)

## Voice Activity Detection (VAD)

The frontend implements client-side VAD using Web Audio API:

```typescript
const { startRecording } = useAudioRecorder({
  vadThreshold: 0.02,      // Audio level 0-1
  silenceDurationMs: 1500, // ms of silence before auto-stop
  onVoiceActivity: (isActive) => {
    // Handle VAD state changes
  }
});
```

### VAD Algorithm

1. AnalyserNode captures frequency data
2. Average level normalized to 0-1
3. If level > threshold: voice active
4. If level < threshold for `silenceDurationMs`: speech ended
5. Auto-sends `audio_completed` event

### VAD Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `vadThreshold` | 0.02 | Audio level threshold (0-1) |
| `silenceDurationMs` | 1500 | Silence duration before auto-stop |

## Interruption / Barge-In

### Flow

```
Assistant Speaking
  ↓
User Speech Detected (VAD)
  ↓
Request Cancelled (cancel_request)
  ↓
Audio Stopped (Frontend + Backend)
  ↓
Old Events Invalidated (stale request_id)
  ↓
New Request Created (new request_id)
  ↓
Processing Resumes
```

### Implementation

1. **Detection**: Frontend VAD monitors audio level during `SPEAKING` state
2. **Cancellation**: Frontend calls `speech.stop()`, sends `cancel_request` with `request_id`
3. **Backend**: `ConnectionManager.cancel_request()` cancels LLM and tool tasks
4. **State**: `SPEAKING` → `INTERRUPTED` → `LISTENING`
5. **New Request**: New `request_id` generated for subsequent interaction

## Database Schema

### Conversations Table
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY,
    title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_name TEXT,
    tool_call_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Considerations

1. **API Keys**: Never exposed to frontend; all provider calls made from backend
2. **CORS**: Configured for specific origins only
3. **Input Validation**: All inputs validated via Pydantic schemas
4. **SQL Injection**: Prevented by SQLAlchemy ORM
5. **Calculator Safety**: AST-based evaluation, no `eval()`
6. **Rate Limiting**: Recommended for production (not implemented in MVP)
6. **HTTPS Required**: For microphone access in production

## Scalability Considerations

### Current Limitations
- PostgreSQL database (single writer - fine for MVP)
- In-memory WebSocket connection management
- Single backend instance

### Production Improvements
- Redis for WebSocket session storage
- Load balancer with sticky sessions for WebSockets
- Horizontal scaling with message broker (Redis/RabbitMQ)
- CDN for static assets
- API rate limiting

## Error Handling

### Backend
- Structured error responses with codes
- Comprehensive logging
- Graceful degradation
- Transaction rollback on failures

### Frontend
- User-friendly error messages
- Automatic reconnection
- Visual error states
- Toast notifications for transient errors

## Testing Strategy

### Backend
- Unit tests for tools and services
- Integration tests for API endpoints
- Mock external providers
- Test WebSocket message handling
- Test cancellation and interruption scenarios

### Frontend
- Component tests with React Testing Library
- Hook tests
- Integration tests for voice flow
- Accessibility testing

## Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Frontend   │────▶│   Backend   │
│  (Browser)  │     │  (Next.js)  │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                     ┌─────────────┐            │
                     │   Groq      │◀───────────┤
                     │   API       │            │
                     └─────────────┘            │
                                               ▼
                     ┌─────────────┐     ┌─────────────┐
                     │  Open-Meteo │     │  PostgreSQL │
                     │  + Nominatim│     │  Database   │
                     └─────────────┘     └─────────────┘
```

Docker Compose orchestrates both services with shared network.