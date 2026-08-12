from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, ComplianceIssue, Invoice
from app.schemas.invoice import ComplianceIssueOut

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("/issues", response_model=list[ComplianceIssueOut])
def list_compliance_issues(
    severity: str | None = None,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = (
        db.query(ComplianceIssue)
        .join(Invoice)
        .filter(Invoice.business_id == business.id)
        .options(joinedload(ComplianceIssue.invoice))
    )
    if severity and severity != "all":
        query = query.filter(ComplianceIssue.severity == severity)

    return query.order_by(ComplianceIssue.created_at.desc()).all()


@router.get("/readiness")
def filing_readiness(
    business: Business = Depends(get_current_business), db: Session = Depends(get_db)
):
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    if not invoices:
        return {"score": 100, "label": "No invoices yet", "high_risk_count": 0}

    high_risk = len([i for i in invoices if i.risk.value == "high"])
    medium_risk = len([i for i in invoices if i.risk.value == "medium"])
    unresolved = len([i for i in invoices if i.status.value in ("uploaded", "parsed")])

    score = 100 - (high_risk * 15) - (medium_risk * 6) - (unresolved * 4)
    score = max(0, min(100, score))

    label = "Ready to file" if score >= 90 else "Mostly ready" if score >= 60 else "Needs attention"

    return {"score": score, "label": label, "high_risk_count": high_risk}
