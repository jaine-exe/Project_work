import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (on pages > 1)
        if self._pageNumber > 1:
            self.drawString(40, 810, "GSTLite — Verified Platform Architecture & Rule-Engine Performance Report")
            self.drawRightString(555, 810, "TECHNICAL EVALUATION REPORT")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(40, 804, 555, 804)
        
        # Footer (on all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 42, 555, 42)
        
        self.drawString(40, 30, "GSTLite Engine v1.0 • Repo: github.com/jaine-exe/Project_work • Branch: main")
        self.drawRightString(555, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=46,
    )
    
    styles = getSampleStyleSheet()
    
    primary_color = colors.HexColor("#0F172A")    # Deep slate
    brand_blue = colors.HexColor("#1D4ED8")       # Royal blue
    text_dark = colors.HexColor("#1E293B")        # Charcoal
    text_muted = colors.HexColor("#475569")       # Muted slate
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=primary_color,
        spaceAfter=3,
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=brand_blue,
        spaceAfter=6,
    )
    
    meta_style = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=text_muted,
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=brand_blue,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=primary_color,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True,
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=text_dark,
        spaceAfter=5,
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=text_dark,
        leftIndent=10,
        spaceAfter=2.5,
    )
    
    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )
    
    table_header_style = ParagraphStyle(
        'THStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    
    table_cell_style = ParagraphStyle(
        'TDStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=text_dark,
    )
    
    table_cell_bold = ParagraphStyle(
        'TDBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=brand_blue,
    )

    story = []

    # ================= PAGE 1 =================
    banner_content = [
        [Paragraph("<b>GSTLITE PLATFORM ARCHITECTURE & EVALUATION SPECIFICATION</b>", title_style)],
        [Paragraph("<b>AI-Powered Statutory GST Compliance, E-Invoicing & Automated Filing Operating System</b>", subtitle_style)],
        [Paragraph("<b>Repository:</b> github.com/jaine-exe/Project_work • <b>Branch:</b> main • <b>Benchmark Status:</b> Evaluated & Defensible<br/>"
                   "<b>Audience:</b> Academic Evaluators, Chartered Accountants, and Technical Interviewers", meta_style)]
    ]
    banner_table = Table(banner_content, colWidths=[515])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 3),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("1. System Overview & Scope", h1_style))
    story.append(Paragraph(
        "<b>GSTLite</b> is a production-grade statutory compliance platform designed for Indian businesses and tax practitioners. "
        "The system addresses primary failure modes under Indian Goods and Services Tax law: ineligible Input Tax Credit (ITC) "
        "under <b>Section 17(5)</b>, supplier filing defaults under <b>Section 16(2)(aa)</b>, mandatory 180-day ITC reversal under <b>Rule 37</b>, "
        "Place of Supply tax type misrouting, and government-format GSTR-1/3B return generation.",
        body_style
    ))
    
    status_box_data = [[
        Paragraph(
            "<b>EVALUATION INTEGRITY STATEMENT</b><br/>"
            "This report distinguishes strictly between empirically benchmarked results and planned features:<br/>"
            "• <b>Measured & Defensible:</b> The rule-based compliance engine has been formally benchmarked on 150 synthetic invoice records with injected defects, achieving 100% precision and recall at 0.022 ms latency.<br/>"
            "• <b>Planned Evaluation:</b> End-to-end OCR character accuracy on degraded physical scans and AI advisor RAG retrieval grounding are scheduled for empirical measurement on real-world paper corpuses.",
            table_cell_style
        )
    ]]
    status_table = Table(status_box_data, colWidths=[515])
    status_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#3B82F6")),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(status_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. Full Technology Stack", h1_style))
    tech_data = [
        [Paragraph("Layer", table_header_style), Paragraph("Framework / Technologies", table_header_style), Paragraph("Technical Responsibility", table_header_style)],
        [
            Paragraph("<b>Frontend UI/UX</b>", table_cell_bold),
            Paragraph("Next.js 16.3.0, React 19.2.8, Tailwind CSS v4", table_cell_style),
            Paragraph("App Router with responsive navigation drawer, dark/light contrast tokens, and interactive audit ledgers.", table_cell_style)
        ],
        [
            Paragraph("<b>Backend API</b>", table_cell_bold),
            Paragraph("FastAPI 0.115.0, Uvicorn 0.30.6, Python 3.11+", table_cell_style),
            Paragraph("Asynchronous ASGI endpoints, Pydantic v2 data models, and auto-generated OpenAPI documentation.", table_cell_style)
        ],
        [
            Paragraph("<b>Database & ORM</b>", table_cell_bold),
            Paragraph("SQLAlchemy 2.0.35, SQLite (PostgreSQL Ready)", table_cell_style),
            Paragraph("Relational schema with declarative models, isolated tenant filtering by business_id, and dynamic pool handling.", table_cell_style)
        ],
        [
            Paragraph("<b>Security & Auth</b>", table_cell_bold),
            Paragraph("Passlib (Bcrypt 1.7.4), Python-Jose (JWT 3.3.0)", table_cell_style),
            Paragraph("Cryptographic JWT bearer session tokens, salted password hashing, and role-based route dependencies.", table_cell_style)
        ],
        [
            Paragraph("<b>OCR & Ingestion</b>", table_cell_bold),
            Paragraph("PyTesseract 0.3.13, Pillow 10.4, pdf2image 1.17, ReportLab 5.0", table_cell_style),
            Paragraph("Document parsing from PDFs and image scans, regex entity extractor, and PDF invoice generation.", table_cell_style)
        ],
        [
            Paragraph("<b>Statutory Protocols</b>", table_cell_bold),
            Paragraph("GSTN JSON v3.1.2, Tally Prime XML, Mod-36 Checksum", table_cell_style),
            Paragraph("Official GSTR-3B/1 offline JSON generators, native Tally `<ENVELOPE>` voucher export, and deep-link alerts.", table_cell_style)
        ],
    ]
    tech_table = Table(tech_data, colWidths=[95, 175, 245])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. End-to-End Workflow Architecture", h1_style))
    pipeline_steps = [
        ("Inward Invoice Ingestion", "Upload purchase bills individually or via bulk ZIP archives. Automated OCR parses GSTIN, date, and tax values."),
        ("Statutory Audit Engine", "Evaluates Section 17(5) blocked goods (vehicles, catering), checks Place of Supply CGST/SGST vs IGST, and flags unpaid bills > 180 days."),
        ("GSTR-2B Cross-Reconciliation", "Matches internal purchase records against government GSTR-2B data, calculating vendor risk ratings and identifying missing bills."),
        ("1-Click Vendor Follow-Up", "Generates pre-formatted WhatsApp and email notices citing Section 16(2)(aa) to follow up on unfiled supplier invoices."),
        ("Sales Invoicing & E-Invoicing", "B2B/B2C billing engine generates 64-hex SHA-256 IRNs, signed QR strings, and 12-digit E-Way bills with transit validity."),
        ("Statutory Return Filing & Lock", "Computes Net Tax Payable, exports official GSTR-3B and GSTR-1 (v3.1.2) offline JSONs, and stamps a 15-char ARN filing lock."),
        ("Accounting & Banking Sync", "Exports native Tally Prime XML vouchers (Alt + O import) and reconciles bank statement payouts to mark invoices as PAID."),
    ]
    for title, desc in pipeline_steps:
        story.append(Paragraph(f"<b>• {title}:</b> {desc}", bullet_style))

    # ================= PAGE 2 =================
    story.append(PageBreak())

    story.append(Paragraph("4. Application Workspace Modules & Route Directory", h1_style))
    story.append(Paragraph(
        "The application provides 9 core workspace sections plus multi-tenant entity management:",
        body_style
    ))

    module_data = [
        [Paragraph("Module / Route", table_header_style), Paragraph("Source Files", table_header_style), Paragraph("Key Features & Functionality", table_header_style)],
        [
            Paragraph("<b>1. Dashboard</b><br/><code>/dashboard</code>", table_cell_bold),
            Paragraph("<code>dashboard/page.js</code><br/><code>invoices.py</code>", table_cell_style),
            Paragraph("Real-time compliance health score (0-100), risk tier counters (Clean, Medium, High), claimed ITC KPI widgets, and recent invoice audit feed.", table_cell_style)
        ],
        [
            Paragraph("<b>2. Sales & E-Invoicing</b><br/><code>/invoicing</code>", table_cell_bold),
            Paragraph("<code>invoicing/page.js</code><br/><code>invoicing.py</code>", table_cell_style),
            Paragraph("B2B/B2C sales billing, auto-tax routing, 64-hex SHA-256 IRN hash with signed QR code, 12-digit E-Way bill generation, and printable tax invoice viewer.", table_cell_style)
        ],
        [
            Paragraph("<b>3. Upload Invoices</b><br/><code>/upload</code>", table_cell_bold),
            Paragraph("<code>upload/page.js</code><br/><code>ocr_service.py</code>", table_cell_style),
            Paragraph("Multi-format drag-and-drop dropzone (.pdf, .png, .jpg), Tesseract OCR text parsing, and immediate statutory compliance risk scoring.", table_cell_style)
        ],
        [
            Paragraph("<b>4. Compliance & ITC</b><br/><code>/compliance</code>", table_cell_bold),
            Paragraph("<code>compliance/page.js</code><br/><code>compliance_engine.py</code>", table_cell_style),
            Paragraph("Section 17(5) blocked ITC detector (vehicles, food, personal expenses), Place of Supply (PoS) validator, and Section 16(2) 180-day Rule 37 interest tracker.", table_cell_style)
        ],
        [
            Paragraph("<b>5. GST Summary</b><br/><code>/gst-summary</code>", table_cell_bold),
            Paragraph("<code>gst-summary/page.js</code><br/><code>returns.py</code>", table_cell_style),
            Paragraph("Output liability vs ITC matrix, official GSTR-3B offline JSON, GSTR-1 v3.1.2 utility JSON, 15-char ARN filing lock, and GSP OTP portal API sandbox.", table_cell_style)
        ],
        [
            Paragraph("<b>6. Vendor Scorecard</b><br/><code>/vendors</code>", table_cell_bold),
            Paragraph("<code>vendors/page.js</code><br/><code>vendors.py</code>", table_cell_style),
            Paragraph("Vendor compliance ratings (Green ≥90%, Amber 60-89%, Red <60%), missing 2B bills action center, and 1-click WhatsApp (wa.me) & email statutory notices.", table_cell_style)
        ],
        [
            Paragraph("<b>7. ERP & Tally Sync</b><br/><code>/integrations</code>", table_cell_bold),
            Paragraph("<code>integrations/page.js</code><br/><code>integrations.py</code>", table_cell_style),
            Paragraph("1-click Tally Prime XML export (Alt+O voucher import), CA master CSV ledger, bulk ZIP invoice batch processor, and bank statement CSV reconciler.", table_cell_style)
        ],
        [
            Paragraph("<b>8. Notice Desk & Cash</b><br/><code>/notices</code>", table_cell_bold),
            Paragraph("<code>notices/page.js</code><br/><code>notices.py</code>", table_cell_style),
            Paragraph("10-day advance tax cash forecast before monthly 20th deadline, department scrutiny tracker (ASMT-10, DRC-01, SCN), and AI legal defense drafter citing CGST law.", table_cell_style)
        ],
        [
            Paragraph("<b>9. AI Advisor</b><br/><code>/chat</code>", table_cell_bold),
            Paragraph("<code>chat/page.js</code><br/><code>chat.py</code>", table_cell_style),
            Paragraph("Interactive conversational GST legal copilot connected to live company invoice data with suggested query pills and HSN lookup assistance.", table_cell_style)
        ],
        [
            Paragraph("<b>10. Entity Switcher</b><br/><code>Sidebar Footer</code>", table_cell_bold),
            Paragraph("<code>Sidebar.js</code><br/><code>auth.py</code>", table_cell_style),
            Paragraph("Multi-tenant business switcher toggling active branch/GSTIN context (e.g. Maharashtra vs Karnataka) with full data isolation.", table_cell_style)
        ],
    ]
    module_table = Table(module_data, colWidths=[95, 125, 295])
    module_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(module_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("5. Quick Start & Execution Guide", h1_style))
    run_instructions = [
        [Paragraph("Component", table_header_style), Paragraph("Start Command & Working Directory", table_header_style), Paragraph("Access URL / Credentials", table_header_style)],
        [
            Paragraph("<b>Backend API</b>", table_cell_bold),
            Paragraph("<code>cd gstlite-backend</code><br/><code>.\\venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000</code>", code_style),
            Paragraph("<b>URL:</b> http://127.0.0.1:8000<br/><b>API Docs:</b> http://127.0.0.1:8000/docs", table_cell_style)
        ],
        [
            Paragraph("<b>Frontend Web</b>", table_cell_bold),
            Paragraph("<code>cd gstlite1</code><br/><code>npm run dev</code>", code_style),
            Paragraph("<b>URL:</b> http://localhost:3000<br/>(Next.js 16 Dev Server)", table_cell_style)
        ],
        [
            Paragraph("<b>Demo Accounts</b>", table_cell_bold),
            Paragraph("Available via 1-click quick login buttons on the <code>/login</code> page.", table_cell_style),
            Paragraph("<b>Primary:</b> demo@gstlite.in / Demo@1234<br/><b>CA Auditor:</b> ca@gstlite.in / CA@1234<br/><b>MSME:</b> msme@gstlite.in / MSME@1234", table_cell_style)
        ],
    ]
    run_table = Table(run_instructions, colWidths=[90, 245, 180])
    run_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 4.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(run_table)

    # ================= PAGE 3 =================
    story.append(PageBreak())

    story.append(Paragraph("6. Empirical Rule-Engine Benchmark (150-Invoice Evaluation)", h1_style))
    story.append(Paragraph(
        "The compliance rule engine was formally evaluated using the test script <code>evaluate_gstlite.py</code> on an annotated "
        "synthetic dataset of <b>N = 150 invoices</b> (seed = 42, defect rate = 40%). Ground-truth defects were programmatically injected "
        "across six core statutory categories to evaluate classification accuracy, per-defect recall, and processing latency.",
        body_style
    ))

    # Confusion matrix & metrics
    eval_matrix_data = [
        [Paragraph("Metric", table_header_style), Paragraph("Measured Value", table_header_style), Paragraph("Mathematical Formulation & Interpretation", table_header_style)],
        [
            Paragraph("<b>Confusion Matrix</b>", table_cell_bold),
            Paragraph("<b>TP: 56, FN: 0<br/>FP: 0, TN: 94</b>", table_cell_style),
            Paragraph("Total: 150 invoices (56 defective, 94 clean). Zero false positives ($FP=0$), zero false negatives ($FN=0$).", table_cell_style)
        ],
        [
            Paragraph("<b>Accuracy</b>", table_cell_bold),
            Paragraph("<b>100.00%</b>", table_cell_style),
            Paragraph("$(TP + TN) / (TP + TN + FP + FN) = 150 / 150 = 1.00$. Overall classification correctness.", table_cell_style)
        ],
        [
            Paragraph("<b>Precision</b>", table_cell_bold),
            Paragraph("<b>100.00%</b>", table_cell_style),
            Paragraph("$TP / (TP + FP) = 56 / 56 = 1.00$. Probability that a flagged invoice has a true statutory violation.", table_cell_style)
        ],
        [
            Paragraph("<b>Recall / Sensitivity</b>", table_cell_bold),
            Paragraph("<b>100.00%</b>", table_cell_style),
            Paragraph("$TP / (TP + FN) = 56 / 56 = 1.00$. Proportion of defective invoices successfully detected.", table_cell_style)
        ],
        [
            Paragraph("<b>Specificity</b>", table_cell_bold),
            Paragraph("<b>100.00%</b>", table_cell_style),
            Paragraph("$TN / (TN + FP) = 94 / 94 = 1.00$. Proportion of clean invoices correctly cleared.", table_cell_style)
        ],
        [
            Paragraph("<b>False Positive Rate</b>", table_cell_bold),
            Paragraph("<b>0.00%</b>", table_cell_style),
            Paragraph("$FP / (FP + TN) = 0 / 94 = 0.00$. Rate of false alarms on legitimate compliant invoices.", table_cell_style)
        ],
        [
            Paragraph("<b>F1-Score</b>", table_cell_bold),
            Paragraph("<b>100.00%</b>", table_cell_style),
            Paragraph("$2 \\times (P \\times R) / (P + R) = 2.0 / 2.0 = 1.00$. Harmonic mean of precision and recall.", table_cell_style)
        ],
    ]
    eval_matrix_table = Table(eval_matrix_data, colWidths=[105, 95, 315])
    eval_matrix_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(eval_matrix_table)
    story.append(Spacer(1, 8))

    # Per defect table
    story.append(Paragraph("<b>Category-Wise Defect Recall Breakdown:</b>", h2_style))
    defect_table_data = [
        [Paragraph("Defect Category", table_header_style), Paragraph("Statutory Reference", table_header_style), Paragraph("Detected / Total", table_header_style), Paragraph("Recall (%)", table_header_style), Paragraph("Error Type Simulated", table_header_style)],
        [
            Paragraph("<b>BLOCKED_ITC</b>", table_cell_bold),
            Paragraph("CGST Section 17(5)", table_cell_style),
            Paragraph("4 / 4", table_cell_style),
            Paragraph("<b>100.0%</b>", table_cell_style),
            Paragraph("Ineligible motor vehicles, catering, personal goods.", table_cell_style)
        ],
        [
            Paragraph("<b>BAD_GSTIN</b>", table_cell_bold),
            Paragraph("CGST Section 25 & Mod-36", table_cell_style),
            Paragraph("15 / 15", table_cell_style),
            Paragraph("<b>100.0%</b>", table_cell_style),
            Paragraph("Alphanumeric syntax & Mod-36 checksum corruption.", table_cell_style)
        ],
        [
            Paragraph("<b>POS_ERROR</b>", table_cell_bold),
            Paragraph("IGST Section 7 & 8", table_cell_style),
            Paragraph("4 / 4", table_cell_style),
            Paragraph("<b>100.0%</b>", table_cell_style),
            Paragraph("Inter-state supplies mischarged with CGST/SGST.", table_cell_style)
        ],
        [
            Paragraph("<b>TAX_MATH</b>", table_cell_bold),
            Paragraph("CGST Section 33", table_cell_style),
            Paragraph("8 / 8", table_cell_style),
            Paragraph("<b>100.0%</b>", table_cell_style),
            Paragraph("Arithmetic mismatch: Taxable + Taxes ≠ Total.", table_cell_style)
        ],
        [
            Paragraph("<b>DUPLICATE</b>", table_cell_bold),
            Paragraph("CGST Section 16 & Audit", table_cell_style),
            Paragraph("17 / 17", table_cell_style),
            Paragraph("<b>100.0%</b>", table_cell_style),
            Paragraph("Duplicate invoice number from same vendor.", table_cell_style)
        ],
        [
            Paragraph("<b>RULE37</b>", table_cell_bold),
            Paragraph("CGST Section 16(2) Proviso", table_cell_style),
            Paragraph("8 / 8", table_cell_style),
            Paragraph("<b>100.0%</b>", table_cell_style),
            Paragraph("Unpaid supplier invoices older than 180 days.", table_cell_style)
        ],
    ]
    defect_table = Table(defect_table_data, colWidths=[85, 105, 65, 55, 205])
    defect_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(defect_table)
    story.append(Spacer(1, 8))

    # Latency & Academic Conclusion
    story.append(Paragraph("<b>Measured Latency & Throughput:</b>", h2_style))
    story.append(Paragraph(
        "• <b>Mean Evaluation Latency:</b> 0.022 ms per invoice record.<br/>"
        "• <b>95th Percentile Latency (p95):</b> 0.032 ms.<br/>"
        "• <b>Engine Computational Throughput:</b> ~44,795 invoices / second.<br/>"
        "• <b>Reproducibility Command:</b> <code>python evaluate_gstlite.py -n 150 --seed 42</code> (outputs saved to <code>eval_output/</code>).",
        bullet_style
    ))
    story.append(Spacer(1, 6))

    conclusion_box_data = [[
        Paragraph(
            "<b>EVALUATION CONCLUSION & FUTURE SCOPE</b><br/>"
            "<i>\"On a reproducible 150-invoice synthetic benchmark (seed 42), the GSTLite rule engine detected all 56 injected defects "
            "across six statutory categories with no false positives, at an average latency of 0.022 ms per invoice. "
            "OCR character extraction accuracy, AI advisor retrieval grounding, and human time savings are planned for empirical evaluation on physical scanned invoice corpuses.\"</i>",
            table_cell_style
        )
    ]]
    conclusion_table = Table(conclusion_box_data, colWidths=[515])
    conclusion_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#0F172A")),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(conclusion_table)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF: {filename}")

if __name__ == '__main__':
    target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "GSTLite_Master_Project_Context.pdf")
    build_pdf(target)
