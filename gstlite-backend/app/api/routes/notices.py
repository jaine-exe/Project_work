from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, GstNotice, Invoice, SalesInvoice
from app.services import ai_service

router = APIRouter(prefix="/api/notices", tags=["notices"])


class CreateNoticeRequest(BaseModel):
    notice_number: str
    form_type: str = "ASMT-10"  # "ASMT-10", "DRC-01", "DRC-07", "SCN"
    issue_date: str  # YYYY-MM-DD
    due_date: str  # YYYY-MM-DD
    financial_year: str = "2025-26"
    section_referred: str = "Section 61"
    tax_demand: float = 0.0
    penalty_demand: float = 0.0
    issuing_officer: Optional[str] = None
    description: str


class DraftReplyRequest(BaseModel):
    additional_facts: Optional[str] = None


@router.get("/")
def list_notices(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    notices = (
        db.query(GstNotice)
        .filter(GstNotice.business_id == business.id)
        .order_by(GstNotice.created_at.desc())
        .all()
    )

    result = []
    today = date.today()
    for n in notices:
        days_left = None
        try:
            due_dt = datetime.strptime(n.due_date, "%Y-%m-%d").date()
            days_left = (due_dt - today).days
        except Exception:
            pass

        result.append({
            "id": n.id,
            "notice_number": n.notice_number,
            "form_type": n.form_type,
            "issue_date": n.issue_date,
            "due_date": n.due_date,
            "financial_year": n.financial_year,
            "section_referred": n.section_referred,
            "tax_demand": n.tax_demand,
            "penalty_demand": n.penalty_demand,
            "total_demand": n.tax_demand + n.penalty_demand,
            "issuing_officer": n.issuing_officer,
            "description": n.description,
            "status": n.status,
            "reply_draft": n.reply_draft,
            "reply_submitted_at": n.reply_submitted_at.isoformat() if n.reply_submitted_at else None,
            "days_left": days_left,
            "is_urgent": days_left is not None and days_left <= 7,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return {"notices": result, "count": len(result)}


@router.post("/")
def create_notice(
    payload: CreateNoticeRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    notice = GstNotice(
        business_id=business.id,
        notice_number=payload.notice_number,
        form_type=payload.form_type,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        financial_year=payload.financial_year,
        section_referred=payload.section_referred,
        tax_demand=payload.tax_demand,
        penalty_demand=payload.penalty_demand,
        issuing_officer=payload.issuing_officer,
        description=payload.description,
        status="pending",
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return {"message": "Tax notice logged successfully.", "id": notice.id}


@router.post("/{notice_id}/draft-reply")
def draft_notice_reply(
    notice_id: str,
    payload: DraftReplyRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    notice = (
        db.query(GstNotice)
        .filter(GstNotice.id == notice_id, GstNotice.business_id == business.id)
        .first()
    )
    if not notice:
        raise HTTPException(status_code=404, detail="Notice record not found.")

    prompt = (
        f"You are a Senior Indian GST Advocate and Tax Counsel. Draft an official, formal legal reply to a GST Notice.\n\n"
        f"Notice Details:\n"
        f"- Notice Number: {notice.notice_number}\n"
        f"- Notice Form: {notice.form_type}\n"
        f"- Section Cited: {notice.section_referred}\n"
        f"- Tax Demand: INR {notice.tax_demand:,.2f}, Penalty: INR {notice.penalty_demand:,.2f}\n"
        f"- Financial Year: {notice.financial_year}\n"
        f"- Issuing Authority: {notice.issuing_officer or 'Proper Officer, State/Central GST'}\n"
        f"- Department Allegation: {notice.description}\n"
        f"- Taxpayer Name: {business.name}\n"
        f"- Taxpayer GSTIN: {business.gstin}\n"
        f"- Additional Taxpayer Submissions: {payload.additional_facts or 'All outward and inward supplies are duly supported by tax invoices and GSTR-2B reconciliations.'}\n\n"
        f"Draft the formal response letter with:\n"
        f"1. Proper formal salutation and subject header.\n"
        f"2. Preliminary objections and factual background.\n"
        f"3. Point-by-point rebuttal citing CGST Act 2017 sections, relevant CBIC circulars, and Supreme Court/High Court GST rulings.\n"
        f"4. Prayer/Request to drop proceedings without penalty under Section 73/74.\n"
        f"Keep the tone respectful, legally rigorous, and well-structured."
    )

    try:
        reply_text = ai_service.answer_question(prompt, context=f"Taxpayer GSTIN: {business.gstin}, Business: {business.name}")
    except Exception:
        reply_text = (
            f"To,\n"
            f"The Proper Officer, GST Ward / Division,\n\n"
            f"Subject: Reply to Notice No. {notice.notice_number} in Form {notice.form_type} for FY {notice.financial_year}\n"
            f"Reference: GSTIN {business.gstin} — M/s {business.name}\n\n"
            f"Respected Sir/Madam,\n\n"
            f"With reference to the notice cited above regarding the alleged discrepancy of ₹{notice.tax_demand:,.2f} under {notice.section_referred}, "
            f"we respectfully submit as follows:\n\n"
            f"1. All purchases and corresponding Input Tax Credit claimed strictly adhere to the conditions laid out in Section 16 of the CGST Act, 2017.\n"
            f"2. The discrepancies highlighted in the GSTR-2A vs GSTR-3B comparison stand fully clarified as per CBIC Circular No. 183/15/2022-GST.\n"
            f"3. The tax on all outward supplies has been correctly discharged in monthly GSTR-3B filings with zero suppression of facts.\n\n"
            f"In view of the above submissions, we pray that the proposed demand of tax and penalty may kindly be dropped and the proceedings closed.\n\n"
            f"Yours faithfully,\n"
            f"For {business.name}\n"
            f"Authorized Signatory"
        )

    notice.reply_draft = reply_text
    notice.status = "drafted"
    db.commit()
    db.refresh(notice)

    return {
        "message": "Legal reply drafted successfully.",
        "reply_draft": reply_text,
        "status": notice.status,
    }


# ----------------------------------------------------
# Advance Tax Outflow Forecast Endpoint
# ----------------------------------------------------
@router.get("/forecast")
def get_tax_forecast(
    period: Optional[str] = None,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """
    Predicts advance GST liability 10 days before the monthly 20th deadline,
    enabling MSMEs to manage working capital.
    """
    today = date.today()
    # Next 20th of the month
    if today.day <= 20:
        due_date = date(today.year, today.month, 20)
    else:
        # Next month
        next_month = today.month + 1 if today.month < 12 else 1
        next_year = today.year if today.month < 12 else today.year + 1
        due_date = date(next_year, next_month, 20)

    days_to_due = (due_date - today).days

    # Calculate output tax from sales invoices
    sales_invoices = db.query(SalesInvoice).filter(SalesInvoice.business_id == business.id).all()
    projected_output_tax = sum(float(s.total_tax) for s in sales_invoices)
    total_sales_turnover = sum(float(s.total_amount) for s in sales_invoices)

    # Calculate available ITC from purchase invoices
    purchase_invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    available_itc = 0.0
    blocked_itc = 0.0
    for p in purchase_invoices:
        tax = float(p.total_tax or 0.0)
        has_blocked_flag = any(
            "Section 17(5)" in iss.title or "Ineligible" in iss.title
            for iss in p.issues
        )
        if has_blocked_flag:
            blocked_itc += tax
        else:
            available_itc += tax

    net_cash_liability = max(0.0, projected_output_tax - available_itc)
    itc_surplus = max(0.0, available_itc - projected_output_tax)

    # Health status & recommendation
    if net_cash_liability == 0.0:
        status_label = "Surplus ITC Buffer"
        recommendation = (
            f"You have an ITC surplus buffer of ₹{itc_surplus:,.2f}. "
            "Zero cash outflow is required for the upcoming return."
        )
    elif days_to_due <= 5:
        status_label = "Urgent: Cash Outflow Required"
        recommendation = (
            f"Ensure ₹{net_cash_liability:,.2f} is deposited into your Electronic Cash Ledger "
            f"before {due_date.strftime('%d %b %Y')} to avoid late fee and 18% interest under Section 50."
        )
    else:
        status_label = "Estimated Net Liability"
        recommendation = (
            f"Projected cash tax liability is ₹{net_cash_liability:,.2f}. "
            f"You have {days_to_due} days to arrange working capital before the statutory due date."
        )

    return {
        "due_date": due_date.strftime("%d %b %Y"),
        "days_remaining": days_to_due,
        "projected_output_tax": round(projected_output_tax, 2),
        "total_sales_turnover": round(total_sales_turnover, 2),
        "available_itc": round(available_itc, 2),
        "blocked_itc": round(blocked_itc, 2),
        "net_cash_payable": round(net_cash_liability, 2),
        "itc_surplus_carried_forward": round(itc_surplus, 2),
        "status_label": status_label,
        "recommendation": recommendation,
    }

