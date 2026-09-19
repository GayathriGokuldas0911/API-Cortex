from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Create sessionmaker factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base for models
Base = declarative_base()


def get_db():
    """Dependency for obtaining database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
