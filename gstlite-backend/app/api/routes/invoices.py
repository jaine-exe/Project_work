from datetime import date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
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
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    invoice_date: Optional[str] = None
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
            result = manager.process_invoice(invoice.file_path, known_2b_gstins)

            # Assign extracted fields safely using getattr
            invoice.vendor_name = getattr(result, "vendor_name", None)
            invoice.vendor_gstin = getattr(result, "vendor_gstin", None)
            invoice.invoice_date = getattr(result, "invoice_date", None)
            invoice.amount = getattr(result, "amount", None)
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

    # Clear old issues on manual review approval
    db.query(ComplianceIssue).filter(ComplianceIssue.invoice_id == invoice.id).delete()

    invoice.status = InvoiceStatus.validated
    invoice.risk = RiskLevel.low
    invoice.compliance_score = 100

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("", response_model=InvoiceListOut)
def list_invoices(
    business: Business = Depends(get_current_business), db: Session = Depends(get_db)
):
    invoices = (
        db.query(Invoice)
        .filter(Invoice.business_id == business.id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
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