"""
Aggregates validated invoices into a GST return payload.

This is a GSTR-3B-style computation: output tax on sales invoices,
input tax credit on purchase invoices, and the net payable — computed
from real invoice_type data rather than an assumed ratio.
"""

from app.db.models import Invoice


def _get_invoice_tax_breakdown(inv: Invoice) -> tuple[float, float]:
    """Given an invoice, returns (taxable_value, tax_amount) using stored actual values."""
    if getattr(inv, "taxable_amount", None) is not None:
        taxable = float(inv.taxable_amount)
        if getattr(inv, "total_tax", None) is not None:
            tax = float(inv.total_tax)
        elif getattr(inv, "cgst_amount", None) is not None or getattr(inv, "sgst_amount", None) is not None:
            tax = (
                float(getattr(inv, "cgst_amount", 0.0) or 0.0)
                + float(getattr(inv, "sgst_amount", 0.0) or 0.0)
                + float(getattr(inv, "igst_amount", 0.0) or 0.0)
            )
        elif inv.tax_rate is not None:
            tax = taxable * (float(inv.tax_rate) / 100.0)
        else:
            tax = 0.0
        return taxable, tax

    if inv.amount and inv.tax_rate is not None:
        taxable = inv.amount / (1 + inv.tax_rate / 100)
        tax = inv.amount - taxable
        return taxable, tax

    return inv.amount or 0.0, 0.0


def build_gst_summary(invoices: list[Invoice], period: str) -> dict:
    valid_invoices = [
        i for i in invoices
        if (i.amount or getattr(i, "taxable_amount", None)) and i.tax_rate is not None
    ]

    sales_invoices = [i for i in valid_invoices if getattr(i, "invoice_type", "purchase") == "sales"]
    purchase_invoices = [i for i in valid_invoices if getattr(i, "invoice_type", "purchase") == "purchase"]

    # All slabs (required by frontend and GstSummaryOut schema)
    all_slabs: dict[float, dict] = {}
    for inv in valid_invoices:
        taxable, tax = _get_invoice_tax_breakdown(inv)
        bucket = all_slabs.setdefault(inv.tax_rate, {"taxable_value": 0.0, "tax_amount": 0.0})
        bucket["taxable_value"] += taxable
        bucket["tax_amount"] += tax

    # --- Output tax (from sales invoices ONLY) ---
    output_tax_liability = 0.0
    output_slabs: dict[float, dict] = {}
    for inv in sales_invoices:
        taxable, tax = _get_invoice_tax_breakdown(inv)
        output_tax_liability += tax
        bucket = output_slabs.setdefault(inv.tax_rate, {"taxable_value": 0.0, "tax_amount": 0.0})
        bucket["taxable_value"] += taxable
        bucket["tax_amount"] += tax

    # --- Input tax credit (from purchase invoices ONLY) ---
    input_tax_credit = 0.0
    input_slabs: dict[float, dict] = {}
    for inv in purchase_invoices:
        taxable, tax = _get_invoice_tax_breakdown(inv)
        input_tax_credit += tax
        bucket = input_slabs.setdefault(inv.tax_rate, {"taxable_value": 0.0, "tax_amount": 0.0})
        bucket["taxable_value"] += taxable
        bucket["tax_amount"] += tax

    output_tax_liability = round(output_tax_liability, 2)
    input_tax_credit = round(input_tax_credit, 2)
    net_payable = round(output_tax_liability - input_tax_credit, 2)
    if net_payable < 0:
        net_payable = 0.0

    flagged_count = len([i for i in invoices if getattr(i.status, "value", i.status) == "flagged"])

    def _format_slabs(slabs: dict[float, dict]) -> list[dict]:
        return [
            {
                "rate": rate,
                "taxable_value": round(v["taxable_value"], 2),
                "tax_amount": round(v["tax_amount"], 2),
            }
            for rate, v in sorted(slabs.items())
        ]

    return {
        "period": period,
        "output_tax_liability": output_tax_liability,
        "input_tax_credit": input_tax_credit,
        "net_payable": net_payable,
        "flagged_invoice_count": flagged_count,
        "tax_slabs": _format_slabs(all_slabs),
        "output_tax_slabs": _format_slabs(output_slabs),
        "input_tax_slabs": _format_slabs(input_slabs),
    }


def build_return_payload(invoices: list[Invoice], period: str, return_type: str) -> dict:
    summary = build_gst_summary(invoices, period)
    line_items = []
    for inv in invoices:
        taxable, tax = _get_invoice_tax_breakdown(inv)
        line_items.append({
            "invoice_id": getattr(inv, "invoice_number", None) or inv.display_id,
            "display_id": inv.display_id,
            "invoice_type": getattr(inv, "invoice_type", "purchase"),
            "vendor_gstin": inv.vendor_gstin,
            "hsn_code": inv.hsn_code,
            "taxable_value": round(taxable, 2),
            "tax_rate": inv.tax_rate,
            "tax_amount": round(tax, 2),
            "status": getattr(inv.status, "value", inv.status),
        })
    return {
        "return_type": return_type,
        "period": period,
        "summary": summary,
        "line_items": line_items,
    }