from app.core.database import Base, SessionLocal, engine, init_db
from app.seed.seed_data import seed_demo_data


def main() -> None:
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        seed_demo_data(db, include_demo_activity=True)
        print("FlowForge demo data reset.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
