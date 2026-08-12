"use client";

import { useEffect, useState, Fragment } from "react";
import Topbar from "@/components/Topbar";
import StatusPill from "@/components/StatusPill";
import { gst as gstApi, invoices as invoicesApi, auth as authApi } from "@/lib/api";
import { Download, FileCheck2, ChevronDown, Loader2 } from "lucide-react";

const CURRENT_PERIOD = "2026-07"; // TODO: replace with a real period picker

export default function GstSummaryPage() {
  const [expanded, setExpanded] = useState(null);
  const [summary, setSummary] = useState(null);
  const [invoiceList, setInvoiceList] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading state for a new fetch
    setLoading(true);
    setError("");

    Promise.all([
      gstApi.summary(CURRENT_PERIOD),
      invoicesApi.list(),
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
  }, []);

  async function handleGenerateReturn() {
    setGenerating(true);
    setGenerateError("");
    try {
      await gstApi.generateReturn(CURRENT_PERIOD, "GSTR-3B");
      alert("Return generated successfully. File it from the returns list once you're ready.");
    } catch (err) {
      setGenerateError(err.message || "Couldn't generate the return");
    } finally {
      setGenerating(false);
    }
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
        subtitle={`${CURRENT_PERIOD} · ${business?.scheme || "Regular"} scheme · ${business?.state || ""}`}
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
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                    style={{ background: "var(--surface-sunken)", color: "var(--ink)" }}
                  >
                    <Download size={16} />
                    Export summary (PDF)
                  </button>
                </div>
              </div>

              {/* Invoice ledger */}
              <div className="card lg:col-span-2 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <h3 className="font-display font-bold text-[15px]">Invoice ledger</h3>
                  <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                    {invoiceList.length} invoices this period
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
                          <th className="text-left font-medium px-3 py-2.5 text-xs">HSN</th>
                          <th className="text-right font-medium px-3 py-2.5 text-xs">Amount</th>
                          <th className="text-right font-medium px-3 py-2.5 text-xs">Rate</th>
                          <th className="text-left font-medium px-5 py-2.5 text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceList.map((inv) => (
                          <Fragment key={inv.id}>
                            <tr
                              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
                              className="cursor-pointer"
                              style={{ borderTop: "1px solid var(--border-soft)" }}
                            >
                              <td className="px-5 py-3">
                                <span className="flex items-center gap-1.5 font-mono-data text-xs" style={{ color: "var(--ink)" }}>
                                  <ChevronDown
                                    size={13}
                                    style={{
                                      color: "var(--ink-faint)",
                                      transform: expanded === inv.id ? "rotate(180deg)" : "none",
                                      transition: "transform 0.2s",
                                    }}
                                  />
                                  {inv.display_id}
                                </span>
                              </td>
                              <td className="px-3 py-3 font-mono-data text-xs" style={{ color: "var(--ink-soft)" }}>
                                {inv.hsn_code || "—"}
                              </td>
                              <td className="px-3 py-3 text-right font-mono-data" style={{ color: "var(--ink)" }}>
                                {inv.amount ? `₹${inv.amount.toLocaleString("en-IN")}` : "—"}
                              </td>
                              <td className="px-3 py-3 text-right" style={{ color: "var(--ink)" }}>
                                {inv.tax_rate != null ? `${inv.tax_rate}%` : "—"}
                              </td>
                              <td className="px-5 py-3">
                                <StatusPill tone={inv.status} />
                              </td>
                            </tr>
                            {expanded === inv.id && (
                              <tr style={{ background: "var(--surface-sunken)" }}>
                                <td colSpan={5} className="px-5 py-3.5 text-xs" style={{ color: "var(--ink-soft)" }}>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Vendor</p>
                                      <p className="font-medium mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.vendor_name || "Not extracted"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Vendor GSTIN</p>
                                      <p className="font-mono-data mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.vendor_gstin || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Invoice date</p>
                                      <p className="font-medium mt-0.5" style={{ color: "var(--ink)" }}>
                                        {inv.invoice_date || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ color: "var(--ink-faint)" }}>Risk</p>
                                      <div className="mt-0.5">
                                        <StatusPill tone={inv.risk} />
                                      </div>
                                    </div>
                                  </div>
                                  {inv.issues.length > 0 && (
                                    <div className="mt-3 flex flex-col gap-1">
                                      {inv.issues.map((issue) => (
                                        <p key={issue.id} style={{ color: "var(--danger)" }}>
                                          ⚠ {issue.title}
                                        </p>
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
    </div>
  );
}
