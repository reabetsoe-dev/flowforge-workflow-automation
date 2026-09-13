from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

LOCAL_SQLITE_PREFIXES = ("sqlite://", "sqlite:///")


def build_database_url() -> str:
    configured_url = settings.database_url.strip() or "sqlite:///./flowforge.db"
    if settings.turso_database_url and (
        not configured_url
        or configured_url == "sqlite:///./flowforge.db"
        or configured_url.startswith("libsql://")
    ):
        turso_url = settings.turso_database_url.strip()
        if turso_url.startswith("sqlite+libsql://"):
            return turso_url
        separator = "&" if "?" in turso_url else "?"
        return f"sqlite+{turso_url}{separator}secure=true"

    if configured_url.startswith("libsql://"):
        separator = "&" if "?" in configured_url else "?"
        return f"sqlite+{configured_url}{separator}secure=true"

    if settings.running_on_vercel and configured_url == "sqlite:///./flowforge.db":
        return "sqlite:////tmp/flowforge.db"

    return configured_url


DATABASE_URL = build_database_url()


def build_connect_args(database_url: str) -> dict[str, str | bool]:
    if database_url.startswith("sqlite+libsql://"):
        if settings.turso_auth_token:
            return {"auth_token": settings.turso_auth_token}
        return {}
    if database_url.startswith(LOCAL_SQLITE_PREFIXES):
        return {"check_same_thread": False}
    return {}


connect_args = build_connect_args(DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema()


def ensure_sqlite_schema() -> None:
    if not DATABASE_URL.startswith(LOCAL_SQLITE_PREFIXES):
        return

    inspector = inspect(engine)
    if "tasks" not in inspector.get_table_names():
        return

    task_columns = {column["name"] for column in inspector.get_columns("tasks")}
    with engine.begin() as connection:
        if "comments" not in task_columns:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN comments TEXT"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
