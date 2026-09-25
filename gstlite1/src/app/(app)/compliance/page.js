"use client";

import { useEffect, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import StatusPill from "@/components/StatusPill";
import { compliance as complianceApi } from "@/lib/api";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ArrowRight,
  Scale,
  Loader2,
  CheckCircle2,
  FileCheck2,
  Upload,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";

const SEVERITY_META = {
  high: { icon: AlertOctagon, color: "var(--danger)", label: "High" },
  medium: { icon: AlertTriangle, color: "var(--warning)", label: "Medium" },
  low: { icon: Info, color: "var(--info)", label: "Low" },
};

const FILTERS = ["all", "high", "medium", "low"];

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState("issues"); // "issues" | "reconciliation"
  const [filter, setFilter] = useState("all");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // GSTR-2B State
  const [recData, setRecData] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recFilter, setRecFilter] = useState("all"); // "all" | "matched" | "missing_2b" | "mismatched" | "missing_books"
  const [uploading2B, setUploading2B] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const fileInputRef = useRef(null);

  // Load Rule Checks
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    complianceApi
      .issues(filter)
      .then((data) => {
        if (!cancelled) setIssues(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load compliance issues");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  // Load GSTR-2B Reconciliation Report
  async function fetchReconciliation() {
    setRecLoading(true);
    try {
      const data = await complianceApi.reconciliation("2026-07");
      setRecData(data);
    } catch (err) {
      console.warn("Could not fetch reconciliation data:", err);
    } finally {
      setRecLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "reconciliation" && !recData) {
      fetchReconciliation();
    }
  }, [activeTab, recData]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading2B(true);
    setActionNotice("");
    try {
      const res = await complianceApi.upload2b(file, "2026-07");
      setActionNotice(res.message || "GSTR-2B ingested successfully!");
      await fetchReconciliation();
      // Also refresh compliance issues as 2B warnings may have auto-resolved
      const updatedIssues = await complianceApi.issues(filter);
      setIssues(updatedIssues);
    } catch (err) {
      alert(err.message || "Failed to parse GSTR-2B JSON");
    } finally {
      setUploading2B(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSeedDemo() {
    setUploading2B(true);
    setActionNotice("");
    try {
      const res = await complianceApi.seedDemo2b("2026-07");
      setActionNotice(res.message || "Loaded sample GSTR-2B dataset.");
      await fetchReconciliation();
      const updatedIssues = await complianceApi.issues(filter);
      setIssues(updatedIssues);
    } catch (err) {
      alert(err.message || "Could not seed demo data");
    } finally {
      setUploading2B(false);
    }
  }

  const counts = {
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
  };

  const recSummary = recData?.summary || {
    matched_count: 0,
    matched_itc: 0,
    missing_in_2b_count: 0,
    missing_in_2b_itc: 0,
    mismatched_count: 0,
    missing_in_books_count: 0,
    missing_in_books_itc: 0,
    reconciliation_rate: 0,
    has_2b_data: false,
  };

  // Filtered rows for 2B Table
  const allRows = [
    ...(recData?.matched || []).map((r) => ({ ...r, category: "matched" })),
    ...(recData?.mismatched || []).map((r) => ({ ...r, category: "mismatched" })),
    ...(recData?.missing_in_2b || []).map((r) => ({ ...r, category: "missing_2b" })),
    ...(recData?.missing_in_books || []).map((r) => ({ ...r, category: "missing_books" })),
  ];

  const filteredRecRows = allRows.filter((r) => {
    if (recFilter === "all") return true;
    return r.category === recFilter;
  });

  return (
    <div>
      <Topbar
        title="Compliance & Reconciliation"
        subtitle="Rule validation checks and live GSTR-2B ITC cross-matching"
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b pb-1" style={{ borderColor: "var(--border-soft)" }}>
          <button
            onClick={() => setActiveTab("issues")}
            className={`flex items-center gap-2 pb-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
              activeTab === "issues"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <AlertOctagon size={16} />
            Rule Checks & Flags ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab("reconciliation")}
            className={`flex items-center gap-2 pb-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
              activeTab === "reconciliation"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <FileSpreadsheet size={16} />
            GSTR-2B Reconciliation
            {recSummary.has_2b_data && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700 font-bold">
                {recSummary.reconciliation_rate}%
              </span>
            )}
          </button>
        </div>

        {/* ================= TAB 1: RULE CHECKS & FLAGS ================= */}
        {activeTab === "issues" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-4 max-w-xl">
              {Object.entries(counts).map(([sev, count]) => {
                const meta = SEVERITY_META[sev];
                const Icon = meta.icon;
                return (
                  <div key={sev} className="card p-4 flex items-center gap-3">
                    <span
                      className="flex items-center justify-center rounded-full w-9 h-9 shrink-0"
                      style={{ background: `color-mix(in srgb, ${meta.color} 14%, white)` }}
                    >
                      <Icon size={16} style={{ color: meta.color }} />
                    </span>
                    <div>
                      <p className="font-display text-lg font-bold leading-none">{count}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                        {meta.label} severity
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: filter === f ? "var(--primary)" : "var(--surface)",
                    color: filter === f ? "white" : "var(--ink-soft)",
                    border: filter === f ? "1px solid var(--primary)" : "1px solid var(--border)",
                  }}
                >
                  {f === "all" ? "All issues" : f}
                </button>
              ))}
            </div>

            {loading && (
              <div className="card p-10 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: "var(--ink-faint)" }} />
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  Loading compliance issues…
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

            {!loading && !error && (
              <div className="flex flex-col gap-4">
                {issues.map((issue) => {
                  const meta = SEVERITY_META[issue.severity];
                  const Icon = meta.icon;
                  return (
                    <div key={issue.id} className="card p-5 animate-fade-up">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-start gap-3">
                          <span
                            className="flex items-center justify-center rounded-full w-9 h-9 shrink-0 mt-0.5"
                            style={{ background: `color-mix(in srgb, ${meta.color} 14%, white)` }}
                          >
                            <Icon size={16} style={{ color: meta.color }} />
                          </span>
                          <div>
                            <h3 className="font-display font-bold text-[15px]">{issue.title}</h3>
                          </div>
                        </div>
                        <StatusPill tone={issue.severity}>{meta.label} risk</StatusPill>
                      </div>

                      <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--ink)" }}>
                        {issue.description}
                      </p>

                      <div
                        className="rounded-lg p-3.5 mb-3 flex items-start gap-2.5"
                        style={{ background: "var(--primary-light)" }}
                      >
                        <ArrowRight size={15} className="mt-0.5 shrink-0" style={{ color: "var(--primary-dark)" }} />
                        <p className="text-sm" style={{ color: "var(--primary-dark)" }}>
                          <span className="font-semibold">Suggested fix — </span>
                          {issue.suggestion}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ink-faint)" }}>
                          <Scale size={13} />
                          {issue.rule_reference}
                        </p>
                        <Link
                          href="/chat"
                          className="text-xs font-semibold flex items-center gap-1"
                          style={{ color: "var(--primary)" }}
                        >
                          Ask AI advisor <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {issues.length === 0 && (
                  <div className="card p-10 text-center">
                    <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                      No issues at this severity. Upload some invoices to see compliance checks run.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: GSTR-2B RECONCILIATION ================= */}
        {activeTab === "reconciliation" && (
          <div className="flex flex-col gap-6 animate-fade-up">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card p-4">
              <div>
                <h3 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                  GSTR-2B Auto-Reconciliation Engine
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                  Cross-check purchase bills against auto-drafted ITC statements under Rule 36(4) & Section 16(2)(aa).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading2B}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {uploading2B ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Upload GSTR-2B JSON
                </button>
                <button
                  onClick={handleSeedDemo}
                  disabled={uploading2B}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-emerald-50"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
                  title="Generate sample GSTR-2B records matched to current invoices"
                >
                  <Sparkles size={13} style={{ color: "var(--primary)" }} />
                  Load Sample 2B
                </button>
              </div>
            </div>

            {actionNotice && (
              <div className="card p-3 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 size={15} />
                {actionNotice}
              </div>
            )}

            {/* Reconciliation Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Rate */}
              <div className="card p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium" style={{ color: "var(--ink-soft)" }}>Match Rate</span>
                  <FileCheck2 size={15} style={{ color: "var(--primary)" }} />
                </div>
                <p className="font-display font-bold text-2xl" style={{ color: "var(--ink)" }}>
                  {recSummary.reconciliation_rate}%
                </p>
                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${recSummary.reconciliation_rate}%`,
                      background: recSummary.reconciliation_rate >= 80 ? "var(--success)" : "var(--warning)",
                    }}
                  />
                </div>
                <p className="text-[11px] mt-1.5 text-gray-500">
                  {recSummary.matched_count} of {recSummary.total_purchase_invoices} invoices verified
                </p>
              </div>

              {/* Card 2: Matched ITC */}
              <div className="card p-4 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-emerald-700">Eligible Matched ITC</span>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                </div>
                <p className="font-display font-bold text-2xl text-emerald-800">
                  ₹{recSummary.matched_itc.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  {recSummary.matched_count} invoices safe to claim in GSTR-3B
                </p>
              </div>

              {/* Card 3: Missing in 2B (Blocked ITC) */}
              <div className="card p-4 border-l-4 border-l-red-500">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-red-700">Rule 36(4) Blocked ITC</span>
                  <AlertOctagon size={15} className="text-red-600" />
                </div>
                <p className="font-display font-bold text-2xl text-red-800">
                  ₹{recSummary.missing_in_2b_itc.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-red-600 mt-1">
                  {recSummary.missing_in_2b_count} bills not reported by suppliers
                </p>
              </div>

              {/* Card 4: Unclaimed in Books */}
              <div className="card p-4 border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-blue-700">Available in 2B (Unclaimed)</span>
                  <Info size={15} className="text-blue-600" />
                </div>
                <p className="font-display font-bold text-2xl text-blue-800">
                  ₹{recSummary.missing_in_books_itc.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-blue-600 mt-1">
                  {recSummary.missing_in_books_count} supplier bills missing in your books
                </p>
              </div>
            </div>

            {/* Reconciliation Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button
                onClick={() => setRecFilter("all")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  recFilter === "all" ? "bg-[var(--primary)] text-white" : "card text-gray-700"
                }`}
              >
                All Entries ({allRows.length})
              </button>
              <button
                onClick={() => setRecFilter("matched")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  recFilter === "matched" ? "bg-emerald-600 text-white" : "card text-gray-700"
                }`}
              >
                Matched ({recSummary.matched_count})
              </button>
              <button
                onClick={() => setRecFilter("missing_2b")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  recFilter === "missing_2b" ? "bg-red-600 text-white" : "card text-gray-700"
                }`}
              >
                Missing in 2B ({recSummary.missing_in_2b_count})
              </button>
              <button
                onClick={() => setRecFilter("mismatched")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  recFilter === "mismatched" ? "bg-amber-600 text-white" : "card text-gray-700"
                }`}
              >
                Value Variance ({recSummary.mismatched_count})
              </button>
              <button
                onClick={() => setRecFilter("missing_books")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  recFilter === "missing_books" ? "bg-blue-600 text-white" : "card text-gray-700"
                }`}
              >
                Unclaimed in Books ({recSummary.missing_in_books_count})
              </button>
            </div>

            {recLoading && (
              <div className="card p-10 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Cross-checking GSTR-2B against books…</span>
              </div>
            )}

            {!recLoading && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs font-semibold text-gray-500" style={{ borderColor: "var(--border-soft)" }}>
                        <th className="text-left px-5 py-3">Document / Supplier</th>
                        <th className="text-left px-4 py-3">Supplier GSTIN</th>
                        <th className="text-right px-4 py-3">Book ITC</th>
                        <th className="text-right px-4 py-3">GSTR-2B ITC</th>
                        <th className="text-left px-4 py-3">Reconciliation Status</th>
                        <th className="text-left px-5 py-3">Legal / Action Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRecRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-xs text-gray-900 font-mono-data">
                              {row.display_id || row.invoice_number || "—"}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {row.vendor_name || row.supplier_name || "Unknown Vendor"}
                            </p>
                          </td>

                          <td className="px-4 py-3.5 font-mono-data text-xs text-gray-700">
                            {row.vendor_gstin || row.supplier_gstin || "—"}
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono-data text-xs">
                            {row.itc_amount ? `₹${row.itc_amount.toLocaleString("en-IN")}` : "—"}
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono-data text-xs">
                            {row.gstr2b_itc ? `₹${row.gstr2b_itc.toLocaleString("en-IN")}` : row.category === "missing_books" ? `₹${(row.itc_amount || 0).toLocaleString("en-IN")}` : "—"}
                          </td>

                          <td className="px-4 py-3.5">
                            {row.category === "matched" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 size={11} /> Matched
                              </span>
                            )}
                            {row.category === "missing_2b" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                <AlertOctagon size={11} /> Missing in 2B
                              </span>
                            )}
                            {row.category === "mismatched" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                <AlertTriangle size={11} /> Variance ₹{row.variance}
                              </span>
                            )}
                            {row.category === "missing_books" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                <Info size={11} /> Unclaimed in Books
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-xs text-gray-600 max-w-xs">
                            {row.category === "matched" && (
                              <span className="text-emerald-700">100% verified under Sec 16(2)(aa). Safe to claim.</span>
                            )}
                            {row.category === "missing_2b" && (
                              <span className="text-red-700 font-medium">
                                Blocked by Rule 36(4). Supplier hasn&apos;t filed GSTR-1.
                              </span>
                            )}
                            {row.category === "mismatched" && (
                              <span className="text-amber-700">
                                Invoice amount differs from 2B by ₹{row.variance}. Check credit note.
                              </span>
                            )}
                            {row.category === "missing_books" && (
                              <span className="text-blue-700">
                                Supplier reported ₹{row.itc_amount?.toLocaleString()} ITC. Add bill to books!
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {filteredRecRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">
                            No reconciliation records found in this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
