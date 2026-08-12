// Static mock data powering the GST Lite frontend prototype.
// In production this is served by the invoice-parsing pipeline,
// the LangGraph agent system, and the GST compliance engine.

export const business = {
  name: "Ashoka Textiles Pvt. Ltd.",
  gstin: "32AACCA1234F1Z5",
  state: "Kerala",
  scheme: "Regular",
  period: "Jul 2026",
};

export const readiness = {
  score: 78,
  label: "Mostly ready",
  filedLastCycle: true,
  daysToDeadline: 6,
};

export const pipelineStages = [
  { key: "uploaded", label: "Uploaded" },
  { key: "parsed", label: "Parsed" },
  { key: "validated", label: "Validated" },
  { key: "risk", label: "Risk-scored" },
  { key: "filed", label: "Filed" },
];

export const summaryCards = [
  {
    label: "Output tax liability",
    value: "₹1,84,320",
    trend: "+12.4%",
    trendDirection: "up",
    tone: "primary",
  },
  {
    label: "Input tax credit (ITC)",
    value: "₹1,12,860",
    trend: "+3.1%",
    trendDirection: "up",
    tone: "info",
  },
  {
    label: "Net payable",
    value: "₹71,460",
    trend: "-4.8%",
    trendDirection: "down",
    tone: "gold",
  },
  {
    label: "Flagged invoices",
    value: "7",
    trend: "3 high risk",
    trendDirection: "flat",
    tone: "danger",
  },
];

export const invoices = [
  {
    id: "INV-2026-0731",
    vendor: "Kochi Yarns & Fabrics",
    gstin: "32AAECK5678G1Z2",
    date: "2026-07-31",
    amount: 48200,
    taxRate: 12,
    hsn: "5205",
    status: "validated",
    risk: "low",
  },
  {
    id: "INV-2026-0729",
    vendor: "Malabar Dyes Co.",
    gstin: "32AABCM9081H2Z7",
    date: "2026-07-29",
    amount: 132500,
    taxRate: 18,
    hsn: "3204",
    status: "flagged",
    risk: "high",
    issue: "GSTIN mismatch with GSTR-2B",
  },
  {
    id: "INV-2026-0727",
    vendor: "Ernakulam Logistics",
    gstin: "32AACCE4455J1Z9",
    date: "2026-07-27",
    amount: 21750,
    taxRate: 5,
    hsn: "9965",
    status: "parsed",
    risk: "medium",
    issue: "HSN code needs confirmation",
  },
  {
    id: "INV-2026-0724",
    vendor: "Thrissur Packaging Ltd.",
    gstin: "32AADCT2210K1Z3",
    date: "2026-07-24",
    amount: 9840,
    taxRate: 18,
    hsn: "4819",
    status: "validated",
    risk: "low",
  },
  {
    id: "INV-2026-0721",
    vendor: "Calicut Cotton Traders",
    gstin: "32AAFCC7788L1Z6",
    date: "2026-07-21",
    amount: 276400,
    taxRate: 12,
    hsn: "5208",
    status: "flagged",
    risk: "high",
    issue: "Invoice value exceeds e-invoice threshold — IRN missing",
  },
  {
    id: "INV-2026-0718",
    vendor: "Alappuzha Coir Exports",
    gstin: "32AAGCA3344M1Z1",
    date: "2026-07-18",
    amount: 58900,
    taxRate: 5,
    hsn: "5705",
    status: "uploaded",
    risk: "unscored",
  },
];

export const complianceIssues = [
  {
    id: "ISSUE-01",
    title: "GSTIN mismatch with GSTR-2B",
    severity: "high",
    invoiceId: "INV-2026-0729",
    description:
      "The vendor GSTIN on this invoice does not match the GSTIN reflected in your auto-drafted GSTR-2B for this period. ITC on this invoice may be disallowed until it's corrected.",
    suggestion:
      "Ask Malabar Dyes Co. to confirm their GSTIN and re-file the corresponding GSTR-1, or amend the invoice if it was entered incorrectly.",
    rule: "Rule 36(4), CGST Rules",
  },
  {
    id: "ISSUE-02",
    title: "IRN missing on high-value invoice",
    severity: "high",
    invoiceId: "INV-2026-0721",
    description:
      "This invoice is valued above ₹5 crore aggregate turnover threshold for e-invoicing and requires an Invoice Reference Number (IRN). None was found.",
    suggestion:
      "Generate an e-invoice via the IRP before filing, or mark this transaction as exempt if the buyer is unregistered.",
    rule: "Rule 48(4), CGST Rules",
  },
  {
    id: "ISSUE-03",
    title: "HSN code needs confirmation",
    severity: "medium",
    invoiceId: "INV-2026-0727",
    description:
      "The extracted HSN code 9965 (goods transport) was inferred from vendor history rather than read directly off the invoice text.",
    suggestion:
      "Confirm the HSN code against the invoice, or open the document preview to verify the extraction.",
    rule: "Notification 78/2020 – Central Tax",
  },
  {
    id: "ISSUE-04",
    title: "Round-off variance on tax computation",
    severity: "low",
    invoiceId: "INV-2026-0724",
    description:
      "A ₹2 rounding variance was found between the invoice tax total and the recomputed value under Section 170.",
    suggestion: "No action needed — within tolerance and auto-adjusted.",
    rule: "Section 170, CGST Act",
  },
];

export const chatSuggestions = [
  "Why is INV-2026-0729 flagged?",
  "Explain the IRN requirement in simple terms",
  "What happens if I file with flagged invoices?",
  "How is my net payable calculated?",
];

export const chatSeed = [
  {
    role: "assistant",
    content:
      "Hi, I'm your GST advisor. I can explain any flag, rule, or number on your return in plain language. What would you like to look at first?",
  },
];

export const filingTimeline = [
  { label: "GSTR-1 due", date: "11 Aug 2026", status: "upcoming" },
  { label: "GSTR-3B due", date: "20 Aug 2026", status: "upcoming" },
  { label: "Last cycle filed", date: "20 Jul 2026", status: "done" },
];
