import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, GstReturn, Invoice
from app.schemas.gst import GenerateReturnRequest, GstReturnOut, GstSummaryOut
from app.services import gst_calculator

router = APIRouter(prefix="/api/gst", tags=["gst"])


@router.get("/summary", response_model=GstSummaryOut)
def get_summary(
    period: str = "2026-07",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    summary = gst_calculator.build_gst_summary(invoices, period)
    return summary


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
