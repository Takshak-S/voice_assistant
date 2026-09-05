# Upgrade Plan: Real-Time Voice Assistant

## Current Architecture

### Backend (FastAPI)
- **Entry Point**: `app/main.py` - FastAPI app with lifespan management
- **WebSocket**: `app/api/websocket/conversation_ws.py` - Single WebSocket endpoint per conversation
- **LLM Provider**: `app/providers/llm/openai_provider.py` - OpenAI GPT-4o with tool calling support
- **STT Provider**: `app/providers/stt/openai_provider.py` - OpenAI Whisper
- **TTS Provider**: `app/providers/tts/openai_provider.py` - OpenAI TTS (streaming supported)
- **Tools**: `app/tools/` - Calculator, Time, Weather with base `BaseTool` class
- **Conversation Service**: `app/services/conversation_service.py` - Handles message persistence and LLM orchestration
- **Database**: SQLite + SQLAlchemy 2.0 with Conversation and Message models

### Frontend (Next.js 14)
- **Main Hook**: `hooks/useVoiceAssistant.ts` - Orchestrates voice assistant state
- **WebSocket Hook**: `hooks/useWebSocket.ts` - Manages WebSocket connection with reconnection
- **Audio Recording**: `hooks/useAudioRecorder.ts` - MediaRecorder with audio level visualization
- **Speech Synthesis**: `hooks/useSpeechSynthesis.ts` - Audio queue with playback control
- **UI Components**: VoiceControl, ConversationArea, MessageList, StateIndicator, MicrophoneButton

### Current State Machine
```
IDLE → LISTENING → TRANSCRIBING → THINKING → RESPONDING → SPEAKING → IDLE
                      ↘ ERROR ↗
```
Defined states (not all used): IDLE, LISTENING, TRANSCRIBING, THINKING, EXECUTING_TOOL, RESPONDING, SPEAKING, ERROR

### Current WebSocket Events
**Client → Server**: `user_message`, `audio_chunk`, `stop_speaking`, `new_conversation`, `ping`
**Server → Client**: `state_change`, `transcript`, `response_chunk`, `response_complete`, `tool_call`, `tool_result`, `speech_started`, `speech_completed`, `error`, `pong`, `conversation_created`

---

## Current Limitations

### 1. Tool Calling Not Working in Streaming Mode
- The `llm_service.stream()` yields only text chunks, ignores `tool_calls` from OpenAI
- `handle_user_message` in WebSocket handler never executes tools
- Tool execution only works in non-streaming `process_user_message` (REST API)

### 2. No Request ID / Cancellation Support
- No unique identifiers for requests
- Cannot cancel in-flight requests
- No way to ignore stale responses after interruption

### 3. No Barge-In / Interruption Support
- `stop_speaking` only sets state to IDLE, doesn't cancel active TTS or LLM stream
- No detection of user speech during assistant speech
- Frontend `handleStopSpeaking` only calls `speech.stop()` but server continues processing

### 4. Incomplete State Machine
- `EXECUTING_TOOL` state defined but never used
- `INTERRUPTED` state not defined
- Frontend shows "Thinking" during tool execution

### 5. Audio Handling Issues
- TTS audio sent as single base64 blob after full response (not streaming)
- No way to cancel TTS generation on server
- Frontend audio queue can't be fully cleared during interruption

### 6. No Voice Activity Detection
- Recording manually started/stopped by user
- No automatic silence detection

### 6. Limited Observability
- Basic logging only
- No request tracing with IDs
- No performance timing

### 7. Concurrency Issues
- Multiple simultaneous requests can race
- Stale responses can overwrite newer state
- No request lifecycle tracking

---

## Proposed Changes

### Phase 2: Proper AI Tool Orchestration
- Modify `OpenAILLMProvider.stream()` to yield tool calls alongside text
- Update `LLMService.stream()` to handle tool calls during streaming
- Create new `process_user_message_stream_with_tools()` in conversation service
- Update WebSocket handler to execute tools and continue streaming

### Phase 3: Add EXECUTING_TOOL and INTERRUPTED States
- Add `INTERRUPTED` to `AssistantState` enum
- Use `EXECUTING_TOOL` during tool execution
- Update frontend state indicators with user-friendly messages

### Phase 4: Barge-In / User Interruption
- Add `interrupt_request` client event
- Add `request_cancelled` server event
- Implement server-side request tracking with cancellation
- Frontend: detect speech during SPEAKING state → send interrupt
- Backend: cancel TTS, cancel LLM stream, cancel tool execution

### Phase 5: Request IDs and Cancellation
- Generate UUID for each user interaction
- Include `request_id` in all WebSocket events
- Track active requests per conversation on backend
- Implement `cancel_request` event handling
- Frontend ignores events with stale request IDs

### Phase 6: Voice Activity Detection
- Add VAD using Web Audio API AnalyserNode
- Configurable threshold and silence duration
- Auto-stop recording after silence
- Send `audio_chunk` events during recording

### Phase 7: Standardize WebSocket Events
- All events include: `type`, `request_id`, `conversation_id`, `timestamp`, `data`
- New event types for tool execution, cancellation, VAD
- Strict validation of incoming events

### Phase 8: Frontend Request State Management
- Centralized `VoiceAssistantState` with request lifecycle
- Track: `activeRequestId`, `isInterrupted`, `pendingAudio`
- Clear separation between connection state and request state

### Phase 9: Audio Cancellation
- Server: support cancelling TTS generation
- Frontend: immediate audio stop + queue clear + request invalidation
- Handle late `speech_completed` events after cancellation

### Phase 10: Concurrency Safety
- Request guards on backend (ignore events for cancelled requests)
- Frontend: only process events matching `activeRequestId`
- Atomic state transitions

### Phase 11: Observability
- Structured logging with request_id, conversation_id, tool_name
- Timing: STT duration, LLM first token, tool execution, TTS duration
- Log levels: DEBUG for flow, INFO for milestones, ERROR for failures

### Phase 12: Error Handling
- Graceful degradation for each failure mode
- Automatic WebSocket reconnection with state recovery
- User-facing error messages with retry actions

### Phase 13: Testing
- Unit tests for tool orchestration flow
- WebSocket event handling tests
- State machine transition tests
- Cancellation/interruption scenario tests
- Mock external providers

### Phase 14: Documentation
- Update README.md with new features
- Create docs/REALTIME_ARCHITECTURE.md
- Update ARCHITECTURE.md and DEVELOPMENT.md

---

## Files Expected to Change

### Backend
1. `app/schemas/websocket.py` - Add request_id, new event types, INTERRUPTED state
2. `app/schemas/tools.py` - Add execution metadata if needed
3. `app/providers/llm/base.py` - Update stream signature for tool calls
4. `app/providers/llm/openai_provider.py` - Handle tool calls in streaming
5. `app/services/llm_service.py` - Handle tool calls during streaming
6. `app/services/conversation_service.py` - Add streaming with tools method
7. `app/services/tool_service.py` - Add timeout support
8. `app/api/websocket/conversation_ws.py` - Major rewrite for request tracking, cancellation, tool execution
9. `app/main.py` - Update lifespan if needed

### Frontend
1. `types/websocket.ts` - Add request_id, new event types, INTERRUPTED state
2. `hooks/useWebSocket.ts` - Handle new events, request ID filtering
3. `hooks/useVoiceAssistant.ts` - Major rewrite for request lifecycle, interruption, VAD
4. `hooks/useAudioRecorder.ts` - Add VAD support, audio chunk streaming
5. `hooks/useSpeechSynthesis.ts` - Better cancellation support
5. `components/voice/StateIndicator.tsx` - Show EXECUTING_TOOL, INTERRUPTED
6. `components/voice/MicrophoneButton.tsx` - VAD visual feedback
7. `lib/api.ts` - Update if needed

---

## New State Transitions

```
IDLE → LISTENING → TRANSCRIBING → THINKING → EXECUTING_TOOL → RESPONDING → SPEAKING → IDLE
                    ↘ ERROR ↗              ↘
                    ↘ INTERRUPTED ←─────────┘ (from any SPEAKING/RESPONDING/THINKING/EXECUTING_TOOL)
```

---

## New WebSocket Events

### Client → Server
```json
{ "type": "start_listening", "request_id": "...", "conversation_id": 1 }
{ "type": "audio_chunk", "request_id": "...", "data": "base64" }
{ "type": "audio_completed", "request_id": "..." }
{ "type": "user_message", "request_id": "...", "content": "Hello", "conversation_id": 1 }
{ "type": "cancel_request", "request_id": "..." }
{ "type": "new_conversation" }
{ "type": "ping" }
```

### Server → Client
```json
{ "type": "state_changed", "request_id": "...", "state": "thinking", "conversation_id": 1, "timestamp": "..." }
{ "type": "transcription_started", "request_id": "..." }
{ "type": "transcription_completed", "request_id": "...", "text": "Hello" }
{ "type": "thinking_started", "request_id": "..." }
{ "type": "tool_execution_started", "request_id": "...", "name": "calculator", "args": {...} }
{ "type": "tool_execution_completed", "request_id": "...", "name": "calculator", "result": 42 }
{ "type": "response_chunk", "request_id": "...", "content": "The answer is " }
{ "type": "response_completed", "request_id": "..." }
{ "type": "speech_started", "request_id": "..." }
{ "type": "speech_chunk", "request_id": "...", "audio": "base64" }
{ "type": "speech_completed", "request_id": "..." }
{ "type": "request_cancelled", "request_id": "..." }
{ "type": "error", "request_id": "...", "message": "...", "code": "..." }
```

---

## Risks

1. **Breaking Changes**: WebSocket protocol changes require coordinated frontend/backend deployment
2. **Tool Streaming Complexity**: OpenAI streaming with tool calls requires careful chunk parsing
3. **Cancellation Race Conditions**: Need careful synchronization between frontend/backend
4. **Audio Latency**: Streaming TTS adds complexity vs. current single blob approach
5. **VAD False Positives/Negatives**: Threshold tuning required
6. **State Synchronization**: Frontend/backend state must stay in sync during interruptions
7. **Testing Complexity**: Interruption scenarios hard to test reliably

---

## Implementation Order

1. **Backend Foundation**: WebSocket schemas, request tracking, cancellation
2. **LLM Streaming with Tools**: Modify provider and service for tool calls during streaming
3. **WebSocket Handler Rewrite**: Implement new event flow with tool execution
4. **Frontend Request Lifecycle**: Add request IDs, cancellation, state management
5. **Interruption/Barge-In**: Implement speech detection during playback
6. **VAD**: Add to audio recorder
7. **Streaming TTS**: Optional - send audio chunks instead of full blob
8. **Observability**: Add structured logging
9. **Tests**: Unit + integration tests
10. **Documentation**: Update all docs