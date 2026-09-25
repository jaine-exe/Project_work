"use client";

import { useEffect, useState, Fragment } from "react";
import Topbar from "@/components/Topbar";
import PeriodSelector, { formatPeriodName } from "@/components/PeriodSelector";
import StatusPill from "@/components/StatusPill";
import InvoiceReviewModal from "@/components/InvoiceReviewModal";
import { gst as gstApi, invoices as invoicesApi, auth as authApi } from "@/lib/api";
import { Download, FileCheck2, ChevronDown, Loader2, Edit3, Eye } from "lucide-react";

export default function GstSummaryPage() {
  const [periods, setPeriods] = useState(["2026-08", "2026-07", "2026-06"]);
  const [selectedPeriod, setSelectedPeriod] = useState("2026-08");
  const [expanded, setExpanded] = useState(null);
  const [summary, setSummary] = useState(null);
  const [invoiceList, setInvoiceList] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");
  const [reviewInvoice, setReviewInvoice] = useState(null);

  useEffect(() => {
    gstApi.periods()
      .then((res) => {
        if (res?.periods?.length) {
          setPeriods(res.periods);
          if (res.default) {
            setSelectedPeriod(res.default);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPeriod) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      gstApi.summary(selectedPeriod),
      invoicesApi.list(selectedPeriod),
      authApi.me(),
    ])
      .then(([summaryData, invoicesData, me]) => {
        if (cancelled) return;
        setSummary(summaryData);
        setInvoiceList(invoicesData.invoices);
        setBusiness(me.business);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load GST summary");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod]);

  async function handleGenerateReturn() {
    setGenerating(true);
    setGenerateError("");
    try {
      await gstApi.generateReturn(selectedPeriod, "GSTR-3B");
      alert("Return generated successfully. File it from the returns list once you're ready.");
    } catch (err) {
      setGenerateError(err.message || "Couldn't generate the return");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setExportError("");
    try {
      await gstApi.downloadSummaryPdf(selectedPeriod);
    } catch (err) {
      setExportError(err.message || "Failed to export PDF summary");
    } finally {
      setExportingPdf(false);
    }
  }

  function handleInvoiceUpdated(updated) {
    setInvoiceList((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    gstApi.summary(selectedPeriod).then(setSummary).catch(() => {});
  }

  const cards = summary
    ? [
        { label: "Output tax liability", value: `₹${summary.output_tax_liability.toLocaleString("en-IN")}` },
        { label: "Input tax credit (ITC)", value: `₹${summary.input_tax_credit.toLocaleString("en-IN")}` },
        { label: "Net payable", value: `₹${summary.net_payable.toLocaleString("en-IN")}` },
        { label: "Flagged invoices", value: String(summary.flagged_invoice_count) },
      ]
    : [];

  const totalTax = summary?.tax_slabs.reduce((a, s) => a + s.tax_amount, 0) || 0;

  return (
    <div>
      <Topbar
        title="GST summary"
        subtitle={`${formatPeriodName(selectedPeriod)} · ${business?.scheme || "Regular"} scheme · ${business?.state || ""}`}
        action={
          <PeriodSelector
            periods={periods}
            selectedPeriod={selectedPeriod}
            onChange={setSelectedPeriod}
          />
        }
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {loading && (
          <div className="card p-10 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--ink-faint)" }} />
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Loading GST summary…
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="card p-5" style={{ background: "var(--danger-light)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error} — is the backend running at{" "}
              {process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}?
            </p>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {cards.map((c) => (
                <div key={c.label} className="card p-5">
                  <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
                    {c.label}
                  </p>
                  <p className="font-display text-2xl font-bold mt-2" style={{ color: "var(--ink)" }}>
                    {c.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Tax rate breakdown */}
              <div className="card p-5 lg:col-span-1">
                <h3 className="font-display font-bold text-[15px] mb-4">Tax rate breakdown</h3>
                {summary.tax_slabs.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                    No validated invoices yet this period.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {summary.tax_slabs.map((slab) => {
                      const pct = totalTax > 0 ? Math.round((slab.tax_amount / totalTax) * 100) : 0;
                      return (
                        <div key={slab.rate}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="font-medium" style={{ color: "var(--ink)" }}>
                              GST {slab.rate}%
                            </span>
                            <span className="font-mono-data text-xs" style={{ color: "var(--ink-soft)" }}>
                              ₹{slab.tax_amount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="h-2 rounded-full w-full" style={{ background: "var(--surface-sunken)" }}>
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${pct}%`, background: "var(--primary)" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 pt-5 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border-soft)" }}>
                  {generateError && (
                    <p className="text-xs mb-1" style={{ color: "var(--danger)" }}>
                      {generateError}
                    </p>
                  )}
                  <button
                    onClick={handleGenerateReturn}
                    disabled={generating}
                    className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--primary)" }}
                  >
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
                    {generating ? "Generating…" : "Generate GSTR-3B"}
                  </button>
                  {exportError && (
                    <p className="text-xs mb-1" style={{ color: "var(--danger)" }}>
                      {exportError}
                    </p>
                  )}
                  <button
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                    className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60 cursor-pointer"
                    style={{ background: "var(--surface-sunken)", color: "var(--ink)" }}
                  >
                    {exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {exportingPdf ? "Generating PDF…" : "Export summary (PDF)"}
                  </button>
                </div>
              </div>

              {/* Invoice ledger */}
              <div className="card lg:col-span-2 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <h3 className="font-display font-bold text-[15px]">Invoice ledger</h3>
                  <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                    {invoiceList.length} invoices {selectedPeriod === "all" ? "across all periods" : `for ${formatPeriodName(selectedPeriod)}`}
                  </span>
                </div>
                {invoiceList.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                      No invoices uploaded yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ color: "var(--ink-faint)" }}>
                          <th className="text-left font-medium px-5 py-2.5 text-xs">Invoice</th>
                          <th className="text-left font-medium px-3 py-2.5 text-xs">Type</th>
                          <th className="text-left font-medium px-3 py-2.5 text-xs">HSN</th>
                          <th className="text-right font-medium px-3 py-2.5 text-xs">Amount</th>
                          <th className="text-right font-medium px-3 py-2.5 text-xs">Rate</th>
                          <th className="text-left font-medium px-5 py-2.5 text-xs">Status</th>
                          <th className="text-right font-medium px-4 py-2.5 text-xs">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceList.map((inv) => (
                          <Fragment key={inv.id}>
                            <tr
                              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
                              className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                              style={{ borderTop: "1px solid var(--border-soft)" }}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5 font-mono-data text-xs" style={{ color: "var(--ink)" }}>
                                  <ChevronDown
                                    size={13}
                                    style={{
                                      color: "var(--ink-faint)",
                                      transform: expanded === inv.id ? "rotate(180deg)" : "none",
                                      transition: "transform 0.2s",
                                    }}
                                  />
                                  <span className="font-bold">{inv.invoice_number || inv.display_id}</span>
                                  {inv.invoice_number && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-normal" style={{ background: "var(--surface-sunken)", color: "var(--ink-soft)" }}>
                                      {inv.display_id}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                                  style={{
                                    background: inv.document_type === "sales" ? "var(--warning-light)" : "var(--primary-light)",
                                    color: inv.document_type === "sales" ? "var(--warning)" : "var(--primary)",
                                  }}
                                >
                                  {inv.document_type === "sales" ? "Sales" : "Purchase"}
                                </span>
                              </td>
                              <td className="px-3 py-3 font-mono-data text-xs" style={{ color: "var(--ink-soft)" }}>
                                {inv.hsn_code || "—"}
                              </td>
                              <td className="px-3 py-3 text-right font-mono-data" style={{ color: "var(--ink)" }}>
                                {(inv.total_amount || inv.amount) ? `₹${(inv.total_amount || inv.amount).toLocaleString("en-IN")}` : "—"}
                              </td>
                              <td className="px-3 py-3 text-right" style={{ color: "var(--ink)" }}>
                                {inv.tax_rate != null ? `${inv.tax_rate}%` : "—"}
                              </td>
                              <td className="px-5 py-3">
                                <StatusPill tone={inv.status} />
                              </td>
                              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setReviewInvoice(inv)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border hover:bg-slate-100 transition-colors"
                                  style={{ borderColor: "var(--border)", color: "var(--primary)" }}
                                >
                                  <Edit3 size={12} />
                                  Review & Edit
                                </button>
                              </td>
                            </tr>
                            {expanded === inv.id && (
                              <tr style={{ background: "var(--surface-sunken)" }}>
                                <td colSpan={7} className="px-5 py-3.5 text-xs" style={{ color: "var(--ink-soft)" }}>
                                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                        Invoice Record Inspection
                                      </span>
                                      {inv.original_filename && (
                                        <span className="text-xs text-slate-400 font-mono-data">({inv.original_filename})</span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setReviewInvoice(inv)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity shadow-sm cursor-pointer"
                                      style={{ background: "var(--primary)" }}
                                    >
                                      <Eye size={13} />
                                      View Document & Edit Fields
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Original Invoice No</p>
                                      <p className="font-semibold mt-0.5 font-mono-data" style={{ color: "var(--ink)" }}>
                                        {inv.invoice_number || inv.display_id}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Vendor</p>
                                      <p className="font-medium mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.vendor_name || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Vendor GSTIN</p>
                                      <p className="font-mono-data mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.vendor_gstin || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Billed To (Buyer)</p>
                                      <p className="font-medium mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.buyer_name || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Invoice Date</p>
                                      <p className="font-medium mt-0.5 font-mono-data" style={{ color: "var(--ink)" }}>
                                        {inv.invoice_date || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Taxable Subtotal</p>
                                      <p className="font-semibold mt-0.5 font-mono-data" style={{ color: "var(--ink)" }}>
                                        {inv.taxable_amount ? `₹${inv.taxable_amount.toLocaleString("en-IN")}` : (inv.amount ? `₹${inv.amount.toLocaleString("en-IN")}` : "—")}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>CGST / SGST / IGST</p>
                                      <p className="font-mono-data mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.cgst_amount ? `CGST: ₹${inv.cgst_amount.toLocaleString("en-IN")}` : ""}
                                        {inv.sgst_amount ? ` · SGST: ₹${inv.sgst_amount.toLocaleString("en-IN")}` : ""}
                                        {inv.igst_amount ? ` · IGST: ₹${inv.igst_amount.toLocaleString("en-IN")}` : ""}
                                        {!inv.cgst_amount && !inv.sgst_amount && !inv.igst_amount && "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Total Invoice Value</p>
                                      <p className="font-bold mt-0.5 font-mono-data" style={{ color: "var(--primary)" }}>
                                        {(inv.total_amount || inv.amount) ? `₹${(inv.total_amount || inv.amount).toLocaleString("en-IN")}` : "—"}
                                      </p>
                                    </div>
                                  </div>
                                  {inv.issues.length > 0 && (
                                    <div className="mt-3 flex flex-col gap-1.5 pt-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
                                      {inv.issues.map((issue) => (
                                        <div key={issue.id} className="p-2 rounded flex items-start gap-2" style={{ background: issue.severity === "high" ? "var(--danger-light)" : "var(--warning-light)" }}>
                                          <span style={{ color: issue.severity === "high" ? "var(--danger)" : "var(--warning)" }}>⚠</span>
                                          <div>
                                            <p className="font-semibold" style={{ color: issue.severity === "high" ? "var(--danger)" : "var(--warning)" }}>
                                              {issue.title}
                                            </p>
                                            <p className="text-[11px] mt-0.5" style={{ color: "var(--ink)" }}>
                                              {issue.description}
                                            </p>
                                            {issue.suggestion && (
                                              <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                                                <b>Fix:</b> {issue.suggestion}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <InvoiceReviewModal
        invoice={reviewInvoice}
        isOpen={Boolean(reviewInvoice)}
        onClose={() => setReviewInvoice(null)}
        onSaveSuccess={handleInvoiceUpdated}
      />
    </div>
  );
}
