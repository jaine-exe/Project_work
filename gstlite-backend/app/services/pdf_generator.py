import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.db.models import Business, Invoice


def generate_gst_summary_pdf(
    business: Business,
    period: str,
    summary_data: dict,
    invoices: list[Invoice],
) -> bytes:
    """
    Generates a professional GST Compliance & Tax Summary PDF statement.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_primary = colors.HexColor("#065F46")  # Emerald dark
    brand_navy = colors.HexColor("#0F172A")
    brand_gold = colors.HexColor("#B45309")
    text_muted = colors.HexColor("#64748B")
    border_color = colors.HexColor("#CBD5E1")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=brand_primary,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=text_muted,
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=brand_navy,
    )
    normal_text = ParagraphStyle(
        "NormalText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=brand_navy,
    )
    bold_text = ParagraphStyle(
        "BoldText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=brand_navy,
    )
    metric_label = ParagraphStyle(
        "MetricLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=text_muted,
    )
    metric_val = ParagraphStyle(
        "MetricValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=brand_navy,
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=brand_navy,
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=brand_navy,
    )

    story = []

    # 1. Header
    story.append(Paragraph("GSTLite — Compliance & Tax Summary", title_style))
    gen_time = datetime.now().strftime("%d %B %Y, %I:%M %p")
    story.append(
        Paragraph(
            f"Filing Period: <b>{period.upper()}</b> &nbsp;|&nbsp; Generated: {gen_time} &nbsp;|&nbsp; Official Tax Summary Statement",
            subtitle_style,
        )
    )
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_primary, spaceBefore=0, spaceAfter=14))

    # 2. Taxpayer Details Table
    biz_info_data = [
        [
            Paragraph("<b>Taxpayer / Entity:</b>", bold_text),
            Paragraph(business.name or "N/A", normal_text),
            Paragraph("<b>GSTIN:</b>", bold_text),
            Paragraph(f"<font color='#065F46'><b>{business.gstin or 'N/A'}</b></font>", normal_text),
        ],
        [
            Paragraph("<b>State / Jurisdiction:</b>", bold_text),
            Paragraph(business.state or "N/A", normal_text),
            Paragraph("<b>Tax Scheme:</b>", bold_text),
            Paragraph(f"{(business.scheme or 'Regular').capitalize()} Taxpayer", normal_text),
        ],
    ]
    biz_table = Table(biz_info_data, colWidths=[110, 150, 80, 180])
    biz_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(biz_table)
    story.append(Spacer(1, 14))

    # 3. Key Financial Metrics Box (4 cards)
    out_tax = summary_data.get("output_tax_liability", 0.0)
    itc = summary_data.get("input_tax_credit", 0.0)
    net_payable = summary_data.get("net_payable", 0.0)
    flagged_cnt = summary_data.get("flagged_invoice_count", 0)

    metrics_data = [
        [
            Paragraph("OUTPUT TAX LIABILITY", metric_label),
            Paragraph("INPUT TAX CREDIT (ITC)", metric_label),
            Paragraph("NET TAX PAYABLE", metric_label),
            Paragraph("FLAGGED INVOICES", metric_label),
        ],
        [
            Paragraph(f"Rs. {out_tax:,.2f}", metric_val),
            Paragraph(f"Rs. {itc:,.2f}", metric_val),
            Paragraph(f"Rs. {net_payable:,.2f}", metric_val),
            Paragraph(
                f"<font color='{'#DC2626' if flagged_cnt > 0 else '#16A34A'}'>{flagged_cnt}</font>",
                metric_val,
            ),
        ],
    ]
    metrics_table = Table(metrics_data, colWidths=[130, 130, 130, 130])
    metrics_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
                ("BOX", (0, 0), (-1, -1), 1, brand_primary),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBF7D0")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(metrics_table)
    story.append(Spacer(1, 16))

    # 4. Tax Rate Breakdown Table
    story.append(Paragraph("1. GST Tax Rate Breakdown", section_title))
    story.append(Spacer(1, 6))

    slabs = summary_data.get("tax_slabs", [])
    slab_rows = [
        [
            Paragraph("GST Rate (%)", table_header),
            Paragraph("Taxable Amount (Rs.)", table_header),
            Paragraph("CGST / SGST Split", table_header),
            Paragraph("Total Tax Amount (Rs.)", table_header),
        ]
    ]

    total_taxable = 0.0
    total_tax_sum = 0.0

    if slabs:
        for s in slabs:
            rate = s.get("rate", 0.0)
            t_val = s.get("taxable_value", 0.0)
            t_amt = s.get("tax_amount", 0.0)
            total_taxable += t_val
            total_tax_sum += t_amt
            half_tax = t_amt / 2.0
            split_desc = f"CGST: {half_tax:,.2f} | SGST: {half_tax:,.2f}"
            slab_rows.append(
                [
                    Paragraph(f"<b>{rate:.1f}%</b>", table_cell_bold),
                    Paragraph(f"Rs. {t_val:,.2f}", table_cell),
                    Paragraph(split_desc, table_cell),
                    Paragraph(f"Rs. {t_amt:,.2f}", table_cell_bold),
                ]
            )
        # Total row
        slab_rows.append(
            [
                Paragraph("<b>Total</b>", table_cell_bold),
                Paragraph(f"<b>Rs. {total_taxable:,.2f}</b>", table_cell_bold),
                Paragraph("—", table_cell),
                Paragraph(f"<b>Rs. {total_tax_sum:,.2f}</b>", table_cell_bold),
            ]
        )
    else:
        slab_rows.append(
            [
                Paragraph("No invoices", table_cell),
                Paragraph("Rs. 0.00", table_cell),
                Paragraph("—", table_cell),
                Paragraph("Rs. 0.00", table_cell),
            ]
        )

    slab_table = Table(slab_rows, colWidths=[90, 140, 160, 130])
    slab_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), brand_navy),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F8FAFC")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(slab_table)
    story.append(Spacer(1, 16))

    # 5. Invoice Ledger Register Table
    story.append(
        Paragraph(
            f"2. Invoice Register ({len(invoices)} Invoices in {period.upper()})",
            section_title,
        )
    )
    story.append(Spacer(1, 6))

    inv_headers = [
        Paragraph("Invoice ID", table_header),
        Paragraph("Type", table_header),
        Paragraph("Date", table_header),
        Paragraph("Vendor / Party", table_header),
        Paragraph("Vendor GSTIN", table_header),
        Paragraph("Amount (Rs.)", table_header),
        Paragraph("Rate", table_header),
        Paragraph("Status", table_header),
    ]
    inv_rows = [inv_headers]

    for inv in invoices[:50]:  # Cap at 50 to maintain compact PDF size
        doc_type = getattr(inv, "document_type", "purchase")
        doc_type_str = "Sales" if str(doc_type).lower().endswith("sales") else "Purchase"
        status_color = "#16A34A" if str(inv.status.value) == "validated" else ("#DC2626" if str(inv.status.value) == "flagged" else "#475569")
        amt_val = getattr(inv, "total_amount", None) or inv.amount
        amt_str = f"Rs. {amt_val:,.2f}" if amt_val else "—"
        rate_str = f"{inv.tax_rate:.1f}%" if inv.tax_rate is not None else "—"

        inv_num_text = inv.invoice_number or inv.display_id or "—"
        if inv.invoice_number and inv.display_id:
            inv_num_text = f"<b>{inv.invoice_number}</b><br/><font color='#64748B' size=6>{inv.display_id}</font>"
        else:
            inv_num_text = f"<b>{inv_num_text}</b>"

        inv_rows.append(
            [
                Paragraph(inv_num_text, table_cell),
                Paragraph(doc_type_str, table_cell),
                Paragraph(str(inv.invoice_date or inv.created_at.strftime("%Y-%m-%d")), table_cell),
                Paragraph((inv.vendor_name or "—")[:20], table_cell),
                Paragraph(inv.vendor_gstin or "—", table_cell),
                Paragraph(amt_str, table_cell),
                Paragraph(rate_str, table_cell),
                Paragraph(f"<font color='{status_color}'><b>{inv.status.value.capitalize()}</b></font>", table_cell),
            ]
        )

    if not invoices:
        inv_rows.append(
            [Paragraph("No invoices recorded for this period.", table_cell)] + [Paragraph("—", table_cell)] * 7
        )

    inv_table = Table(inv_rows, colWidths=[65, 45, 55, 110, 100, 65, 35, 45])
    inv_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), brand_navy),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(inv_table)
    story.append(Spacer(1, 16))

    # 6. Compliance Certification Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=0, spaceAfter=8))
    cert_text = (
        "<b>Certification & Compliance Note:</b> This document is an automated tax reconciliation summary prepared by "
        "GSTLite AI Copilot. Output Tax Liability is calculated from outward supplies (Sales), and Input Tax Credit (ITC) "
        "is verified against inward supplies (Purchases) adhering to CGST Section 16 & Rule 36(4) provisions."
    )
    story.append(Paragraph(cert_text, ParagraphStyle("Cert", parent=normal_text, fontSize=7, leading=10, textColor=text_muted)))

    doc.build(story)
    return buffer.getvalue()
