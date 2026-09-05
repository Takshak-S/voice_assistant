from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import conversation, health, speech, transcribe
from app.api.websocket import conversation_ws
from app.core.config import get_settings
from app.core.database import init_db
from app.services.llm_service import llm_service
from app.services.stt_service import stt_service
from app.services.tts_service import tts_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    await llm_service.close()
    await stt_service.close()
    await tts_service.close()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(conversation.router)
app.include_router(transcribe.router)
app.include_router(speech.router)
app.include_router(conversation_ws.router)


@app.get("/")
def root():
    return {"message": "Real-Time Voice Assistant API", "version": "0.1.0"}
