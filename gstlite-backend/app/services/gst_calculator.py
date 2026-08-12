"""
Aggregates validated invoices into a GST return payload.

This is a simplified GSTR-3B-style computation: output tax on sales,
input tax credit on purchases, and the net payable. A real implementation
would separate outward (GSTR-1) and inward (purchase register) invoices;
here all uploaded invoices are treated as purchase-side (ITC) for the
prototype's single-invoice-type flow, matching the frontend mock.
"""

from app.db.models import Invoice


def build_gst_summary(invoices: list[Invoice], period: str) -> dict:
    valid_invoices = [i for i in invoices if i.amount and i.tax_rate is not None]

    slabs: dict[float, dict] = {}
    total_tax = 0.0
    for inv in valid_invoices:
        taxable = inv.amount / (1 + inv.tax_rate / 100)
        tax = inv.amount - taxable
        total_tax += tax
        bucket = slabs.setdefault(inv.tax_rate, {"taxable_value": 0.0, "tax_amount": 0.0})
        bucket["taxable_value"] += taxable
        bucket["tax_amount"] += tax

    input_tax_credit = round(total_tax, 2)
    # Simplified: assume output liability runs ~60% higher than ITC, as in the
    # frontend's mock data, until real outward-invoice data is modeled.
    output_tax_liability = round(input_tax_credit * 1.63, 2)
    net_payable = round(output_tax_liability - input_tax_credit, 2)

    flagged_count = len([i for i in invoices if i.status.value == "flagged"])

    tax_slabs = [
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
        "tax_slabs": tax_slabs,
    }


def build_return_payload(invoices: list[Invoice], period: str, return_type: str) -> dict:
    summary = build_gst_summary(invoices, period)
    line_items = [
        {
            "invoice_id": inv.display_id,
            "vendor_gstin": inv.vendor_gstin,
            "hsn_code": inv.hsn_code,
            "taxable_value": round(inv.amount / (1 + inv.tax_rate / 100), 2)
            if inv.amount and inv.tax_rate is not None
            else None,
            "tax_rate": inv.tax_rate,
            "tax_amount": round(inv.amount - inv.amount / (1 + inv.tax_rate / 100), 2)
            if inv.amount and inv.tax_rate is not None
            else None,
            "status": inv.status.value,
        }
        for inv in invoices
    ]
    return {
        "return_type": return_type,
        "period": period,
        "summary": summary,
        "line_items": line_items,
    }
