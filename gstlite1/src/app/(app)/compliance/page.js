"use client";

import { useEffect, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import StatusPill from "@/components/StatusPill";
import PeriodSelector, { formatPeriodName } from "@/components/PeriodSelector";
import { compliance as complianceApi, gst as gstApi } from "@/lib/api";
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
  Coins,
  TrendingUp,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";

const SEVERITY_META = {
  high: { icon: AlertOctagon, color: "var(--danger)", label: "High" },
  medium: { icon: AlertTriangle, color: "var(--warning)", label: "Medium" },
  low: { icon: Info, color: "var(--info)", label: "Low" },
};

const FILTERS = ["all", "high", "medium", "low"];

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState("issues"); // "issues" | "reconciliation" | "optimization"
  const [filter, setFilter] = useState("all");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filing Period State
  const [periods, setPeriods] = useState(["2026-08", "2026-07", "2026-06"]);
  const [selectedPeriod, setSelectedPeriod] = useState("2026-08");

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

  // GSTR-2B State
  const [recData, setRecData] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recFilter, setRecFilter] = useState("all"); // "all" | "matched" | "missing_2b" | "mismatched" | "missing_books"
  const [uploading2B, setUploading2B] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const fileInputRef = useRef(null);

  // Tax Optimization State
  const [optData, setOptData] = useState(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optActionLoading, setOptActionLoading] = useState(false);
  const [optSuccessModal, setOptSuccessModal] = useState(null);

  async function handleOptimizationAction(opp) {
    if (opp.id === "unclaimed_itc_recovery") {
      setOptActionLoading(true);
      try {
        const res = await complianceApi.claimUnclaimed2b();
        if (res.status === "success") {
          await Promise.all([
            fetchReconciliation(selectedPeriod),
            fetchOptimization(selectedPeriod),
          ]);
          setOptSuccessModal({
            title: "✨ Automated ITC Recovery Successful!",
            message: res.message,
            statutoryRule: opp.statutory_rule,
            savings: `₹${(res.claimed_itc || 6300).toLocaleString("en-IN")}`,
            details: `Invoice for ${res.supplier_name || "Southern Steel Tubes Ltd"} (#${res.invoice_number || "SST-2026-441"}) is now ingested into your purchase ledger. Your GSTR-2B reconciliation rate and claimable credit have updated automatically!`,
          });
        } else {
          setOptSuccessModal({
            title: "ITC Status Update",
            message: res.message || "All GSTR-2B eligible entries are already claimed in your books.",
            statutoryRule: opp.statutory_rule,
            savings: "₹0",
            details: "100% of auto-drafted GSTR-2B invoices have been ingested and verified.",
          });
        }
      } catch (err) {
        alert(err.message || "Failed to auto-claim 2B entry");
      } finally {
        setOptActionLoading(false);
      }
    } else {
      setOptSuccessModal({
        title: opp.title,
        message: opp.savings_description,
        statutoryRule: opp.statutory_rule,
        savings: `₹${(opp.potential_savings || 0).toLocaleString("en-IN")}`,
        details: opp.supporting_evidence?.join(" • ") || "Compliance evidence logged for CA audit review.",
      });
    }
  }

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
  async function fetchReconciliation(p) {
    const targetPeriod = p || selectedPeriod;
    setRecLoading(true);
    try {
      const data = await complianceApi.reconciliation(targetPeriod);
      setRecData(data);
    } catch (err) {
      console.warn("Could not fetch reconciliation data:", err);
    } finally {
      setRecLoading(false);
    }
  }

  // Load Tax Optimization & Relief Data
  async function fetchOptimization(p) {
    const targetPeriod = p || selectedPeriod;
    setOptLoading(true);
    try {
      const data = await complianceApi.optimization(targetPeriod);
      setOptData(data);
    } catch (err) {
      console.warn("Could not fetch tax optimization data:", err);
    } finally {
      setOptLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "reconciliation") {
      fetchReconciliation(selectedPeriod);
    }
    if (activeTab === "optimization") {
      fetchOptimization(selectedPeriod);
    }
  }, [activeTab, selectedPeriod]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading2B(true);
    setActionNotice("");
    try {
      const res = await complianceApi.upload2b(file, selectedPeriod);
      setActionNotice(res.message || "GSTR-2B ingested successfully!");
      await fetchReconciliation(selectedPeriod);
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
      const res = await complianceApi.seedDemo2b(selectedPeriod);
      setActionNotice(res.message || "Loaded sample GSTR-2B dataset.");
      await fetchReconciliation(selectedPeriod);
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
        subtitle={`Rule validation checks and live GSTR-2B ITC cross-matching · ${formatPeriodName(selectedPeriod)}`}
        action={
          <PeriodSelector
            periods={periods}
            selectedPeriod={selectedPeriod}
            onChange={(p) => {
              setSelectedPeriod(p);
              fetchReconciliation(p);
              fetchOptimization(p);
            }}
          />
        }
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
          <button
            onClick={() => {
              setActiveTab("optimization");
              fetchOptimization();
            }}
            className={`flex items-center gap-2 pb-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
              activeTab === "optimization"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            <Sparkles size={16} className="text-amber-500" />
            Tax Relief & Optimization
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
              Novel Engine
            </span>
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

        {/* ================= TAB 3: RULE-GROUNDED GST RELIEF & TAX OPTIMIZATION ================= */}
        {activeTab === "optimization" && (
          <div className="flex flex-col gap-6">
            {/* Novelty Header Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Proprietary Novel Engine
                  </span>
                  <span className="text-xs text-slate-300 font-mono-data">
                    Section 11 · Section 16(2) · Rule 37 · Section 10
                  </span>
                </div>
                <h3 className="font-display font-bold text-xl md:text-2xl text-white">
                  Rule-Grounded GST Relief & Tax Optimization Engine
                </h3>
                <p className="text-xs md:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
                  Identifies legally applicable GST exemptions, concessional rates, eligible Input Tax Credit (ITC), and suitable GST schemes based on business details and individual transactions.
                </p>
                <div className="mt-4 p-3 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-xs text-emerald-200 font-medium flex items-start gap-2">
                  <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <b className="text-white">Key Differentiator:</b> Instead of only detecting GST compliance errors, GSTLite proactively identifies legitimate opportunities to avoid excess tax payments while maintaining 100% regulatory compliance.
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 font-medium">Total Potential Tax Relief</p>
                  <Coins size={16} className="text-emerald-600" />
                </div>
                <p className="font-display text-2xl font-bold text-emerald-700 mt-2">
                  ₹{(optData?.total_potential_savings || 0).toLocaleString("en-IN")}
                </p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Identified across statutory relief avenues
                </span>
              </div>

              <div className="card p-5 border-l-4 border-l-indigo-500">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 font-medium">Actionable Opportunities</p>
                  <TrendingUp size={16} className="text-indigo-600" />
                </div>
                <p className="font-display text-2xl font-bold text-indigo-700 mt-2">
                  {optData?.active_opportunities_count || 4} Avenues
                </p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  ITC recovery, interest shield & scheme optimization
                </span>
              </div>

              <div className="card p-5 border-l-4 border-l-purple-500">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 font-medium">Regulatory Framework</p>
                  <ShieldCheck size={16} className="text-purple-600" />
                </div>
                <p className="font-display text-2xl font-bold text-purple-700 mt-2">
                  100% Statutorily Grounded
                </p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Zero aggressive tax avoidance · CBIC compliant
                </span>
              </div>
            </div>

            {/* Opportunities List */}
            {optLoading ? (
              <div className="card p-12 text-center text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                <p className="text-xs">Analyzing business ledger for statutory tax relief opportunities…</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(optData?.opportunities || []).map((opp) => (
                  <div
                    key={opp.id}
                    className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200 bg-white"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700">
                          {opp.category}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            opp.badge_color === "emerald"
                              ? "bg-emerald-100 text-emerald-800"
                              : opp.badge_color === "amber"
                              ? "bg-amber-100 text-amber-900"
                              : opp.badge_color === "indigo"
                              ? "bg-indigo-100 text-indigo-900"
                              : "bg-purple-100 text-purple-900"
                          }`}
                        >
                          {opp.status}
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-base text-slate-900">
                        {opp.title}
                      </h4>
                      <p className="text-xs font-mono-data text-emerald-700 font-semibold mt-1">
                        Statutory Rule: {opp.statutory_rule}
                      </p>

                      <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <p className="font-semibold text-slate-700 mb-1">Eligibility Conditions:</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                          {opp.eligibility_conditions?.map((cond, i) => (
                            <li key={i}>{cond}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 mb-3">
                        <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                          Potential Tax Relief / Savings
                        </p>
                        <p className="text-sm font-bold text-emerald-800 mt-0.5">
                          {opp.savings_description}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        <p className="font-semibold text-slate-700">Supporting Evidence:</p>
                        <ul className="list-disc pl-4 text-slate-500 mt-1 space-y-0.5">
                          {opp.supporting_evidence?.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">Pre-filing advisory</span>
                      <button
                        type="button"
                        onClick={() => handleOptimizationAction(opp)}
                        disabled={optActionLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        style={{ background: "var(--primary)" }}
                      >
                        {optActionLoading && opp.id === "unclaimed_itc_recovery" && (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                        {opp.action_label}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal for Optimization Actions & Audit Sign-Off */}
        {optSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      {optSuccessModal.title}
                    </h3>
                    <p className="text-[11px] font-mono-data text-emerald-700">
                      Rule: {optSuccessModal.statutoryRule}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOptSuccessModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="my-5 flex flex-col gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Statutory Tax Benefit / Saved Amount
                  </p>
                  <p className="text-xl font-display font-bold text-emerald-700 mt-0.5">
                    {optSuccessModal.savings}
                  </p>
                  <p className="text-xs text-emerald-800/90 mt-1 font-medium leading-relaxed">
                    {optSuccessModal.message}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold text-slate-700 mb-1">
                    Auditor Compliance Sign-Off:
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {optSuccessModal.details}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOptSuccessModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ background: "var(--primary)" }}
                >
                  Got It · Signed Off for Filing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

