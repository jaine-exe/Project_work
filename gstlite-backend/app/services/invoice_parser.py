import re
from datetime import datetime
from typing import Any, Dict, List, Optional


def parse_date_str(raw_str: str) -> Optional[str]:
    """Converts various date formats to ISO YYYY-MM-DD."""
    if not raw_str:
        return None
    cleaned = raw_str.strip()
    formats = [
        "%d %b %Y",       # 15 Sep 2026
        "%d %B %Y",       # 15 September 2026
        "%d-%b-%Y",       # 15-Sep-2026
        "%d/%b/%Y",       # 15/Sep/2026
        "%Y-%m-%d",       # 2026-09-15
        "%d/%m/%Y",       # 15/09/2026
        "%d-%m-%Y",       # 15-09-2026
        "%d.%m.%Y",       # 15.09.2026
        "%m/%d/%Y",       # 09/15/2026
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Regex fallback for DD-MM-YYYY or YYYY-MM-DD
    m = re.search(r"(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})", cleaned)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    m2 = re.search(r"(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})", cleaned)
    if m2:
        return f"{m2.group(3)}-{m2.group(2).zfill(2)}-{m2.group(1).zfill(2)}"

    return cleaned


def parse_invoice_text(text: str) -> Dict[str, Any]:
    """
    High-precision extraction of structured fields from invoice text.
    """
    if not text:
        return {}

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # 1. Invoice Number
    invoice_number = None
    inv_no_patterns = [
        r"(?:INVOICE\s*(?:NO\.?|NUMBER|#)|BILL\s*NO\.?)\s*[:\-\s\.]*\n*([A-Z0-9\-\/]{3,30})",
        r"\b(PUR-\d{4}-\d{3,6})\b",
        r"\b(INV-\d{4}-\d{3,6})\b",
    ]
    for pattern in inv_no_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            # Ignore false matches like "Original for Recipient" or "Seller"
            if not re.search(r"^(?:original|duplicate|triplicate|date|bill|invoice|payment|gstin|seller|buyer|state|place)$", candidate, re.IGNORECASE):
                invoice_number = candidate
                break

    # If still not found, check lines right after "PURCHASE INVOICE" or "TAX INVOICE"
    if not invoice_number:
        for idx, line in enumerate(lines):
            if re.search(r"PURCHASE\s*INVOICE|TAX\s*INVOICE", line, re.IGNORECASE):
                if idx + 1 < len(lines):
                    next_line = lines[idx + 1]
                    if re.match(r"^[A-Z0-9\-\/]{4,25}$", next_line) and not re.search(r"original|duplicate|date|seller|buyer", next_line, re.I):
                        invoice_number = next_line
                        break

    # 2. Invoice Date
    invoice_date = None
    date_patterns = [
        r"(?:INVOICE\s*DATE|BILL\s*DATE|DATE)\s*[:\-\s]*\n*([0-9]{1,2}[-/\.][0-9]{1,2}[-/\.][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})",
        r"\b([0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4})\b",
    ]
    for pattern in date_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            invoice_date = parse_date_str(m.group(1))
            if invoice_date:
                break

    # 3. GSTINs (Vendor vs Buyer)
    all_gstins = re.findall(r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b", text)
    vendor_gstin = all_gstins[0] if all_gstins else None
    buyer_gstin = all_gstins[1] if len(all_gstins) > 1 else None

    # Check context around GSTINs
    m_vend_gstin = re.search(r"(?:VENDOR|SUPPLIER|SELLER)[^\n\r]*[\s\S]{1,150}?GSTIN\s*[:\-\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})", text, re.I)
    if m_vend_gstin:
        vendor_gstin = m_vend_gstin.group(1)

    m_buyer_gstin = re.search(r"(?:BILLED\s*TO|BUYER|CUSTOMER)[^\n\r]*[\s\S]{1,150}?GSTIN\s*[:\-\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})", text, re.I)
    if m_buyer_gstin:
        buyer_gstin = m_buyer_gstin.group(1)

    # 4. Vendor Name and Buyer Name
    vendor_name = None
    buyer_name = None

    m_vend = re.search(r"(?:VENDOR\s*\/\s*SUPPLIER|SELLER)\s*[\n\r\s]+([^\n\r]+)", text, re.I)
    if m_vend and not re.search(r"(?:address|gstin|state|tax|invoice)", m_vend.group(1), re.I):
        vendor_name = m_vend.group(1).strip()
    else:
        # Fallback vendor matching legal suffix
        m_corp = re.search(r"([A-Z0-9\s&\.\'-]+(?:Pvt\.?\s*Ltd\.?|Private Limited|Limited|Inc\.?|Traders|Enterprise|Services|Works|Mills|Hub|Co))", text, re.I)
        if m_corp:
            vendor_name = m_corp.group(1).strip()

    m_buyer = re.search(r"(?:BILLED\s*TO\s*(?:\([^\)]+\))?|BUYER|CUSTOMER)\s*[\n\r\s]+([^\n\r]+)", text, re.I)
    if m_buyer and not re.search(r"(?:address|gstin|state|tax|invoice)", m_buyer.group(1), re.I):
        buyer_name = m_buyer.group(1).strip()
    else:
        m_buyer_alt = re.search(r"(?:BUYER|CUSTOMER|RECIPIENT)\s*[:\-\n\s]+([A-Za-z0-9\s&\.\'-]{3,50})", text, re.I)
        if m_buyer_alt:
            buyer_name = m_buyer_alt.group(1).strip()

    # 5. Amounts and Taxes
    subtotal = None
    cgst_amount = None
    sgst_amount = None
    igst_amount = None
    total_payable = None
    tax_rate = 18.0

    # Subtotal (Taxable Amount)
    m_sub = re.search(r"(?:Total\s*Taxable\s*Value|Taxable\s*(?:Amount|Value)|Subtotal)\s*[:\-\s]*\n*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)", text, re.I)
    if m_sub:
        try:
            subtotal = float(m_sub.group(1).replace(",", ""))
        except ValueError:
            pass

    # CGST
    m_cgst = re.search(r"(?:Total\s*CGST|CGST)[^\n\r:]*[:\-\s]*\n*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)", text, re.I)
    if m_cgst:
        try:
            cgst_amount = float(m_cgst.group(1).replace(",", ""))
        except ValueError:
            pass

    # SGST
    m_sgst = re.search(r"(?:Total\s*SGST|SGST)[^\n\r:]*[:\-\s]*\n*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)", text, re.I)
    if m_sgst:
        try:
            sgst_amount = float(m_sgst.group(1).replace(",", ""))
        except ValueError:
            pass

    # IGST
    m_igst = re.search(r"(?:Total\s*IGST|IGST)[^\n\r:]*[:\-\s]*\n*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)", text, re.I)
    if m_igst:
        try:
            igst_amount = float(m_igst.group(1).replace(",", ""))
        except ValueError:
            pass

    # Total Payable / Invoice Total
    m_tot = re.search(r"(?:Grand\s*Total|Total\s*Payable|Invoice\s*Total|Total\s*Amount)\s*[:\-\s]*\n*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d*)", text, re.I)
    if m_tot:
        try:
            total_payable = float(m_tot.group(1).replace(",", ""))
        except ValueError:
            pass

    # Compute & Reconcile Tax Totals
    total_tax = 0.0
    if cgst_amount is not None or sgst_amount is not None:
        total_tax = (cgst_amount or 0.0) + (sgst_amount or 0.0) + (igst_amount or 0.0)
    elif igst_amount is not None:
        total_tax = igst_amount

    # Backfill missing values with math integrity
    if subtotal is not None and total_tax > 0 and total_payable is None:
        total_payable = round(subtotal + total_tax, 2)
    elif total_payable is not None and subtotal is not None and total_tax == 0:
        total_tax = round(total_payable - subtotal, 2)
    elif total_payable is not None and subtotal is None and total_tax > 0:
        subtotal = round(total_payable - total_tax, 2)

    # Compute tax rate %
    if subtotal and subtotal > 0 and total_tax > 0:
        tax_rate = round((total_tax / subtotal) * 100.0, 1)

    # 6. HSN Codes
    # Find numbers after HSN/SAC or 8-digit tariff items
    hsn_list = re.findall(r"\b([0-9]{8})\b", text)
    if not hsn_list:
        # If 8-digit not found, check lines containing HSN/SAC
        for line in lines:
            if re.search(r"HSN|SAC", line, re.I):
                hsn_candidates = re.findall(r"\b([0-9]{4,8})\b", line)
                hsn_list.extend(hsn_candidates)

    # Deduplicate while preserving order and ignore common pincodes
    valid_hsns = []
    for h in hsn_list:
        if h not in valid_hsns and len(h) in (4, 6, 8):
            valid_hsns.append(h)
    hsn_code = ", ".join(valid_hsns) if valid_hsns else None

    return {
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "vendor_name": vendor_name,
        "vendor_gstin": vendor_gstin,
        "buyer_name": buyer_name,
        "buyer_gstin": buyer_gstin,
        "taxable_amount": subtotal,
        "cgst_amount": cgst_amount,
        "sgst_amount": sgst_amount,
        "igst_amount": igst_amount,
        "total_tax": total_tax if total_tax > 0 else None,
        "total_amount": total_payable,
        "amount": total_payable or subtotal,  # For backward compatibility
        "tax_rate": tax_rate,
        "hsn_code": hsn_code,
    }
