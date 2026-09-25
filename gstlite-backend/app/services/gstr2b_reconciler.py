import json
import re
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.db.models import (
    ComplianceIssue,
    DocumentType,
    Gstr2bEntry,
    Invoice,
    IssueSeverity,
)


def _clean_str(val: Optional[str]) -> str:
    if not val:
        return ""
    return re.sub(r"[^A-Za-z0-9]", "", str(val)).upper()


def parse_and_save_gstr2b(
    db: Session,
    business_id: str,
    raw_data: Any,
    default_period: str = "2026-07",
) -> Dict[str, Any]:
    """
    Parses official GSTN GSTR-2B JSON or simplified format and stores Gstr2bEntry records.
    """
    if isinstance(raw_data, str):
        try:
            data = json.loads(raw_data)
        except Exception as e:
            raise ValueError(f"Invalid JSON format: {e}")
    elif isinstance(raw_data, dict) or isinstance(raw_data, list):
        data = raw_data
    else:
        raise ValueError("Unsupported data type for GSTR-2B")

    entries_to_add: List[Gstr2bEntry] = []

    # 1. Official GST Portal GSTR-2B format
    # Hierarchy: data.docdata.b2b or docdata.b2b or b2b
    docdata = data
    if isinstance(data, dict):
        if "data" in data and isinstance(data["data"], dict):
            docdata = data["data"]
        if "docdata" in docdata and isinstance(docdata["docdata"], dict):
            docdata = docdata["docdata"]

    period = default_period
    if isinstance(data, dict):
        fp = data.get("fp")
        if fp and len(str(fp)) == 6:
            # e.g. "072026" -> "2026-07"
            mm, yyyy = str(fp)[:2], str(fp)[2:]
            period = f"{yyyy}-{mm}"

    if isinstance(docdata, dict) and "b2b" in docdata:
        b2b_list = docdata.get("b2b", [])
        for supplier in b2b_list:
            ctin = supplier.get("ctin", "")
            cname = supplier.get("cname") or supplier.get("trade_name") or ""
            inv_list = supplier.get("inv", [])
            for inv in inv_list:
                inum = str(inv.get("inum", ""))
                idt = str(inv.get("idt", ""))
                val = float(inv.get("val", 0.0) or 0.0)
                itcavl = inv.get("itcavl", "Y")

                items = inv.get("items", [])
                txval = 0.0
                tax = 0.0
                rate = 18.0
                for item in items:
                    txval += float(item.get("txval", 0.0) or 0.0)
                    iamt = float(item.get("iamt", 0.0) or 0.0)
                    camt = float(item.get("camt", 0.0) or 0.0)
                    samt = float(item.get("samt", 0.0) or 0.0)
                    tax += iamt + camt + samt
                    if "rt" in item:
                        rate = float(item.get("rt") or 18.0)

                entries_to_add.append(
                    Gstr2bEntry(
                        business_id=business_id,
                        period=period,
                        supplier_gstin=ctin,
                        supplier_name=cname,
                        invoice_number=inum,
                        invoice_date=idt,
                        invoice_value=val or (txval + tax),
                        taxable_value=txval,
                        tax_amount=tax,
                        tax_rate=rate,
                        itc_available=itcavl,
                    )
                )

    # 2. Simplified flat list format: [{"supplier_gstin": ..., "invoice_number": ..., "amount": ...}]
    elif isinstance(data, list):
        for item in data:
            ctin = item.get("supplier_gstin") or item.get("vendor_gstin") or item.get("gstin", "")
            inum = item.get("invoice_number") or item.get("display_id") or item.get("inum", "")
            val = float(item.get("invoice_value") or item.get("amount") or item.get("val") or 0.0)
            tax = float(item.get("tax_amount") or (val * 0.18 / 1.18))
            txval = float(item.get("taxable_value") or (val - tax))
            rate = float(item.get("tax_rate") or item.get("rate") or 18.0)

            entries_to_add.append(
                Gstr2bEntry(
                    business_id=business_id,
                    period=period,
                    supplier_gstin=ctin,
                    supplier_name=item.get("supplier_name") or item.get("vendor_name", ""),
                    invoice_number=inum,
                    invoice_date=item.get("invoice_date", ""),
                    invoice_value=val,
                    taxable_value=txval,
                    tax_amount=tax,
                    tax_rate=rate,
                    itc_available=item.get("itc_available", "Y"),
                )
            )

    if not entries_to_add:
        raise ValueError("No B2B invoices found in the provided GSTR-2B data.")

    # Remove existing entries for this business and period
    db.query(Gstr2bEntry).filter(
        Gstr2bEntry.business_id == business_id,
        Gstr2bEntry.period == period,
    ).delete()

    for entry in entries_to_add:
        db.add(entry)
    db.commit()

    # Re-sync compliance issues against new GSTR-2B records
    sync_compliance_issues_with_2b(db, business_id, period)

    return {"imported_count": len(entries_to_add), "period": period}


def generate_demo_gstr2b_data(db: Session, business_id: str, period: str = "2026-07") -> int:
    """
    Auto-generates a realistic GSTR-2B dataset tailored to the business's current invoices.
    Leaves 2-3 invoices unmatched for demonstration of Rule 36(4) enforcement.
    """
    purchase_invoices = (
        db.query(Invoice)
        .filter(Invoice.business_id == business_id)
        .order_by(Invoice.created_at.asc())
        .all()
    )

    entries = []
    # Match the majority, but intentionally leave the last 2-3 unmatched
    unmatched_count = min(3, max(1, len(purchase_invoices) // 4))
    matched_invoices = purchase_invoices[:-unmatched_count] if len(purchase_invoices) > unmatched_count else purchase_invoices

    for inv in matched_invoices:
        if not inv.vendor_gstin:
            continue
        amt = inv.amount or 50000.0
        tax = round(amt - (amt / 1.18), 2)
        txval = round(amt - tax, 2)
        entries.append(
            Gstr2bEntry(
                business_id=business_id,
                period=period,
                supplier_gstin=inv.vendor_gstin,
                supplier_name=inv.vendor_name or "Verified Supplier",
                invoice_number=inv.display_id,
                invoice_date=inv.invoice_date or "2026-07-15",
                invoice_value=amt,
                taxable_value=txval,
                tax_amount=tax,
                tax_rate=inv.tax_rate or 18.0,
                itc_available="Y",
            )
        )

    # Add 1 entry with a slight value discrepancy to demonstrate mismatch detection
    if matched_invoices:
        sample_inv = matched_invoices[0]
        if sample_inv.vendor_gstin:
            amt = (sample_inv.amount or 50000.0) + 1200.0  # slight difference
            tax = round(amt - (amt / 1.18), 2)
            entries.append(
                Gstr2bEntry(
                    business_id=business_id,
                    period=period,
                    supplier_gstin=sample_inv.vendor_gstin,
                    supplier_name=sample_inv.vendor_name or "Verified Supplier",
                    invoice_number=sample_inv.display_id + "-VAR",
                    invoice_date="2026-07-20",
                    invoice_value=amt,
                    taxable_value=round(amt - tax, 2),
                    tax_amount=tax,
                    tax_rate=18.0,
                    itc_available="Y",
                )
            )

    # Add 1 supplier invoice filed in 2B that taxpayer has not yet recorded in books
    entries.append(
        Gstr2bEntry(
            business_id=business_id,
            period=period,
            supplier_gstin="27AABCT3421K1Z1",
            supplier_name="Apex Logistics & Freight Corp",
            invoice_number="APX-2026-0814",
            invoice_date="2026-07-28",
            invoice_value=24500.0,
            taxable_value=20762.71,
            tax_amount=3737.29,
            tax_rate=18.0,
            itc_available="Y",
        )
    )

    db.query(Gstr2bEntry).filter(
        Gstr2bEntry.business_id == business_id,
        Gstr2bEntry.period == period,
    ).delete()

    for e in entries:
        db.add(e)
    db.commit()

    sync_compliance_issues_with_2b(db, business_id, period)
    return len(entries)


def sync_compliance_issues_with_2b(db: Session, business_id: str, period: str):
    """
    Updates ComplianceIssue records:
    - Removes outdated 'GSTR-2B Unmatched' issues if invoice is now matched.
    - Adds high-risk compliance issue if purchase invoice has no matching GSTR-2B record.
    """
    gstr2b_records = (
        db.query(Gstr2bEntry)
        .filter(Gstr2bEntry.business_id == business_id, Gstr2bEntry.period == period)
        .all()
    )
    if not gstr2b_records:
        return

    known_gstins = {_clean_str(e.supplier_gstin) for e in gstr2b_records if e.supplier_gstin}

    invoices = (
        db.query(Invoice)
        .filter(Invoice.business_id == business_id)
        .all()
    )

    for inv in invoices:
        if getattr(inv, "invoice_type", "purchase") == "sales":
            continue  # GSTR-2B is only for purchases / inward supplies

        v_gstin = _clean_str(inv.vendor_gstin)
        existing_2b_issues = [
            iss for iss in inv.issues if "GSTR-2B" in iss.title or "Rule 36(4)" in iss.rule_reference
        ]

        if not v_gstin:
            continue

        if v_gstin in known_gstins:
            # Resolved in 2B: delete the 2B warning issue
            for iss in existing_2b_issues:
                db.delete(iss)
        else:
            # Not in 2B: ensure high-risk issue exists
            if not existing_2b_issues:
                db.add(
                    ComplianceIssue(
                        invoice_id=inv.id,
                        title="GSTR-2B Unmatched Vendor",
                        severity=IssueSeverity.medium,
                        description=f"Vendor GSTIN '{inv.vendor_gstin}' is not present in your auto-drafted GSTR-2B for period {period}.",
                        suggestion="Do not claim ITC until the supplier files their GSTR-1, or request them to upload it.",
                        rule_reference="Rule 36(4), CGST Rules",
                    )
                )
    db.commit()


def get_reconciliation_report(
    db: Session,
    business_id: str,
    period: str = "2026-07",
) -> Dict[str, Any]:
    """
    Cross-reconciles purchase invoices with GSTR-2B records for the business.
    Returns matched, mismatched, missing_in_2b, and missing_in_books records.
    """
    purchase_invoices = (
        db.query(Invoice)
        .filter(Invoice.business_id == business_id)
        .all()
    )
    # Filter to purchase type
    purchase_invoices = [i for i in purchase_invoices if getattr(i, "invoice_type", "purchase") == "purchase"]

    gstr2b_entries = (
        db.query(Gstr2bEntry)
        .filter(Gstr2bEntry.business_id == business_id, Gstr2bEntry.period == period)
        .all()
    )

    # Index 2B records by (clean_gstin, clean_inv_num) and clean_gstin
    by_gstin_and_num: Dict[str, Gstr2bEntry] = {}
    by_gstin: Dict[str, List[Gstr2bEntry]] = {}
    matched_2b_ids = set()

    for e in gstr2b_entries:
        gstin_clean = _clean_str(e.supplier_gstin)
        num_clean = _clean_str(e.invoice_number)
        if gstin_clean and num_clean:
            by_gstin_and_num[f"{gstin_clean}_{num_clean}"] = e
        if gstin_clean:
            by_gstin.setdefault(gstin_clean, []).append(e)

    matched: List[Dict[str, Any]] = []
    mismatched: List[Dict[str, Any]] = []
    missing_in_2b: List[Dict[str, Any]] = []

    for inv in purchase_invoices:
        v_gstin = _clean_str(inv.vendor_gstin)
        inv_num = _clean_str(inv.display_id)

        # 1. Exact match on GSTIN + Invoice Number
        key = f"{v_gstin}_{inv_num}"
        entry = by_gstin_and_num.get(key)

        # 2. Or fallback: match on vendor GSTIN if amount is within ₹10
        if not entry and v_gstin in by_gstin:
            for candidate in by_gstin[v_gstin]:
                if candidate.id not in matched_2b_ids and inv.amount:
                    if abs((candidate.invoice_value or 0) - inv.amount) < 10.0:
                        entry = candidate
                        break

        if entry:
            matched_2b_ids.add(entry.id)
            inv_tax = round((inv.amount or 0) - ((inv.amount or 0) / 1.18), 2)
            entry_tax = round(entry.tax_amount or 0, 2)
            val_diff = abs((inv.amount or 0) - (entry.invoice_value or 0))

            item_data = {
                "invoice_id": inv.id,
                "display_id": inv.display_id,
                "vendor_name": inv.vendor_name or entry.supplier_name,
                "vendor_gstin": inv.vendor_gstin or entry.supplier_gstin,
                "invoice_amount": inv.amount,
                "itc_amount": inv_tax,
                "gstr2b_invoice_number": entry.invoice_number,
                "gstr2b_amount": entry.invoice_value,
                "gstr2b_itc": entry_tax,
                "status": "matched" if val_diff <= 5.0 else "mismatched",
                "variance": round(val_diff, 2),
            }

            if val_diff <= 5.0:
                matched.append(item_data)
            else:
                mismatched.append(item_data)
        else:
            inv_tax = round((inv.amount or 0) - ((inv.amount or 0) / 1.18), 2) if inv.amount else 0
            missing_in_2b.append({
                "invoice_id": inv.id,
                "display_id": inv.display_id,
                "vendor_name": inv.vendor_name,
                "vendor_gstin": inv.vendor_gstin,
                "invoice_amount": inv.amount,
                "itc_amount": inv_tax,
                "status": "missing_in_2b",
                "risk_reason": "Not reported by vendor in GSTR-1. ITC restricted under Rule 36(4).",
            })

    # Missing in Books: In GSTR-2B but never uploaded to GSTLite
    missing_in_books: List[Dict[str, Any]] = []
    for e in gstr2b_entries:
        if e.id not in matched_2b_ids:
            missing_in_books.append({
                "gstr2b_id": e.id,
                "supplier_name": e.supplier_name or "Unknown Supplier",
                "supplier_gstin": e.supplier_gstin,
                "invoice_number": e.invoice_number,
                "invoice_date": e.invoice_date,
                "invoice_value": e.invoice_value,
                "itc_amount": e.tax_amount,
                "status": "missing_in_books",
                "opportunity": "Eligible ITC available in GSTR-2B but invoice not uploaded yet.",
            })

    matched_itc = sum(m["itc_amount"] for m in matched if m.get("itc_amount"))
    missing_itc = sum(m["itc_amount"] for m in missing_in_2b if m.get("itc_amount"))
    unclaimed_itc = sum(m["itc_amount"] for m in missing_in_books if m.get("itc_amount"))

    total_purchase_count = len(purchase_invoices)
    rec_rate = (
        round((len(matched) / total_purchase_count) * 100, 1)
        if total_purchase_count > 0
        else 100.0
    )

    return {
        "period": period,
        "summary": {
            "total_purchase_invoices": total_purchase_count,
            "matched_count": len(matched),
            "matched_itc": round(matched_itc, 2),
            "mismatched_count": len(mismatched),
            "missing_in_2b_count": len(missing_in_2b),
            "missing_in_2b_itc": round(missing_itc, 2),
            "missing_in_books_count": len(missing_in_books),
            "missing_in_books_itc": round(unclaimed_itc, 2),
            "reconciliation_rate": rec_rate,
            "has_2b_data": len(gstr2b_entries) > 0,
        },
        "matched": matched,
        "mismatched": mismatched,
        "missing_in_2b": missing_in_2b,
        "missing_in_books": missing_in_books,
    }
