import csv
import io
import os
import re
import shutil
import uuid
import zipfile
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.core.config import settings
from app.db.database import get_db
from app.db.models import Business, ComplianceIssue, Invoice, InvoiceStatus, IssueSeverity, RiskLevel, SalesInvoice
from app.services.ai_service import ManagerAgent

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# ----------------------------------------------------
# 1. Tally Prime XML Export
# ----------------------------------------------------
@router.get("/tally/export-xml")
def export_tally_xml(
    period: Optional[str] = None,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """
    Generates standard Tally Prime XML Voucher format for 1-click import:
    Tally -> Import Data -> Vouchers -> select file.
    """
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    sales = db.query(SalesInvoice).filter(SalesInvoice.business_id == business.id).all()

    xml_lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<ENVELOPE>',
        '  <HEADER>',
        '    <TALLYREQUEST>Import Data</TALLYREQUEST>',
        '  </HEADER>',
        '  <BODY>',
        '    <IMPORTDATA>',
        '      <REQUESTDESC>',
        '        <REPORTNAME>Vouchers</REPORTNAME>',
        '        <STATICVARIABLES>',
        f'          <SVCURRENTCOMPANY>{business.name}</SVCURRENTCOMPANY>',
        '        </STATICVARIABLES>',
        '      </REQUESTDESC>',
        '      <REQUESTDATA>',
    ]

    # Purchase Vouchers
    for inv in invoices:
        dt = (inv.invoice_date or inv.created_at.strftime("%Y-%m-%d")).replace("-", "")
        vendor = inv.vendor_name or "Sundry Creditors"
        inv_no = inv.invoice_number or inv.display_id
        amt = float(inv.total_amount or inv.amount or 0.0)
        taxable = float(inv.taxable_amount or (amt / 1.18))
        cgst = float(inv.cgst_amount or 0.0)
        sgst = float(inv.sgst_amount or 0.0)
        igst = float(inv.igst_amount or 0.0)

        xml_lines.extend([
            '        <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'          <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">',
            f'            <DATE>{dt}</DATE>',
            f'            <VOUCHERNUMBER>{inv_no}</VOUCHERNUMBER>',
            f'            <PARTYLEDGERNAME>{vendor}</PARTYLEDGERNAME>',
            f'            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>',
            f'            <BASICBUYERNAME>{business.name}</BASICBUYERNAME>',
            f'            <PARTYGSTIN>{inv.vendor_gstin or ""}</PARTYGSTIN>',
            '            <ALLLEDGERENTRIES.LIST>',
            f'              <LEDGERNAME>{vendor}</LEDGERNAME>',
            '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>',
            f'              <AMOUNT>{amt:.2f}</AMOUNT>',
            '            </ALLLEDGERENTRIES.LIST>',
            '            <ALLLEDGERENTRIES.LIST>',
            '              <LEDGERNAME>GST Purchases @ 18%</LEDGERNAME>',
            '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>',
            f'              <AMOUNT>-{taxable:.2f}</AMOUNT>',
            '            </ALLLEDGERENTRIES.LIST>',
        ])
        if cgst > 0:
            xml_lines.extend([
                '            <ALLLEDGERENTRIES.LIST>',
                '              <LEDGERNAME>Input CGST</LEDGERNAME>',
                '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>',
                f'              <AMOUNT>-{cgst:.2f}</AMOUNT>',
                '            </ALLLEDGERENTRIES.LIST>',
                '            <ALLLEDGERENTRIES.LIST>',
                '              <LEDGERNAME>Input SGST</LEDGERNAME>',
                '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>',
                f'              <AMOUNT>-{sgst:.2f}</AMOUNT>',
                '            </ALLLEDGERENTRIES.LIST>',
            ])
        elif igst > 0:
            xml_lines.extend([
                '            <ALLLEDGERENTRIES.LIST>',
                '              <LEDGERNAME>Input IGST</LEDGERNAME>',
                '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>',
                f'              <AMOUNT>-{igst:.2f}</AMOUNT>',
                '            </ALLLEDGERENTRIES.LIST>',
            ])
        xml_lines.extend([
            '          </VOUCHER>',
            '        </TALLYMESSAGE>',
        ])

    # Sales Vouchers
    for s in sales:
        dt = (s.invoice_date or s.created_at.strftime("%Y-%m-%d")).replace("-", "")
        customer = s.customer_name or "Cash / Sundry Debtors"
        vch_type = "Credit Note" if s.invoice_type == "credit_note" else "Sales"
        amt = float(s.total_amount)
        taxable = float(s.taxable_amount)

        xml_lines.extend([
            '        <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'          <VOUCHER VCHTYPE="{vch_type}" ACTION="Create" OBJVIEW="Invoice Voucher View">',
            f'            <DATE>{dt}</DATE>',
            f'            <VOUCHERNUMBER>{s.invoice_number}</VOUCHERNUMBER>',
            f'            <PARTYLEDGERNAME>{customer}</PARTYLEDGERNAME>',
            f'            <PARTYGSTIN>{s.customer_gstin or ""}</PARTYGSTIN>',
            '            <ALLLEDGERENTRIES.LIST>',
            f'              <LEDGERNAME>{customer}</LEDGERNAME>',
            '              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>',
            f'              <AMOUNT>-{amt:.2f}</AMOUNT>',
            '            </ALLLEDGERENTRIES.LIST>',
            '            <ALLLEDGERENTRIES.LIST>',
            '              <LEDGERNAME>GST Sales Account</LEDGERNAME>',
            '              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>',
            f'              <AMOUNT>{taxable:.2f}</AMOUNT>',
            '            </ALLLEDGERENTRIES.LIST>',
            '          </VOUCHER>',
            '        </TALLYMESSAGE>',
        ])

    xml_lines.extend([
        '      </REQUESTDATA>',
        '    </IMPORTDATA>',
        '  </BODY>',
        '</ENVELOPE>',
    ])

    xml_content = "\n".join(xml_lines)
    filename = f"Tally_Vouchers_{business.gstin}_{period or 'All'}.xml"
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------------------------------------------
# 2. Excel CSV Master Ledger Export
# ----------------------------------------------------
@router.get("/excel/export")
def export_excel_csv(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Invoice ID",
        "Invoice Number",
        "Document Type",
        "Date",
        "Vendor Name",
        "Vendor GSTIN",
        "Taxable Subtotal",
        "CGST",
        "SGST",
        "IGST",
        "Total Tax",
        "Invoice Total",
        "Compliance Status",
        "Locked Status",
        "Paid Status",
    ])

    for inv in invoices:
        writer.writerow([
            inv.display_id,
            inv.invoice_number or "",
            inv.document_type.value if hasattr(inv.document_type, "value") else str(inv.document_type),
            inv.invoice_date or inv.created_at.strftime("%Y-%m-%d"),
            inv.vendor_name or "",
            inv.vendor_gstin or "",
            inv.taxable_amount or "",
            inv.cgst_amount or "",
            inv.sgst_amount or "",
            inv.igst_amount or "",
            inv.total_tax or "",
            inv.total_amount or inv.amount or "",
            inv.status.value if hasattr(inv.status, "value") else str(inv.status),
            "YES" if inv.is_locked else "NO",
            "PAID" if inv.is_paid else "UNPAID",
        ])

    filename = f"GST_Master_Ledger_{business.gstin}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------------------------------------------
# 3. Bulk ZIP Ingestion
# ----------------------------------------------------
@router.post("/bulk-zip")
async def bulk_zip_upload(
    file: UploadFile = File(...),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .zip archive.")

    content = await file.read()
    agent = ManagerAgent()

    extracted_count = 0
    ingested_invoices = []
    zip_bytes = io.BytesIO(content)

    with zipfile.ZipFile(zip_bytes, "r") as z:
        for zinfo in z.infolist():
            if zinfo.is_dir() or zinfo.filename.startswith("__MACOSX"):
                continue
            fname = os.path.basename(zinfo.filename)
            ext = os.path.splitext(fname)[1].lower()
            if ext not in [".pdf", ".png", ".jpg", ".jpeg"]:
                continue

            extracted_count += 1
            # Save to upload dir
            saved_name = f"{uuid.uuid4()}_{fname}"
            dest_path = os.path.join(settings.UPLOAD_DIR, saved_name)
            with z.open(zinfo) as source, open(dest_path, "wb") as target:
                shutil.copyfileobj(source, target)

            # Generate display id
            now_dt = datetime.now()
            display_id = f"BULK-{now_dt.strftime('%y%m')}-{random.randint(1000, 9999)}"

            # Run OCR & AI Pipeline
            try:
                pipeline_result = agent.process_invoice(dest_path)
                score = pipeline_result.compliance_score
                risk = pipeline_result.risk
                status_str = pipeline_result.status

                # Tax calculations
                taxable = pipeline_result.amount
                rate = pipeline_result.tax_rate or 18.0
                total_tax = round((taxable * rate) / 100.0, 2) if taxable else None
                half = round(total_tax / 2.0, 2) if total_tax else None
                grand_tot = round(taxable + total_tax, 2) if taxable and total_tax else taxable

                inv = Invoice(
                    business_id=business.id,
                    display_id=display_id,
                    file_path=dest_path,
                    original_filename=fname,
                    document_type="purchase",
                    status=InvoiceStatus(status_str),
                    risk=RiskLevel(risk),
                    compliance_score=score,
                    invoice_number=pipeline_result.invoice_date or display_id,
                    vendor_name=pipeline_result.vendor_name,
                    vendor_gstin=pipeline_result.vendor_gstin,
                    invoice_date=pipeline_result.invoice_date or now_dt.strftime("%Y-%m-%d"),
                    taxable_amount=taxable,
                    tax_rate=rate,
                    cgst_amount=half,
                    sgst_amount=half,
                    total_tax=total_tax,
                    total_amount=grand_tot,
                    amount=grand_tot,
                    hsn_code=pipeline_result.hsn_code,
                )
                db.add(inv)
                db.flush()

                # Add findings
                for f in pipeline_result.findings:
                    issue = ComplianceIssue(
                        invoice_id=inv.id,
                        title=f.title if hasattr(f, "title") else f.get("title", ""),
                        severity=IssueSeverity(f.severity if hasattr(f, "severity") else f.get("severity", "low")),
                        description=f.description if hasattr(f, "description") else f.get("description", ""),
                        suggestion=f.suggestion if hasattr(f, "suggestion") else f.get("suggestion", ""),
                        rule_reference=f.rule_reference if hasattr(f, "rule_reference") else f.get("rule_reference", ""),
                    )
                    db.add(issue)

                ingested_invoices.append({
                    "id": inv.id,
                    "filename": fname,
                    "vendor": pipeline_result.vendor_name,
                    "amount": grand_tot,
                    "status": status_str,
                })
            except Exception as err:
                print(f"Error processing {fname}: {err}")

    db.commit()
    return {
        "message": f"Bulk ingestion complete. Successfully processed {len(ingested_invoices)} of {extracted_count} invoices.",
        "total_extracted": extracted_count,
        "successfully_ingested": len(ingested_invoices),
        "invoices": ingested_invoices,
    }


# ----------------------------------------------------
# 4. Bank Statement Cross-Reconciliation
# ----------------------------------------------------
@router.post("/bank-reconcile")
async def reconcile_bank_statement(
    file: UploadFile = File(...),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    content = (await file.read()).decode("utf-8", errors="ignore")
    lines = content.splitlines()

    # Unpaid invoices
    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.business_id == business.id,
            Invoice.is_paid == False,
        )
        .all()
    )

    matched = []
    csv_reader = csv.reader(lines)
    for row in csv_reader:
        if not row or len(row) < 2:
            continue
        row_str = " ".join(row).lower()

        for inv in invoices:
            if inv.id in [m["invoice_id"] for m in matched]:
                continue

            inv_amt = float(inv.total_amount or inv.amount or 0.0)
            if inv_amt <= 0:
                continue

            # Check if amount appears in row
            amt_match = False
            for cell in row:
                clean_num = re.sub(r"[^\d.]", "", cell)
                try:
                    val = float(clean_num)
                    if abs(val - inv_amt) < 5.0:
                        amt_match = True
                        break
                except ValueError:
                    pass

            vendor_clean = re.sub(r"[^a-zA-Z]", "", (inv.vendor_name or "").lower())
            vendor_match = vendor_clean[:5] in row_str if len(vendor_clean) >= 5 else True

            if amt_match and vendor_match:
                inv.is_paid = True
                inv.paid_date = datetime.now().strftime("%Y-%m-%d")
                matched.append({
                    "invoice_id": inv.id,
                    "invoice_number": inv.invoice_number or inv.display_id,
                    "vendor_name": inv.vendor_name,
                    "amount": inv_amt,
                    "matched_statement_entry": " ".join(row[:4]),
                })

    db.commit()
    return {
        "message": f"Bank statement reconciliation matched {len(matched)} invoice payout(s). Marked as settled.",
        "matched_count": len(matched),
        "matched_invoices": matched,
    }

