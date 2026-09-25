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

    # 3. GSTR-2B Reconciliation Context
    try:
        from app.services.gstr2b_reconciler import get_reconciliation_report
        rec = get_reconciliation_report(db, business.id, "2026-07")
        if rec and rec["summary"].get("has_2b_data"):
            s = rec["summary"]
            lines.append("\nGSTR-2B Reconciliation Status (Period 2026-07):")
            lines.append(f"- Matched Invoices: {s['matched_count']} (Eligible ITC: ₹{s['matched_itc']:,.0f})")
            lines.append(f"- Missing in 2B (Blocked under Rule 36(4)): {s['missing_in_2b_count']} (Blocked ITC: ₹{s['missing_in_2b_itc']:,.0f})")
            lines.append(f"- Value Mismatches: {s['mismatched_count']}")
            lines.append(f"- Unclaimed in Books: {s['missing_in_books_count']} (Available ITC: ₹{s['missing_in_books_itc']:,.0f})")
            lines.append(f"- Overall 2B Match Rate: {s['reconciliation_rate']}%")
    except Exception:
        pass

    return "\n".join(lines)


@router.get("/history", response_model=list[ChatMessageOut])
def get_history(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.business_id == business.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.delete("/history")
def clear_history(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.business_id == business.id).delete()
    db.commit()
    return {"message": "Chat history cleared"}


@router.post("/ask", response_model=ChatMessageOut)
def ask(
    payload: ChatRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    # Fetch recent conversation history for multi-turn chat
    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.business_id == business.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(recent)]

    db.add(ChatMessage(business_id=business.id, role="user", content=payload.message))

    context = _build_context(db, business, payload.invoice_id)
    answer = ai_service.answer_question(payload.message, context, history=history)

    reply = ChatMessage(business_id=business.id, role="assistant", content=answer)
    db.add(reply)
    db.commit()
    db.refresh(reply)

    return reply