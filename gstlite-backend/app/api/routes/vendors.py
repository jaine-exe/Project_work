import urllib.parse
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.db.database import get_db
from app.db.models import Business, Gstr2bEntry, Invoice

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


class NoticePreviewRequest(BaseModel):
    vendor_name: str
    vendor_gstin: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_phone: Optional[str] = None
    invoice_number: str
    invoice_date: str
    amount: float
    tax_amount: float


@router.get("/scorecard")
def get_vendor_scorecard(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    # Fetch all purchase invoices
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.business_id == business.id,
            Invoice.document_type == "purchase",
        )
        .all()
    )

    # Fetch 2B entries
    gstr2b_list = (
        db.query(Gstr2bEntry)
        .filter(Gstr2bEntry.business_id == business.id)
        .all()
    )
    known_2b_invoices = set()
    for entry in gstr2b_list:
        if entry.invoice_number:
            known_2b_invoices.add(entry.invoice_number.strip().upper())
        if entry.supplier_gstin:
            known_2b_invoices.add(entry.supplier_gstin.strip().upper())

    # Aggregate by vendor
    vendors_map = {}
    for inv in invoices:
        gstin = (inv.vendor_gstin or "UNREGISTERED").strip().upper()
        name = inv.vendor_name or "Unknown Supplier"
        key = gstin if gstin != "UNREGISTERED" else f"UNREG_{name}"

        if key not in vendors_map:
            vendors_map[key] = {
                "vendor_name": name,
                "vendor_gstin": gstin if gstin != "UNREGISTERED" else None,
                "total_invoices": 0,
                "total_spend": 0.0,
                "total_itc": 0.0,
                "matched_count": 0,
                "missing_count": 0,
                "invoices": [],
            }

        v = vendors_map[key]
        v["total_invoices"] += 1
        amt = float(inv.total_amount or inv.amount or 0.0)
        v["total_spend"] += amt
        tax = float(inv.total_tax or 0.0)
        v["total_itc"] += tax

        inv_num = (inv.invoice_number or inv.display_id or "").strip().upper()
        is_matched = (
            (inv_num in known_2b_invoices)
            or (gstin in known_2b_invoices)
            or (inv.status and inv.status.value == "validated" and not any(iss.title == "GSTR-2B Unmatched Vendor" for iss in inv.issues))
        )

        if is_matched:
            v["matched_count"] += 1
        else:
            v["missing_count"] += 1

        v["invoices"].append({
            "id": inv.id,
            "invoice_number": inv.invoice_number or inv.display_id,
            "invoice_date": inv.invoice_date or inv.created_at.strftime("%Y-%m-%d"),
            "amount": amt,
            "tax_amount": tax,
            "is_matched": is_matched,
            "is_locked": inv.is_locked,
        })

    vendor_list = []
    total_vendors = len(vendors_map)
    green_count = 0
    amber_count = 0
    red_count = 0
    total_itc_at_risk = 0.0

    for _, v in vendors_map.items():
        v["total_spend"] = round(v["total_spend"], 2)
        v["total_itc"] = round(v["total_itc"], 2)

        match_pct = (
            round((v["matched_count"] / v["total_invoices"]) * 100, 1)
            if v["total_invoices"] > 0
            else 0
        )
        v["match_percentage"] = match_pct

        if match_pct >= 90:
            rating = "Green"
            risk_label = "Compliant & Reliable"
            green_count += 1
        elif match_pct >= 60:
            rating = "Amber"
            risk_label = "Moderate Risk"
            amber_count += 1
            total_itc_at_risk += v["total_itc"] * (1 - match_pct / 100)
        else:
            rating = "Red"
            risk_label = "High Risk (ITC Blockage)"
            red_count += 1
            total_itc_at_risk += v["total_itc"]

        v["rating"] = rating
        v["risk_label"] = risk_label
        vendor_list.append(v)

    # Sort red first, then amber, then green
    rating_weight = {"Red": 0, "Amber": 1, "Green": 2}
    vendor_list.sort(key=lambda x: (rating_weight[x["rating"]], -x["total_spend"]))

    return {
        "summary": {
            "total_vendors": total_vendors,
            "green_compliant": green_count,
            "amber_moderate": amber_count,
            "red_high_risk": red_count,
            "total_itc_at_risk": round(total_itc_at_risk, 2),
        },
        "vendors": vendor_list,
    }


@router.get("/missing-invoices")
def get_missing_invoices(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.business_id == business.id,
            Invoice.document_type == "purchase",
        )
        .all()
    )

    gstr2b_list = (
        db.query(Gstr2bEntry)
        .filter(Gstr2bEntry.business_id == business.id)
        .all()
    )
    known_2b_invoices = set()
    for entry in gstr2b_list:
        if entry.invoice_number:
            known_2b_invoices.add(entry.invoice_number.strip().upper())
        if entry.supplier_gstin:
            known_2b_invoices.add(entry.supplier_gstin.strip().upper())

    missing = []
    for inv in invoices:
        gstin = (inv.vendor_gstin or "").strip().upper()
        inv_num = (inv.invoice_number or inv.display_id or "").strip().upper()
        has_2b_issue = any(iss.title == "GSTR-2B Unmatched Vendor" for iss in inv.issues)

        is_missing = (
            has_2b_issue
            or (gstin and gstin not in known_2b_invoices and inv_num not in known_2b_invoices)
        )

        if is_missing:
            amt = float(inv.total_amount or inv.amount or 0.0)
            tax = float(inv.total_tax or 0.0)
            missing.append({
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number or inv.display_id,
                "invoice_date": inv.invoice_date or inv.created_at.strftime("%Y-%m-%d"),
                "vendor_name": inv.vendor_name or "Unknown Supplier",
                "vendor_gstin": inv.vendor_gstin,
                "amount": amt,
                "tax_amount": tax,
                "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
                "is_locked": inv.is_locked,
            })

    return {"missing_invoices": missing, "count": len(missing)}


@router.post("/notice-preview")
def generate_vendor_notice(
    payload: NoticePreviewRequest,
    business: Business = Depends(get_current_business),
):
    biz_name = business.name or "Accounts Department"
    biz_gstin = business.gstin or ""

    email_subject = f"Urgent: GSTR-1 Filing Discrepancy for Invoice {payload.invoice_number}"
    email_body = (
        f"Dear {payload.vendor_name},\n\n"
        f"We are writing from the accounts team at {biz_name} (GSTIN: {biz_gstin}).\n\n"
        f"Upon reconciling our monthly statutory GSTR-2B statement from the GST Portal, we noticed that your "
        f"Invoice No. {payload.invoice_number} dated {payload.invoice_date} for ₹{payload.amount:,.2f} "
        f"(Tax/ITC: ₹{payload.tax_amount:,.2f}) is currently MISSING from our portal records.\n\n"
        f"Under Section 16(2)(aa) of the CGST Act, our input tax credit is blocked until this supply is filed in your GSTR-1/IFF.\n\n"
        f"Kindly ensure that this invoice is uploaded and filed in your GSTR-1 before the 11th of this month so that it reflects in our GSTR-2B.\n\n"
        f"If you have already filed, please share the ARN (Application Reference Number) and Table 4A GSTR-1 acknowledgement.\n\n"
        f"Warm regards,\n"
        f"{biz_name}\n"
        f"GSTIN: {biz_gstin}"
    )

    whatsapp_text = (
        f"🚨 *GST ITC Action Required*\n\n"
        f"Dear *{payload.vendor_name}*,\n"
        f"Your invoice *{payload.invoice_number}* dated {payload.invoice_date} for *₹{payload.amount:,.2f}* "
        f"(ITC: *₹{payload.tax_amount:,.2f}*) is *missing* from our GSTR-2B.\n\n"
        f"Under Section 16(2)(aa), ITC cannot be claimed until filed. Please upload this bill in your GSTR-1 before the 11th.\n\n"
        f"— *{biz_name}* (GSTIN: {biz_gstin})"
    )

    clean_phone = "".join(c for c in (payload.vendor_phone or "") if c.isdigit())
    if len(clean_phone) == 10:
        clean_phone = "91" + clean_phone

    wa_url = f"https://wa.me/{clean_phone}?text={urllib.parse.quote(whatsapp_text)}"
    mailto_url = f"mailto:{payload.vendor_email or ''}?subject={urllib.parse.quote(email_subject)}&body={urllib.parse.quote(email_body)}"

    return {
        "email_subject": email_subject,
        "email_body": email_body,
        "whatsapp_text": whatsapp_text,
        "mailto_url": mailto_url,
        "whatsapp_url": wa_url,
    }

