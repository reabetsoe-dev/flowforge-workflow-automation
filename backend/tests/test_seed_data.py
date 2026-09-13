from sqlalchemy import func, select
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.execution import WorkflowInstance
from app.models.workflow import Workflow
from app.seed.seed_data import seed_demo_data


def test_full_demo_seed_creates_workflows_and_activity():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        seed_demo_data(db, include_demo_activity=True)

        assert db.scalar(select(func.count(Workflow.id))) == 4
        assert db.scalar(select(func.count(WorkflowInstance.id))) == 22
    finally:
        db.close()
