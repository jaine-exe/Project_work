from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
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


@router.post("/gstr2b/upload")
async def upload_gstr2b_json(
    file: UploadFile,
    period: str = Form("2026-07"),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Parses and ingests an official GST Portal GSTR-2B JSON file."""
    from app.services.gstr2b_reconciler import parse_and_save_gstr2b

    try:
        content = await file.read()
        json_str = content.decode("utf-8")
        result = parse_and_save_gstr2b(db, business.id, json_str, default_period=period)
        return {
            "status": "success",
            "message": f"Successfully ingested {result['imported_count']} GSTR-2B records.",
            "imported_count": result["imported_count"],
            "period": result["period"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse GSTR-2B JSON: {str(e)}")


@router.post("/gstr2b/demo")
def seed_demo_gstr2b(
    period: str = Form("2026-07"),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Generates realistic GSTR-2B test data for immediate demonstration."""
    from app.services.gstr2b_reconciler import generate_demo_gstr2b_data

    count = generate_demo_gstr2b_data(db, business.id, period=period)
    return {
        "status": "success",
        "message": f"Generated {count} GSTR-2B sample entries for period {period}.",
        "imported_count": count,
        "period": period,
    }


@router.get("/gstr2b/reconciliation")
def get_gstr2b_reconciliation(
    period: str = "2026-07",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Returns cross-reconciliation between uploaded purchase invoices and GSTR-2B."""
    from app.services.gstr2b_reconciler import get_reconciliation_report

    return get_reconciliation_report(db, business.id, period=period)
