import json
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, GstReturn, Invoice
from app.schemas.gst import GenerateReturnRequest, GstReturnOut, GstSummaryOut
from app.services import gst_calculator
from app.services.pdf_generator import generate_gst_summary_pdf

router = APIRouter(prefix="/api/gst", tags=["gst"])


def _matches_period(inv: Invoice, target_period: str) -> bool:
    if not target_period or target_period.lower() in ("all", ""):
        return True
    if inv.invoice_date:
        d = str(inv.invoice_date).strip()
        if d.startswith(target_period):
            return True
        parts = re.split(r"[-/\.]", d)
        if len(parts) == 3:
            if len(parts[2]) == 4 and f"{parts[2]}-{parts[1].zfill(2)}" == target_period:
                return True
            if len(parts[0]) == 4 and f"{parts[0]}-{parts[1].zfill(2)}" == target_period:
                return True
    if inv.created_at:
        return inv.created_at.strftime("%Y-%m") == target_period
    return False


@router.get("/periods")
def list_periods(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Returns available filing periods based on uploaded invoices and returns."""
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    periods = set()
    for inv in invoices:
        if inv.invoice_date:
            d = str(inv.invoice_date).strip()
            parts = re.split(r"[-/\.]", d)
            if len(parts) == 3:
                if len(parts[2]) == 4:
                    periods.add(f"{parts[2]}-{parts[1].zfill(2)}")
                elif len(parts[0]) == 4:
                    periods.add(f"{parts[0]}-{parts[1].zfill(2)}")
        if inv.created_at:
            periods.add(inv.created_at.strftime("%Y-%m"))

    periods.add("2026-08")
    periods.add("2026-07")
    periods.add("2026-06")

    sorted_periods = sorted(list(periods), reverse=True)
    return {
        "periods": sorted_periods,
        "default": sorted_periods[0] if sorted_periods else "2026-08",
    }


@router.get("/summary", response_model=GstSummaryOut)
def get_summary(
    period: str = "2026-08",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    if period and period.lower() != "all":
        active_invoices = [i for i in invoices if _matches_period(i, period)]
    else:
        active_invoices = invoices
    summary = gst_calculator.build_gst_summary(active_invoices, period)
    return summary


@router.get("/summary/export-pdf")
def export_summary_pdf(
    period: str = "2026-08",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Generates and downloads a formatted PDF report of the GST summary and ledger."""
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    if period and period.lower() != "all":
        active_invoices = [i for i in invoices if _matches_period(i, period)]
    else:
        active_invoices = invoices

    summary_data = gst_calculator.build_gst_summary(active_invoices, period)
    pdf_bytes = generate_gst_summary_pdf(business, period, summary_data, active_invoices)

    clean_filename = f"GST_Summary_{period}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/returns/generate", response_model=GstReturnOut, status_code=201)
def generate_return(
    payload: GenerateReturnRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()

    blocking = [i for i in invoices if i.status.value == "flagged"]
    if blocking:
        raise HTTPException(
            status_code=422,
            detail=f"{len(blocking)} invoice(s) are still flagged with high-risk compliance "
            "issues. Resolve them before generating the return, or proceed at your own risk "
            "via /api/gst/returns/generate?force=true.",
        )

    return_payload = gst_calculator.build_return_payload(invoices, payload.period, payload.return_type)
    summary = return_payload["summary"]

    gst_return = GstReturn(
        business_id=business.id,
        period=payload.period,
        return_type=payload.return_type,
        output_tax_liability=summary["output_tax_liability"],
        input_tax_credit=summary["input_tax_credit"],
        net_payable=summary["net_payable"],
        payload_json=json.dumps(return_payload),
    )
    db.add(gst_return)
    db.commit()
    db.refresh(gst_return)

    return GstReturnOut(
        id=gst_return.id,
        period=gst_return.period,
        return_type=gst_return.return_type,
        output_tax_liability=gst_return.output_tax_liability,
        input_tax_credit=gst_return.input_tax_credit,
        net_payable=gst_return.net_payable,
        is_filed=gst_return.is_filed,
        payload=return_payload,
    )


@router.post("/returns/{return_id}/file", response_model=GstReturnOut)
def file_return(
    return_id: str,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    gst_return = (
        db.query(GstReturn)
        .filter(GstReturn.id == return_id, GstReturn.business_id == business.id)
        .first()
    )
    if not gst_return:
        raise HTTPException(status_code=404, detail="Return not found")

    gst_return.is_filed = True
    db.commit()
    db.refresh(gst_return)

    return GstReturnOut(
        id=gst_return.id,
        period=gst_return.period,
        return_type=gst_return.return_type,
        output_tax_liability=gst_return.output_tax_liability,
        input_tax_credit=gst_return.input_tax_credit,
        net_payable=gst_return.net_payable,
        is_filed=gst_return.is_filed,
        payload=json.loads(gst_return.payload_json),
    )
