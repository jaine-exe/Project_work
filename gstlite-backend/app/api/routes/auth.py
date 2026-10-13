from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import Business, User
from app.schemas.auth import (
    BusinessOut,
    DemoAccountOut,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SwitchBusinessRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    if db.query(Business).filter(Business.gstin == payload.gstin).first():
        raise HTTPException(status_code=400, detail="This GSTIN is already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.flush()  # assigns user.id without committing yet

    business = Business(
        owner_id=user.id,
        name=payload.business_name,
        gstin=payload.gstin,
        state=payload.state,
    )
    db.add(business)
    db.commit()

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses `username` for the identifier field — we treat it as email
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/login-json", response_model=TokenResponse)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    """JSON-body login alternative for frontends that don't want to use form-encoding."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/demo-accounts", response_model=list[DemoAccountOut])
def get_demo_accounts():
    """Returns curated demo profiles with credentials for instant testing."""
    accounts = [
        DemoAccountOut(
            email="jaine@test.com",
            password="password123",
            name="Jaine Thomas",
            business_name="Ashoka Textiles Pvt. Ltd.",
            gstin="32AACCA1234F1Z5",
            state="Kerala",
            role_description="Textile Manufacturing & Retail (Regular Scheme)",
        ),
        DemoAccountOut(
            email="alan@example.com",
            password="password123",
            name="Alan Test",
            business_name="Alan Enterprises Pvt Ltd",
            gstin="32AAECS1234F1Z5",
            state="Kerala",
            role_description="Engineering Hardware & Distribution",
        ),
    ]
    return accounts


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Resets user password in SQLite database."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this email address")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully. You can now log in with your new password."}


@router.get("/businesses", response_model=list[BusinessOut])
def list_available_businesses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists businesses available in the system for multi-tenant switching."""
    businesses = db.query(Business).all()
    return businesses


@router.post("/switch-business")
def switch_active_business(
    payload: SwitchBusinessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Switches the user's active business context to another registered entity."""
    target = db.query(Business).filter(Business.id == payload.business_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Business not found")

    # Re-assign or link target business to current user
    target.owner_id = current_user.id
    db.commit()
    db.refresh(target)

    return {
        "message": f"Switched active business to {target.name}",
        "business": {
            "id": target.id,
            "name": target.name,
            "gstin": target.gstin,
            "state": target.state,
            "scheme": target.scheme,
        },
    }
