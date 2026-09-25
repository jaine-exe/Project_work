import os
from datetime import date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import SessionLocal, get_db
from app.db.models import (
    Business,
    ComplianceIssue,
    DocumentType,
    Invoice,
    InvoiceStatus,
    RiskLevel,
)
from app.schemas.invoice import InvoiceListOut, InvoiceOut
from app.services.ai_service import ManagerAgent
from app.utils.storage import save_upload

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


class InvoiceUpdateSchema(BaseModel):
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    invoice_date: Optional[str] = None
    taxable_amount: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    igst_amount: Optional[float] = None
    total_tax: Optional[float] = None
    total_amount: Optional[float] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    hsn_code: Optional[str] = None
    document_type: Optional[DocumentType] = None


def _next_display_id(db: Session, business_id: str) -> str:
    count = db.query(Invoice).filter(Invoice.business_id == business_id).count()
    return f"INV-{date.today().year}-{count + 1:04d}"


def _process_invoice_background(invoice_id: str, business_id: str):
    """
    Runs OCR -> Validation -> Compliance -> Risk Scoring pipeline.
    Uses its own DB session since it outlives the request.
    """
    db = SessionLocal()
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return

        business = db.query(Business).filter(Business.id == business_id).first()

        try:
            # Query existing vendor GSTINs dynamically and extract safely from rows/tuples
            known_rows = (
                db.query(Invoice.vendor_gstin)
                .filter(
                    Invoice.business_id == business_id,
                    Invoice.vendor_gstin.isnot(None),
                )
                .all()
            )

            known_2b_gstins = set()
            for row in known_rows:
                gstin_val = (
                    row[0]
                    if isinstance(row, (tuple, list))
                    else getattr(row, "vendor_gstin", row)
                )
                if gstin_val:
                    known_2b_gstins.add(gstin_val)

            # Run Multi-Agent Manager pipeline directly
            manager = ManagerAgent()
            result = manager.process_invoice(invoice.file_path, known_2b_gstins, business=business)

            # Assign extracted fields safely using getattr
            invoice.invoice_number = getattr(result, "invoice_number", None)
            invoice.vendor_name = getattr(result, "vendor_name", None)
            invoice.vendor_gstin = getattr(result, "vendor_gstin", None)
            invoice.buyer_name = getattr(result, "buyer_name", None)
            invoice.buyer_gstin = getattr(result, "buyer_gstin", None)
            invoice.invoice_date = getattr(result, "invoice_date", None)
            invoice.taxable_amount = getattr(result, "taxable_amount", None)
            invoice.cgst_amount = getattr(result, "cgst_amount", None)
            invoice.sgst_amount = getattr(result, "sgst_amount", None)
            invoice.igst_amount = getattr(result, "igst_amount", None)
            invoice.total_tax = getattr(result, "total_tax", None)
            invoice.total_amount = getattr(result, "total_amount", None)
            invoice.amount = getattr(result, "amount", None) or getattr(result, "total_amount", None)
            invoice.tax_rate = getattr(result, "tax_rate", None)
            invoice.hsn_code = getattr(result, "hsn_code", None)

            # Map status and risk levels safely
            status_val = getattr(result, "status", "validated")
            risk_val = getattr(result, "risk", "low")

            if status_val:
                invoice.status = InvoiceStatus(status_val)
            if risk_val:
                invoice.risk = RiskLevel(risk_val)

            invoice.compliance_score = getattr(result, "compliance_score", 100)

            # Store findings/compliance issues
            findings_list = getattr(result, "findings", [])
            for finding in findings_list:
                db.add(
                    ComplianceIssue(
                        invoice_id=invoice.id,
                        title=getattr(finding, "title", str(finding)),
                        severity=getattr(finding, "severity", "low"),
                        description=getattr(finding, "description", ""),
                        suggestion=getattr(finding, "suggestion", ""),
                        rule_reference=getattr(finding, "rule_reference", ""),
                    )
                )

            db.commit()
            print(f"[SUCCESS] Processed invoice {invoice_id} | Score: {invoice.compliance_score}")

        except Exception as exc:
            print(f"[PIPELINE ERROR] Failed processing invoice {invoice_id}: {exc}")
            invoice.status = InvoiceStatus.failed
            invoice.processing_error = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("", response_model=InvoiceOut, status_code=201)
def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    document_type: DocumentType = Form(DocumentType.purchase),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Uploads a sales or purchase invoice and initiates background extraction/validation."""
    try:
        file_path = save_upload(file, business.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    invoice = Invoice(
        business_id=business.id,
        display_id=_next_display_id(db, business.id),
        file_path=file_path,
        original_filename=file.filename or "invoice",
        document_type=document_type,
        status=InvoiceStatus.uploaded,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    background_tasks.add_task(_process_invoice_background, invoice.id, business.id)

    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceOut)
def update_and_revalidate_invoice(
    invoice_id: str,
    update_data: InvoiceUpdateSchema,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """
    User Review Step: Allows the user to manually correct invoice fields 
    and updates the invoice status to validated.
    """
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.business_id == business.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)

    # Sync total_amount and amount
    if update_data.total_amount is not None:
        invoice.amount = update_data.total_amount
    elif update_data.amount is not None:
        invoice.total_amount = update_data.amount

    # Clear old issues
    db.query(ComplianceIssue).filter(ComplianceIssue.invoice_id == invoice.id).delete()

    # Re-evaluate compliance based on user edits
    from app.services.compliance_engine import run_all_checks
    parsed_dict = {
        "invoice_number": invoice.invoice_number,
        "vendor_name": invoice.vendor_name,
        "vendor_gstin": invoice.vendor_gstin,
        "buyer_name": invoice.buyer_name,
        "buyer_gstin": invoice.buyer_gstin,
        "invoice_date": invoice.invoice_date,
        "amount": invoice.amount or invoice.total_amount,
        "taxable_amount": invoice.taxable_amount,
        "cgst": invoice.cgst_amount,
        "sgst": invoice.sgst_amount,
        "tax_rate": invoice.tax_rate,
        "hsn_code": invoice.hsn_code,
    }

    compliance_res = run_all_checks(parsed_dict, business=business)
    invoice.status = InvoiceStatus(compliance_res.get("status", "validated"))
    invoice.risk = RiskLevel(compliance_res.get("risk", "low"))
    invoice.compliance_score = compliance_res.get("compliance_score", 100)

    for finding in compliance_res.get("findings", []):
        db.add(
            ComplianceIssue(
                invoice_id=invoice.id,
                title=getattr(finding, "title", str(finding)),
                severity=getattr(finding, "severity", "low"),
                description=getattr(finding, "description", ""),
                suggestion=getattr(finding, "suggestion", ""),
                rule_reference=getattr(finding, "rule_reference", ""),
            )
        )

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("", response_model=InvoiceListOut)
def list_invoices(
    period: Optional[str] = None,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = (
        db.query(Invoice)
        .filter(Invoice.business_id == business.id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    if period and period.lower() != "all":
        from app.api.routes.gst import _matches_period
        period_invoices = [i for i in invoices if _matches_period(i, period)]
        return InvoiceListOut(invoices=period_invoices, total=len(period_invoices))

    return InvoiceListOut(invoices=invoices, total=len(invoices))


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: str,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.business_id == business.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/{invoice_id}/file")
def get_invoice_file(
    invoice_id: str,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Streams the raw uploaded invoice PDF or image file for in-browser review."""
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.business_id == business.id)
        .first()
    )
    if not invoice or not invoice.file_path or not os.path.exists(invoice.file_path):
        raise HTTPException(status_code=404, detail="Invoice file not found")

    mime_type = "application/pdf"
    lower_path = invoice.file_path.lower()
    if lower_path.endswith(".png"):
        mime_type = "image/png"
    elif lower_path.endswith((".jpg", ".jpeg")):
        mime_type = "image/jpeg"
    elif lower_path.endswith(".xml"):
        mime_type = "application/xml"

    return FileResponse(
        path=invoice.file_path,
        media_type=mime_type,
        filename=invoice.original_filename,
    )