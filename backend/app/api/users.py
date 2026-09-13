from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/users", tags=["Users"])


def user_to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        active=user.active,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_department_or_404(db: Session, department_id: int | None) -> Department | None:
    if department_id is None:
        return None
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found.",
        )
    return department


def ensure_unique_email(db: Session, email: str, user_id: int | None = None) -> None:
    existing = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
    if existing is not None and existing.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )


@router.get("", response_model=list[UserRead])
def list_users(
    _: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
) -> list[UserRead]:
    users = db.scalars(
        select(User)
        .options(joinedload(User.department))
        .order_by(User.active.desc(), User.full_name)
    ).all()
    return [user_to_read(user) for user in users]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
) -> UserRead:
    email = normalize_email(payload.email)
    ensure_unique_email(db, email)
    get_department_or_404(db, payload.department_id)

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        department_id=payload.department_id,
        active=payload.active,
    )
    db.add(user)
    db.flush()
    record_audit_log(
        db,
        current_user,
        "USER_CREATED",
        "User",
        user.id,
        f"{current_user.full_name} created user {user.email}.",
    )
    db.commit()
    db.refresh(user)
    return user_to_read(user)


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
) -> UserRead:
    user = db.scalar(
        select(User).options(joinedload(User.department)).where(User.id == user_id)
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    data = payload.model_dump(exclude_unset=True)
    if data.get("active") is False and user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    if "email" in data and data["email"] is not None:
        email = normalize_email(data["email"])
        ensure_unique_email(db, email, user.id)
        user.email = email
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()
    if "role" in data and data["role"] is not None:
        user.role = data["role"]
    if "department_id" in data:
        get_department_or_404(db, data["department_id"])
        user.department_id = data["department_id"]
    if "active" in data and data["active"] is not None:
        user.active = data["active"]
    if data.get("password"):
        user.password_hash = get_password_hash(data["password"])

    record_audit_log(
        db,
        current_user,
        "USER_UPDATED",
        "User",
        user.id,
        f"{current_user.full_name} updated user {user.email}.",
    )
    db.commit()
    db.refresh(user)
    return user_to_read(user)
