from datetime import datetime
from sqlalchemy.orm import Session

from app.db.models import Business, DocumentType, Invoice, InvoiceStatus, RiskLevel


def generate_gstr1_payload(db: Session, business_id: str) -> dict:
    """
    Generates official GSTR-1 Outward Supplies JSON payload for B2B and HSN summaries.
    Processes SALES invoices only.
    """
    # Fetch business GSTIN dynamically
    business = db.query(Business).filter(Business.id == business_id).first()
    business_gstin = business.gstin if business and business.gstin else "UNREGISTERED"

    # Filter strictly for SALES invoices
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.business_id == business_id,
            Invoice.document_type == DocumentType.sales,
            Invoice.status != InvoiceStatus.failed,
        )
        .all()
    )

    b2b_list = []
    hsn_summary = {}

    for inv in invoices:
        if not inv.vendor_gstin or not inv.amount:
            continue

        tax_rate = inv.tax_rate or 18.0
        taxable_value = round(inv.amount / (1 + (tax_rate / 100)), 2)
        tax_amount = round(inv.amount - taxable_value, 2)

        # 1. B2B Invoice Section
        b2b_entry = {
            "ctin": inv.vendor_gstin,
            "inv": [
                {
                    "inum": inv.display_id,
                    "idt": inv.invoice_date or datetime.now().strftime("%Y-%m-%d"),
                    "val": inv.amount,
                    "pos": inv.vendor_gstin[:2],
                    "rchrg": "N",
                    "inv_typ": "R",
                    "itms": [
                        {
                            "num": 1,
                            "itm_det": {
                                "rt": tax_rate,
                                "txval": taxable_value,
                                "iamt": tax_amount,
                                "camt": 0.0,
                                "samt": 0.0,
                            },
                        }
                    ],
                }
            ],
        }
        b2b_list.append(b2b_entry)

        # 2. HSN Summary Section
        hsn = inv.hsn_code or "9983"
        if hsn not in hsn_summary:
            hsn_summary[hsn] = {"hsn_sc": hsn, "txval": 0.0, "iamt": 0.0, "qty": 0}
        hsn_summary[hsn]["txval"] = round(hsn_summary[hsn]["txval"] + taxable_value, 2)
        hsn_summary[hsn]["iamt"] = round(hsn_summary[hsn]["iamt"] + tax_amount, 2)
        hsn_summary[hsn]["qty"] += 1

    current_fp = datetime.now().strftime("%m%Y")  # e.g., "082026"

    return {
        "gstin": business_gstin,
        "fp": current_fp,
        "b2b": b2b_list,
        "hsn": {"data": list(hsn_summary.values())},
    }


def generate_gstr3b_payload(db: Session, business_id: str) -> dict:
    """
    Computes GSTR-3B Summary:
    - Sales Invoices -> Output Tax Liability (Table 3.1)
    - Purchase Invoices -> Eligible vs. Blocked Input Tax Credit (Table 4)
    """
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.business_id == business_id,
            Invoice.status != InvoiceStatus.failed,
        )
        .all()
    )

    total_output_taxable = 0.0
    total_output_tax = 0.0
    eligible_itc = 0.0
    blocked_itc = 0.0

    for inv in invoices:
        amount = inv.amount or 0.0
        tax_rate = inv.tax_rate or 18.0
        taxable = round(amount / (1 + (tax_rate / 100)), 2)
        tax = round(amount - taxable, 2)

        # 1. Sales Invoices build Output Tax Liability
        if inv.document_type == DocumentType.sales:
            total_output_taxable += taxable
            total_output_tax += tax

        # 2. Purchase Invoices build Input Tax Credit (ITC)
        elif inv.document_type == DocumentType.purchase:
            if inv.risk == RiskLevel.high or inv.status == InvoiceStatus.flagged:
                blocked_itc += tax
            else:
                eligible_itc += tax

    net_tax_payable = max(0.0, total_output_tax - eligible_itc)

    return {
        "summary": {
            "total_taxable_value": round(total_output_taxable, 2),
            "total_output_tax": round(total_output_tax, 2),
            "eligible_itc": round(eligible_itc, 2),
            "blocked_itc": round(blocked_itc, 2),
            "net_tax_payable": round(net_tax_payable, 2),
        },
        "table_3_1_outward_supplies": {
            "txval": round(total_output_taxable, 2),
            "iamt": round(total_output_tax, 2),
        },
        "table_4_itc": {
            "itc_available": round(eligible_itc, 2),
            "itc_blocked": round(blocked_itc, 2),
        },
    }