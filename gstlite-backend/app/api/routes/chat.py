from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, ChatMessage, Invoice
from app.schemas.gst import ChatMessageOut, ChatRequest
from app.services import ai_service

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _build_context(db: Session, business: Business, invoice_id: str | None) -> str:
    # 1. Specific invoice selected in UI
    if invoice_id:
        invoice = (
            db.query(Invoice)
            .filter(Invoice.id == invoice_id, Invoice.business_id == business.id)
            .first()
        )
        if invoice:
            lines = [
                f"Invoice {invoice.display_id} — {invoice.vendor_name or 'unknown vendor'} "
                f"({invoice.vendor_gstin or 'no GSTIN'})",
                f"Amount: ₹{invoice.amount:,.0f}" if invoice.amount else "Amount: unknown",
                f"Status: {getattr(invoice.status, 'value', invoice.status)}, Risk: {getattr(invoice.risk, 'value', invoice.risk)}",
            ]
            for issue in invoice.issues:
                severity = getattr(issue.severity, "value", issue.severity)
                lines.append(f"- [{severity}] {issue.title}: {issue.description} ({issue.rule_reference})")
            return "\n".join(lines)

    # 2. General Query Fallback: Fetch all recent business invoices from DB
    invoices = (
        db.query(Invoice)
        .filter(Invoice.business_id == business.id)
        .order_by(Invoice.created_at.desc())
        .limit(20)
        .all()
    )

    if not invoices:
        return ""

    lines = ["Available Business Invoices:"]
    for inv in invoices:
        status_val = getattr(inv.status, "value", inv.status)
        risk_val = getattr(inv.risk, "value", inv.risk)
        amt_str = f"₹{inv.amount:,.0f}" if inv.amount else "unknown"
        lines.append(
            f"- Invoice {inv.display_id}: Vendor={inv.vendor_name or 'Unknown'}, "
            f"GSTIN={inv.vendor_gstin or 'N/A'}, Amount={amt_str}, Status={status_val}, Risk={risk_val}"
        )

    return "\n".join(lines)


@router.get("/history", response_model=list[ChatMessageOut])
def get_history(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.business_id == business.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.post("/ask", response_model=ChatMessageOut)
def ask(
    payload: ChatRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    db.add(ChatMessage(business_id=business.id, role="user", content=payload.message))

    context = _build_context(db, business, payload.invoice_id)
    answer = ai_service.answer_question(payload.message, context)

    reply = ChatMessage(business_id=business.id, role="assistant", content=answer)
    db.add(reply)
    db.commit()
    db.refresh(reply)

    return reply