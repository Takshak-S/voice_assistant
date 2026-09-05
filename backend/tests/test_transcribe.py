import io
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.stt_service import STTService


def test_transcribe_invalid_file_type():
    client = TestClient(app)
    # Post a text file
    response = client.post(
        "/api/transcribe",
        files={"file": ("test.txt", b"hello world", "text/plain")}
    )
    assert response.status_code == 400
    assert "audio" in response.json()["detail"].lower()


def test_transcribe_endpoint_success():
    client = TestClient(app)
    with patch("app.services.stt_service.stt_service.transcribe", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = "Hello from audio recording"
        response = client.post(
            "/api/transcribe",
            files={"file": ("speech.webm", b"mocked-audio-bytes", "audio/webm")},
            data={"language": "en"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Hello from audio recording"
        mock_stt.assert_called_once()


@pytest.mark.asyncio
async def test_stt_service_empty_audio():
    service = STTService()
    with pytest.raises(ValueError, match="Audio data is empty"):
        await service.transcribe(b"")
