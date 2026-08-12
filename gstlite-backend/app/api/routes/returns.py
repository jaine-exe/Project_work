from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business
from app.services.return_service import generate_gstr1_payload, generate_gstr3b_payload

router = APIRouter(prefix="/api/returns", tags=["returns"])


@router.get("/gstr1")
def get_gstr1_return(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """Generates official portal-ready GSTR-1 JSON export."""
    return generate_gstr1_payload(db, business.id)


@router.get("/gstr3b")
def get_gstr3b_return(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    """Generates GSTR-3B summary numbers and net tax liability."""
    return generate_gstr3b_payload(db, business.id)