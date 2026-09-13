from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/departments", tags=["Departments"])


def department_to_read(department: Department, user_count: int = 0) -> DepartmentRead:
    return DepartmentRead(
        id=department.id,
        name=department.name,
        description=department.description,
        user_count=user_count,
        created_at=department.created_at,
        updated_at=department.updated_at,
    )


def ensure_unique_department_name(
    db: Session,
    name: str,
    department_id: int | None = None,
) -> None:
    query = select(Department).where(func.lower(Department.name) == name.lower())
    existing = db.scalar(query)
    if existing is not None and existing.id != department_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A department with this name already exists.",
        )


@router.get("", response_model=list[DepartmentRead])
def list_departments(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DepartmentRead]:
    rows = db.execute(
        select(Department, func.count(User.id))
        .outerjoin(User, User.department_id == Department.id)
        .group_by(Department.id)
        .order_by(Department.name)
    ).all()
    return [department_to_read(department, user_count) for department, user_count in rows]


@router.post("", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
) -> DepartmentRead:
    name = payload.name.strip()
    ensure_unique_department_name(db, name)

    department = Department(name=name, description=payload.description)
    db.add(department)
    db.flush()
    record_audit_log(
        db,
        current_user,
        "DEPARTMENT_CREATED",
        "Department",
        department.id,
        f"{current_user.full_name} created department {department.name}.",
    )
    db.commit()
    db.refresh(department)
    return department_to_read(department)


@router.put("/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    db: Session = Depends(get_db),
) -> DepartmentRead:
    department = db.get(Department, department_id)
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found.",
        )

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        ensure_unique_department_name(db, name, department_id)
        department.name = name
    if "description" in data:
        department.description = data["description"]

    record_audit_log(
        db,
        current_user,
        "DEPARTMENT_UPDATED",
        "Department",
        department.id,
        f"{current_user.full_name} updated department {department.name}.",
    )
    db.commit()
    db.refresh(department)
    user_count = (
        db.scalar(select(func.count(User.id)).where(User.department_id == department.id))
        or 0
    )
    return department_to_read(department, user_count)
