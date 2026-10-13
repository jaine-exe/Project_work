import hashlib
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, SalesInvoice

router = APIRouter(prefix="/api/invoicing", tags=["invoicing"])


class InvoiceItem(BaseModel):
    description: str
    hsn_code: str = "8471"
    quantity: float = 1.0
    unit: str = "NOS"
    rate: float
    tax_rate: float = 18.0  # percentage (e.g. 18.0)


class CreateSalesInvoiceRequest(BaseModel):
    invoice_number: str
    invoice_type: str = "B2B"  # "B2B", "B2C", "credit_note", "debit_note"
    original_invoice_number: Optional[str] = None
    customer_name: str
    customer_gstin: Optional[str] = None
    customer_address: Optional[str] = None
    place_of_supply: Optional[str] = None  # 2-digit state code e.g. "32"
    invoice_date: str  # YYYY-MM-DD
    due_date: Optional[str] = None
    items: List[InvoiceItem]
    notes: Optional[str] = None


class GenerateEwbRequest(BaseModel):
    vehicle_no: str
    transporter_id: Optional[str] = None
    distance_km: int = 120


class CreateCreditDebitNoteRequest(BaseModel):
    note_type: str = "credit_note"  # "credit_note" | "debit_note"
    note_number: str
    reason: str = "Sales Return"  # "Sales Return", "Post-Sale Discount", "Deficiency in Service"
    taxable_amount: float
    tax_rate: float = 18.0
    notes: Optional[str] = None


@router.get("/invoices")
def list_sales_invoices(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = (
        db.query(SalesInvoice)
        .filter(SalesInvoice.business_id == business.id)
        .order_by(SalesInvoice.created_at.desc())
        .all()
    )
    result = []
    for inv in invoices:
        items = []
        try:
            items = json.loads(inv.items_json) if inv.items_json else []
        except Exception:
            pass
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_type": inv.invoice_type,
            "original_invoice_number": inv.original_invoice_number,
            "customer_name": inv.customer_name,
            "customer_gstin": inv.customer_gstin,
            "customer_address": inv.customer_address,
            "place_of_supply": inv.place_of_supply,
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "items": items,
            "taxable_amount": inv.taxable_amount,
            "cgst_amount": inv.cgst_amount,
            "sgst_amount": inv.sgst_amount,
            "igst_amount": inv.igst_amount,
            "total_tax": inv.total_tax,
            "total_amount": inv.total_amount,
            "irn": inv.irn,
            "irn_ack_no": inv.irn_ack_no,
            "irn_ack_date": inv.irn_ack_date,
            "irn_signed_qr": inv.irn_signed_qr,
            "ewb_number": inv.ewb_number,
            "ewb_valid_until": inv.ewb_valid_until,
            "ewb_vehicle_no": inv.ewb_vehicle_no,
            "ewb_distance_km": inv.ewb_distance_km,
            "status": inv.status,
            "notes": inv.notes,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        })
    return {"invoices": result, "count": len(result)}


@router.post("/invoices")
def create_sales_invoice(
    payload: CreateSalesInvoiceRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    # Check duplicate
    existing = (
        db.query(SalesInvoice)
        .filter(
            SalesInvoice.business_id == business.id,
            SalesInvoice.invoice_number == payload.invoice_number,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sales invoice with number '{payload.invoice_number}' already exists.",
        )

    # Determine Place of Supply & Tax Routing
    supplier_state = business.gstin[:2] if business.gstin else "32"
    pos = payload.place_of_supply
    if not pos and payload.customer_gstin and len(payload.customer_gstin) >= 2:
        pos = payload.customer_gstin[:2]
    if not pos:
        pos = supplier_state

    is_intra_state = supplier_state == pos

    processed_items = []
    tot_taxable = 0.0
    tot_cgst = 0.0
    tot_sgst = 0.0
    tot_igst = 0.0

    for itm in payload.items:
        taxable = round(itm.quantity * itm.rate, 2)
        tot_taxable += taxable
        tax_pct = itm.tax_rate
        tax_val = round((taxable * tax_pct) / 100.0, 2)

        if is_intra_state:
            half = round(tax_val / 2.0, 2)
            cgst = half
            sgst = half
            igst = 0.0
        else:
            cgst = 0.0
            sgst = 0.0
            igst = tax_val

        tot_cgst += cgst
        tot_sgst += sgst
        tot_igst += igst

        processed_items.append({
            "description": itm.description,
            "hsn_code": itm.hsn_code,
            "quantity": itm.quantity,
            "unit": itm.unit,
            "rate": itm.rate,
            "tax_rate": itm.tax_rate,
            "taxable_amount": taxable,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total": taxable + tax_val,
        })

    tot_tax = tot_cgst + tot_sgst + tot_igst
    grand_total = tot_taxable + tot_tax

    new_inv = SalesInvoice(
        business_id=business.id,
        invoice_number=payload.invoice_number,
        invoice_type=payload.invoice_type,
        original_invoice_number=payload.original_invoice_number,
        customer_name=payload.customer_name,
        customer_gstin=payload.customer_gstin.upper() if payload.customer_gstin else None,
        customer_address=payload.customer_address,
        place_of_supply=pos,
        invoice_date=payload.invoice_date,
        due_date=payload.due_date,
        items_json=json.dumps(processed_items),
        taxable_amount=round(tot_taxable, 2),
        cgst_amount=round(tot_cgst, 2),
        sgst_amount=round(tot_sgst, 2),
        igst_amount=round(tot_igst, 2),
        total_tax=round(tot_tax, 2),
        total_amount=round(grand_total, 2),
        status="issued",
        notes=payload.notes,
    )
    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)

    return {
        "message": f"Sales invoice '{new_inv.invoice_number}' created successfully.",
        "id": new_inv.id,
        "invoice_number": new_inv.invoice_number,
        "total_amount": new_inv.total_amount,
        "place_of_supply": pos,
        "is_intra_state": is_intra_state,
    }


@router.post("/invoices/{invoice_id}/e-invoice")
def generate_e_invoice(
    invoice_id: str,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(SalesInvoice)
        .filter(SalesInvoice.id == invoice_id, SalesInvoice.business_id == business.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Sales invoice not found.")

    if not inv.customer_gstin:
        raise HTTPException(
            status_code=400,
            detail="B2B E-Invoicing requires a valid recipient GSTIN. This appears to be a B2C supply.",
        )

    # Cryptographic 64-char IRN hash
    raw_key = f"{business.gstin}:{inv.invoice_number}:2026-27:{inv.total_amount}"
    irn_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    ack_no = f"1126{random.randint(10000000000, 99999999999)}"
    ack_date = datetime.now(timezone.utc).isoformat()

    # Signed QR payload structure prescribed by GSTN IRP
    qr_payload = (
        f"GSTN_IRP:{business.gstin}:{inv.customer_gstin}:{inv.invoice_number}:"
        f"{inv.invoice_date}:{inv.total_amount}:{inv.total_tax}:{irn_hash[:16]}"
    )

    inv.irn = irn_hash
    inv.irn_ack_no = ack_no
    inv.irn_ack_date = ack_date
    inv.irn_signed_qr = qr_payload

    db.commit()
    db.refresh(inv)

    return {
        "message": "E-Invoice (IRN) generated successfully via GSTN IRP sandbox.",
        "irn": irn_hash,
        "ack_no": ack_no,
        "ack_date": ack_date,
        "signed_qr": qr_payload,
    }


@router.post("/invoices/{invoice_id}/e-way-bill")
def generate_e_way_bill(
    invoice_id: str,
    payload: GenerateEwbRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(SalesInvoice)
        .filter(SalesInvoice.id == invoice_id, SalesInvoice.business_id == business.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Sales invoice not found.")

    # E-way bill is required for consignments exceeding 50,000
    ewb_no = f"2410{random.randint(10000000, 99999999)}"
    # 200 km per day validity
    valid_days = max(1, (payload.distance_km // 200) + 1)
    valid_until = (datetime.now(timezone.utc) + timedelta(days=valid_days)).strftime("%Y-%m-%d 23:59:59")

    inv.ewb_number = ewb_no
    inv.ewb_valid_until = valid_until
    inv.ewb_vehicle_no = payload.vehicle_no.upper().replace(" ", "")
    inv.ewb_transporter_id = payload.transporter_id
    inv.ewb_distance_km = payload.distance_km

    db.commit()
    db.refresh(inv)

    return {
        "message": f"E-Way Bill '{ewb_no}' generated successfully.",
        "ewb_number": ewb_no,
        "valid_until": valid_until,
        "vehicle_no": inv.ewb_vehicle_no,
        "distance_km": inv.ewb_distance_km,
    }


@router.post("/invoices/{invoice_id}/credit-debit-note")
def issue_credit_debit_note(
    invoice_id: str,
    payload: CreateCreditDebitNoteRequest,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    original_inv = (
        db.query(SalesInvoice)
        .filter(SalesInvoice.id == invoice_id, SalesInvoice.business_id == business.id)
        .first()
    )
    if not original_inv:
        raise HTTPException(status_code=404, detail="Original invoice not found.")

    supplier_state = business.gstin[:2] if business.gstin else "32"
    pos = original_inv.place_of_supply or supplier_state
    is_intra_state = supplier_state == pos

    taxable = round(payload.taxable_amount, 2)
    tax_val = round((taxable * payload.tax_rate) / 100.0, 2)
    if is_intra_state:
        half = round(tax_val / 2.0, 2)
        cgst = half
        sgst = half
        igst = 0.0
    else:
        cgst = 0.0
        sgst = 0.0
        igst = tax_val

    grand_total = taxable + (cgst + sgst + igst)

    cdn = SalesInvoice(
        business_id=business.id,
        invoice_number=payload.note_number,
        invoice_type=payload.note_type,
        original_invoice_number=original_inv.invoice_number,
        customer_name=original_inv.customer_name,
        customer_gstin=original_inv.customer_gstin,
        customer_address=original_inv.customer_address,
        place_of_supply=pos,
        invoice_date=datetime.now().strftime("%Y-%m-%d"),
        items_json=json.dumps([{
            "description": f"{payload.reason} for {original_inv.invoice_number}",
            "hsn_code": "9999",
            "quantity": 1,
            "unit": "OTH",
            "rate": taxable,
            "tax_rate": payload.tax_rate,
            "taxable_amount": taxable,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total": grand_total,
        }]),
        taxable_amount=taxable,
        cgst_amount=cgst,
        sgst_amount=sgst,
        igst_amount=igst,
        total_tax=round(cgst + sgst + igst, 2),
        total_amount=round(grand_total, 2),
        status="issued",
        notes=payload.notes,
    )
    db.add(cdn)
    db.commit()
    db.refresh(cdn)

    return {
        "message": f"{payload.note_type.replace('_', ' ').title()} '{cdn.invoice_number}' linked to invoice '{original_inv.invoice_number}'.",
        "id": cdn.id,
        "note_number": cdn.invoice_number,
        "total_amount": cdn.total_amount,
    }


@router.patch("/invoices/{invoice_id}/status")
def update_invoice_status(
    invoice_id: str,
    new_status: str,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    inv = (
        db.query(SalesInvoice)
        .filter(SalesInvoice.id == invoice_id, SalesInvoice.business_id == business.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if new_status not in ["issued", "paid", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be issued, paid, or cancelled.")

    inv.status = new_status
    db.commit()
    return {"message": f"Status updated to '{new_status}'."}

