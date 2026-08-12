import re

from pydantic import BaseModel, EmailStr, field_validator

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    business_name: str
    gstin: str
    state: str = ""

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: str) -> str:
        v = v.upper().strip()
        if not GSTIN_PATTERN.match(v):
            raise ValueError(
                "GSTIN must be 15 characters in the standard format, e.g. 32AACCA1234F1Z5"
            )
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BusinessOut(BaseModel):
    id: str
    name: str
    gstin: str
    state: str
    scheme: str

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    business: BusinessOut | None = None

    class Config:
        from_attributes = True
