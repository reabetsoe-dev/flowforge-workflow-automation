from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from app.api import (
    approvals,
    auth,
    analytics,
    audit,
    dashboard,
    departments,
    instances,
    notifications,
    tasks,
    users,
    workflows,
)
from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.models.execution import WorkflowInstance
from app.models.user import User
from app.models.workflow import Workflow
from app.seed.seed_data import seed_demo_data


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


def seed_demo_data_if_empty() -> None:
    db = SessionLocal()
    try:
        user_count = db.scalar(select(func.count(User.id))) or 0
        workflow_count = db.scalar(select(func.count(Workflow.id))) or 0
        instance_count = db.scalar(select(func.count(WorkflowInstance.id))) or 0
        if user_count == 0 or workflow_count == 0 or instance_count < 22:
            seed_demo_data(db, include_demo_activity=True)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.running_on_vercel:
        seed_demo_data_if_empty()
    yield


settings = get_settings()

app = FastAPI(
    title="FlowForge API",
    description="Backend API for the FlowForge workflow automation demo.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(instances.router, prefix="/api")
app.include_router(approvals.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/api/health", tags=["System"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "flowforge-api"}


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        requested_path = (FRONTEND_DIST / full_path).resolve()
        try:
            requested_path.relative_to(FRONTEND_DIST)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Static asset not found") from exc

        if requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(FRONTEND_DIST / "index.html")
