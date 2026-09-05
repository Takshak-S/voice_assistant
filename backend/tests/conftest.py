import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.config import Settings
from app.core.database import Base, get_db
from app.main import app

# Override settings for testing
test_settings = Settings(
    postgres_user="test",
    postgres_password="test",
    postgres_db="test_voice_assistant",
    postgres_host="localhost",
    postgres_port=5432,
    database_url="sqlite:///:memory:",
    openai_api_key="test",
)

@pytest.fixture(scope="session")
def engine():
    # Use SQLite in-memory for tests
    engine = create_engine(test_settings.sqlalchemy_database_uri, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(engine):
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(autouse=True)
def override_get_db(db_session):
    def _get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    with TestClient(app) as client:
        yield client