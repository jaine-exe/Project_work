import os
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

OUTPUT_DIR = r"c:\Users\Jaine S Thomas\Downloads\gstlite1-connected\demo_files_alan_thomas"
os.makedirs(OUTPUT_DIR, exist_ok=True)

styles = getSampleStyleSheet()

# Color Palette
NAVY = colors.HexColor("#0F172A")
EMERALD = colors.HexColor("#065F46")
EMERALD_LIGHT = colors.HexColor("#ECFDF5")
GRAY_BG = colors.HexColor("#F8FAFC")
BORDER_COLOR = colors.HexColor("#CBD5E1")
TEXT_MUTED = colors.HexColor("#64748B")
CRIMSON = colors.HexColor("#991B1B")

title_style = ParagraphStyle(
    "TitleStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=18,
    leading=22,
    textColor=NAVY,
)

subtitle_style = ParagraphStyle(
    "SubtitleStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=9,
    leading=12,
    textColor=TEXT_MUTED,
)

header_bold = ParagraphStyle(
    "HeaderBold",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=12,
    textColor=NAVY,
)

body_style = ParagraphStyle(
    "BodyStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.5,
    leading=11,
    textColor=NAVY,
)

th_style = ParagraphStyle(
    "THStyle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=colors.white,
)

td_style = ParagraphStyle(
    "TDStyle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8,
    leading=10,
    textColor=NAVY,
)

td_bold = ParagraphStyle(
    "TDBold",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=NAVY,
)


def create_invoice_pdf(
    filename: str,
    invoice_title: str,
    invoice_num: str,
    invoice_date: str,
    seller_name: str,
    seller_gstin: str,
    seller_address: str,
    buyer_name: str,
    buyer_gstin: str,
    buyer_address: str,
    items: list,
    cgst_rate: float,
    sgst_rate: float,
    igst_rate: float,
    irn: str = None,
    badge_text: str = None,
    badge_color: colors.Color = EMERALD,
):
    filepath = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    story = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph(f"<b>{invoice_title}</b>", title_style),
            Paragraph(f"<b>STATUS: {badge_text or 'TAX INVOICE'}</b>", ParagraphStyle("Badge", parent=header_bold, textColor=badge_color, alignment=2)),
        ]
    ]
    story.append(Table(header_data, colWidths=[350, 170]))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=EMERALD, spaceBefore=0, spaceAfter=10))

    # 2. Invoice Meta Table
    meta_data = [
        [
            Paragraph("<b>Invoice No:</b>", header_bold),
            Paragraph(invoice_num, body_style),
            Paragraph("<b>Invoice Date:</b>", header_bold),
            Paragraph(invoice_date, body_style),
        ],
        [
            Paragraph("<b>Place of Supply:</b>", header_bold),
            Paragraph("Kerala (State Code 32)", body_style),
            Paragraph("<b>Reverse Charge:</b>", header_bold),
            Paragraph("No", body_style),
        ]
    ]
    if irn:
        meta_data.append([
            Paragraph("<b>IRN (E-Invoice):</b>", header_bold),
            Paragraph(f"<font size=6 color='#065F46'>{irn}</font>", body_style),
            Paragraph("<b>Ack Date:</b>", header_bold),
            Paragraph(invoice_date, body_style),
        ])

    meta_table = Table(meta_data, colWidths=[90, 180, 80, 170])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), GRAY_BG),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 3. Seller & Buyer Details
    parties_data = [
        [
            Paragraph("<b>SUPPLIER (BILL FROM):</b>", header_bold),
            Paragraph("<b>RECIPIENT (BILL TO):</b>", header_bold),
        ],
        [
            Paragraph(
                f"<b>{seller_name}</b><br/>"
                f"GSTIN: <b><font color='#065F46'>{seller_gstin}</font></b><br/>"
                f"{seller_address}",
                body_style
            ),
            Paragraph(
                f"<b>{buyer_name}</b><br/>"
                f"GSTIN: <b><font color='#065F46'>{buyer_gstin}</font></b><br/>"
                f"{buyer_address}",
                body_style
            ),
        ]
    ]
    parties_table = Table(parties_data, colWidths=[260, 260])
    parties_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(parties_table)
    story.append(Spacer(1, 12))

    # 4. Itemized Table
    item_rows = [
        [
            Paragraph("Sl", th_style),
            Paragraph("Description of Goods / Services", th_style),
            Paragraph("HSN/SAC", th_style),
            Paragraph("Qty", th_style),
            Paragraph("Rate (Rs. )", th_style),
            Paragraph("Taxable (Rs. )", th_style),
        ]
    ]

    total_taxable = 0.0
    for idx, item in enumerate(items, 1):
        taxable = item["qty"] * item["rate"]
        total_taxable += taxable
        item_rows.append([
            Paragraph(str(idx), td_style),
            Paragraph(item["desc"], td_style),
            Paragraph(item["hsn"], td_style),
            Paragraph(f"{item['qty']} {item.get('unit', 'Nos')}", td_style),
            Paragraph(f"Rs. {item['rate']:,.2f}", td_style),
            Paragraph(f"Rs. {taxable:,.2f}", td_bold),
        ])

    item_table = Table(item_rows, colWidths=[25, 220, 65, 50, 75, 85])
    item_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAY_BG]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(item_table)
    story.append(Spacer(1, 8))

    # 5. Calculation Summary & Tax Split Table
    cgst_amt = total_taxable * (cgst_rate / 100.0) if cgst_rate > 0 else 0.0
    sgst_amt = total_taxable * (sgst_rate / 100.0) if sgst_rate > 0 else 0.0
    igst_amt = total_taxable * (igst_rate / 100.0) if igst_rate > 0 else 0.0
    total_tax = cgst_amt + sgst_amt + igst_amt
    grand_total = total_taxable + total_tax

    calc_data = [
        [Paragraph("<b>Subtotal (Taxable Value):</b>", td_style), Paragraph(f"<b>Rs. {total_taxable:,.2f}</b>", td_bold)],
    ]
    if cgst_rate > 0:
        calc_data.append([Paragraph(f"Central GST (CGST @ {cgst_rate}%):", td_style), Paragraph(f"Rs. {cgst_amt:,.2f}", td_style)])
    if sgst_rate > 0:
        calc_data.append([Paragraph(f"State GST (SGST @ {sgst_rate}%):", td_style), Paragraph(f"Rs. {sgst_amt:,.2f}", td_style)])
    if igst_rate > 0:
        calc_data.append([Paragraph(f"Integrated GST (IGST @ {igst_rate}%):", td_style), Paragraph(f"Rs. {igst_amt:,.2f}", td_style)])

    calc_data.extend([
        [Paragraph("<b>Total Tax Amount:</b>", td_style), Paragraph(f"<b>Rs. {total_tax:,.2f}</b>", td_bold)],
        [Paragraph("<b>TOTAL INVOICE VALUE:</b>", td_bold), Paragraph(f"<font color='#065F46'><b>Rs. {grand_total:,.2f}</b></font>", td_bold)],
    ])

    calc_table = Table(calc_data, colWidths=[360, 160])
    calc_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), GRAY_BG),
            ("BACKGROUND", (0, -1), (-1, -1), EMERALD_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(calc_table)
    story.append(Spacer(1, 14))

    # 6. Declarations & QR Placeholder
    footer_text = (
        "<b>Statutory Declaration:</b> We declare that this invoice shows the actual price of the goods or services described "
        "and that all particulars are true and correct. Input tax credit is claimable subject to provisions of Section 16 & Rule 36(4) of the CGST Act, 2017."
    )
    story.append(Paragraph(footer_text, ParagraphStyle("Footer", parent=body_style, fontSize=7, leading=9, textColor=TEXT_MUTED)))

    doc.build(story)
    print(f"Generated: {filename}")


# --------------------------------------------------------------------------
# 1. Purchase Invoice 01: Matched in GSTR-2B (Malabar Dyes)
# --------------------------------------------------------------------------
create_invoice_pdf(
    filename="Purchase_01_MalabarDyes_MATCHED.pdf",
    invoice_title="TAX INVOICE (INWARD PURCHASE)",
    invoice_num="INV-2026-0729",
    invoice_date="2026-08-10",
    seller_name="Malabar Dyes & Chemical Co.",
    seller_gstin="32AACCA1234F1Z5",
    seller_address="Plot 14, Industrial Estate, Kalamassery, Kochi, Kerala - 683104",
    buyer_name="Alan Enterprises Pvt Ltd",
    buyer_gstin="32AAECS1234F1Z5",
    buyer_address="Door No. 44/12B, M.G. Road, Ernakulam, Kerala - 682016",
    items=[
        {"desc": "Industrial Grade Organic Solvent 50L Drum", "hsn": "320411", "qty": 10, "rate": 3500.0, "unit": "Drums"},
        {"desc": "Polymer Stabilizing Additive A-Grade", "hsn": "381239", "qty": 5, "rate": 3000.0, "unit": "Cans"},
    ],
    cgst_rate=9.0,
    sgst_rate=9.0,
    igst_rate=0.0,
    badge_text="2B MATCHED (ELIGIBLE ITC)",
    badge_color=EMERALD,
)

# --------------------------------------------------------------------------
# 2. Purchase Invoice 02: Mismatched GSTIN (Apex Tech Hardware)
# --------------------------------------------------------------------------
create_invoice_pdf(
    filename="Purchase_02_ApexTech_MISMATCHED_GSTIN.pdf",
    invoice_title="TAX INVOICE (INWARD PURCHASE)",
    invoice_num="INV-2026-0842",
    invoice_date="2026-08-15",
    seller_name="Apex Tech Hardware Solutions Pvt. Ltd.",
    seller_gstin="32ABCDE9999F1Z0",  # MISMATCH! Actual GSTIN is 32ABCDE1234F1Z5
    seller_address="Technopark Phase II, Trivandrum, Kerala - 695581",
    buyer_name="Alan Enterprises Pvt Ltd",
    buyer_gstin="32AAECS1234F1Z5",
    buyer_address="Door No. 44/12B, M.G. Road, Ernakulam, Kerala - 682016",
    items=[
        {"desc": "42U Industrial Server Rack Enclosure", "hsn": "851770", "qty": 2, "rate": 20000.0, "unit": "Units"},
        {"desc": "Gigabit 24-Port Managed PoE Switch", "hsn": "851762", "qty": 2, "rate": 10000.0, "unit": "Units"},
    ],
    cgst_rate=9.0,
    sgst_rate=9.0,
    igst_rate=0.0,
    badge_text="RISK: GSTIN MISMATCH (RULE 36(4))",
    badge_color=CRIMSON,
)

# --------------------------------------------------------------------------
# 3. Purchase Invoice 03: Interstate IGST (Mysore Timber Works)
# --------------------------------------------------------------------------
create_invoice_pdf(
    filename="Purchase_03_MysoreTimber_INTERSTATE_IGST.pdf",
    invoice_title="TAX INVOICE (INTERSTATE PURCHASE)",
    invoice_num="MTW/26-27/0318",
    invoice_date="2026-08-18",
    seller_name="Mysore Timber Works",
    seller_gstin="29AABFM3345L1Z2",  # Karnataka (State Code 29)
    seller_address="Hunsur Road Industrial Zone, Mysore, Karnataka - 570018",
    buyer_name="Alan Enterprises Pvt Ltd",
    buyer_gstin="32AAECS1234F1Z5",  # Kerala (State Code 32)
    buyer_address="Door No. 44/12B, M.G. Road, Ernakulam, Kerala - 682016",
    items=[
        {"desc": "Seasoned Teak Timber Structural Planks", "hsn": "440711", "qty": 40, "rate": 1600.0, "unit": "Sq.Ft"},
        {"desc": "Hardwood Moulded Paneling Sections", "hsn": "440929", "qty": 20, "rate": 1000.0, "unit": "Lengths"},
    ],
    cgst_rate=0.0,
    sgst_rate=0.0,
    igst_rate=18.0,
    badge_text="2B MATCHED (IGST ELIGIBLE)",
    badge_color=EMERALD,
)

# --------------------------------------------------------------------------
# 4. Purchase Invoice 04: Blocked ITC under Section 17(5) (Kochi Motors)
# --------------------------------------------------------------------------
create_invoice_pdf(
    filename="Purchase_04_KochiMotors_BLOCKED_ITC_17_5.pdf",
    invoice_title="TAX INVOICE (PASSENGER MOTOR VEHICLE)",
    invoice_num="KMH-2026-1102",
    invoice_date="2026-08-20",
    seller_name="Kochi Auto Hub Pvt Ltd",
    seller_gstin="32AABCK9988D1Z4",
    seller_address="NH-66 Bypass, Kundannoor, Kochi, Kerala - 682304",
    buyer_name="Alan Enterprises Pvt Ltd",
    buyer_gstin="32AAECS1234F1Z5",
    buyer_address="Door No. 44/12B, M.G. Road, Ernakulam, Kerala - 682016",
    items=[
        {"desc": "Corporate Executive Passenger Sedan 1500cc", "hsn": "870322", "qty": 1, "rate": 120000.0, "unit": "Unit"},
    ],
    cgst_rate=9.0,
    sgst_rate=9.0,
    igst_rate=0.0,
    badge_text="BLOCKED ITC: SECTION 17(5)",
    badge_color=CRIMSON,
)

# --------------------------------------------------------------------------
# 5. Sales Invoice 01: E-Invoice with IRN (Alan Enterprises -> Cochin Builders)
# --------------------------------------------------------------------------
create_invoice_pdf(
    filename="Sales_01_CochinBuilders_EINVOICE.pdf",
    invoice_title="GST TAX INVOICE (E-INVOICING COMPLIANT)",
    invoice_num="ALAN-SALES-2026-001",
    invoice_date="2026-08-22",
    seller_name="Alan Enterprises Pvt Ltd",
    seller_gstin="32AAECS1234F1Z5",
    seller_address="Door No. 44/12B, M.G. Road, Ernakulam, Kerala - 682016",
    buyer_name="Cochin Builders Ltd",
    buyer_gstin="32AABCB4321A1Z1",
    buyer_address="Seaport-Airport Road, Kakkanad, Kochi, Kerala - 682030",
    items=[
        {"desc": "Heavy Duty Architectural Structural Fixtures", "hsn": "830241", "qty": 50, "rate": 2000.0, "unit": "Sets"},
        {"desc": "Stainless Steel Grade-316 Anchor Fasteners", "hsn": "731815", "qty": 100, "rate": 500.0, "unit": "Boxes"},
    ],
    cgst_rate=9.0,
    sgst_rate=9.0,
    igst_rate=0.0,
    irn="4e72a819b5c2d3e4f5061728394a5b6c7d8e9f0123456789abcdef0123456789",
    badge_text="OFFICIAL E-INVOICE GENERATED",
    badge_color=EMERALD,
)

# --------------------------------------------------------------------------
# 6. Sales Invoice 02: B2B Outward Supply (Alan Enterprises -> Calicut Retail)
# --------------------------------------------------------------------------
create_invoice_pdf(
    filename="Sales_02_CalicutRetail_B2B.pdf",
    invoice_title="GST TAX INVOICE (OUTWARD SUPPLY)",
    invoice_num="ALAN-SALES-2026-002",
    invoice_date="2026-08-25",
    seller_name="Alan Enterprises Pvt Ltd",
    seller_gstin="32AAECS1234F1Z5",
    seller_address="Door No. 44/12B, M.G. Road, Ernakulam, Kerala - 682016",
    buyer_name="Calicut Retail Enterprises",
    buyer_gstin="32AADCC5566K1Z9",
    buyer_address="Bank Road, Mananchira, Kozhikode, Kerala - 673001",
    items=[
        {"desc": "Modular Steel Retail Display Shelving Unit", "hsn": "732690", "qty": 16, "rate": 5000.0, "unit": "Racks"},
    ],
    cgst_rate=9.0,
    sgst_rate=9.0,
    igst_rate=0.0,
    badge_text="OUTWARD TAXABLE SUPPLY",
    badge_color=NAVY,
)

# --------------------------------------------------------------------------
# 7. Official GSTR-2B JSON for Alan Enterprises (Period: August 2026)
# --------------------------------------------------------------------------
gstr2b_payload = {
    "gstin": "32AAECS1234F1Z5",
    "fp": "082026",
    "generation_date": "2026-08-14",
    "b2b": [
        {
            "ctin": "32AACCA1234F1Z5",
            "trdnm": "Malabar Dyes & Chemical Co.",
            "sup_type": "Regular",
            "inv": [
                {
                    "inum": "INV-2026-0729",
                    "idt": "2026-08-10",
                    "val": 59000.0,
                    "itcavl": "Y",
                    "pos": "32",
                    "items": [
                        {
                            "num": 1,
                            "itm_det": {
                                "txval": 50000.0,
                                "rt": 18.0,
                                "camt": 4500.0,
                                "samt": 4500.0,
                                "iamt": 0.0,
                                "csamt": 0.0
                            }
                        }
                    ]
                }
            ]
        },
        {
            "ctin": "29AABFM3345L1Z2",
            "trdnm": "Mysore Timber Works",
            "sup_type": "Regular",
            "inv": [
                {
                    "inum": "MTW/26-27/0318",
                    "idt": "2026-08-18",
                    "val": 99120.0,
                    "itcavl": "Y",
                    "pos": "32",
                    "items": [
                        {
                            "num": 1,
                            "itm_det": {
                                "txval": 84000.0,
                                "rt": 18.0,
                                "camt": 0.0,
                                "samt": 0.0,
                                "iamt": 15120.0,
                                "csamt": 0.0
                            }
                        }
                    ]
                }
            ]
        },
        {
            "ctin": "32AAECS9876P1Z3",
            "trdnm": "Southern Steel Tubes Ltd.",
            "sup_type": "Regular",
            "inv": [
                {
                    "inum": "SST-2026-441",
                    "idt": "2026-08-08",
                    "val": 41300.0,
                    "itcavl": "Y",
                    "pos": "32",
                    "items": [
                        {
                            "num": 1,
                            "itm_det": {
                                "txval": 35000.0,
                                "rt": 18.0,
                                "camt": 3150.0,
                                "samt": 3150.0,
                                "iamt": 0.0,
                                "csamt": 0.0
                            }
                        }
                    ]
                }
            ]
        }
    ]
}

json_path = os.path.join(OUTPUT_DIR, "GSTR2B_AlanEnterprises_32AAECS1234F1Z5_August2026.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(gstr2b_payload, f, indent=2)

print(f"Generated GSTR-2B JSON: {json_path}")

