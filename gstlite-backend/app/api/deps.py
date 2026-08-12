from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.db.models import Business, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise credentials_error

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise credentials_error
    return user


def get_current_business(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Business:
    business = db.query(Business).filter(Business.owner_id == user.id).first()
    if not business:
        raise HTTPException(status_code=404, detail="No business profile found for this user")
    return business
