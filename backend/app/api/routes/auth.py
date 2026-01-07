from datetime import timedelta

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.core.security import get_password_hash
from app.core.security import verify_password
from app.db.session import get_db
from app.models.user import User
from app.models.user import UserRole
from app.schemas.auth import Token
from app.schemas.user import UserCreate
from app.schemas.user import UserPublic

router = APIRouter()
db_dependency = Depends(get_db)
oauth2_form_dependency = Depends()


@router.post("/register", response_model=UserPublic)
def register(payload: UserCreate, db: Session = db_dependency) -> User:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = UserRole.student
    if payload.role is not None:
        if payload.role == UserRole.teacher and not settings.allow_teacher_registration:
            raise HTTPException(status_code=403, detail="Teacher registration is disabled")
        role = payload.role

    user = User(
        email=payload.email,
        name=payload.name,
        role=role,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/token", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = oauth2_form_dependency,
    db: Session = db_dependency,
) -> Token:
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token({"sub": str(user.id)}, expires_delta=access_token_expires)
    return Token(access_token=access_token, token_type="bearer")
