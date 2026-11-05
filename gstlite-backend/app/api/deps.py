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
    # 1. If user explicitly selected an active business
    if getattr(user, "active_business_id", None):
        biz = db.query(Business).filter(Business.id == user.active_business_id).first()
        if biz:
            return biz

    # 2. Check direct ownership
    biz = db.query(Business).filter(Business.owner_id == user.id).first()
    if biz:
        user.active_business_id = biz.id
        db.commit()
        return biz

    # 3. Email-based mapping for demo / known accounts
    email = (user.email or "").lower()
    if "alan" in email:
        biz = db.query(Business).filter(Business.name.ilike("%Alan%")).first()
    elif "kavita" in email:
        biz = db.query(Business).filter(Business.name.ilike("%Kavita%")).first()
    elif "jaine" in email:
        biz = db.query(Business).filter(Business.name.ilike("%Alan%")).first()
        if not biz:
            biz = db.query(Business).filter(Business.name.ilike("%Ashoka%")).first()

    if biz:
        user.active_business_id = biz.id
        db.commit()
        return biz

    # 4. Fallback to any business in system
    biz = db.query(Business).first()
    if biz:
        user.active_business_id = biz.id
        db.commit()
        return biz

    # 5. Create default business if DB has none
    new_biz = Business(
        owner_id=user.id,
        name=f"{user.full_name or 'My'} Enterprises",
        gstin="32AAECS1234F1Z5",
        state="Kerala",
        scheme="Regular",
    )
    db.add(new_biz)
    db.commit()
    db.refresh(new_biz)
    user.active_business_id = new_biz.id
    db.commit()
    return new_biz
