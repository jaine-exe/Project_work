"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { vendors as vendorsApi, auth as authApi, returns as returnsApi } from "@/lib/api";
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  MessageSquare,
  Mail,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
} from "lucide-react";

export default function VendorsPage() {
  const [scorecard, setScorecard] = useState(null);
  const [missingInvoices, setMissingInvoices] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scorecard"); // "scorecard" | "missing"
  const [searchQuery, setSearchQuery] = useState("");

  // Notice Modal
  const [activeNotice, setActiveNotice] = useState(null);
  const [noticePreview, setNoticePreview] = useState(null);
  const [loadingNotice, setLoadingNotice] = useState(false);
  const [copiedText, setCopiedText] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [scoreData, missingData, meData] = await Promise.all([
        vendorsApi.scorecard(),
        vendorsApi.missingInvoices(),
        authApi.me(),
      ]);
      setScorecard(scoreData);
      setMissingInvoices(missingData.missing_invoices || []);
      setBusiness(meData.business);
    } catch (err) {
      setError(err.message || "Failed to load vendor reconciliation data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenNotice(inv) {
    setActiveNotice(inv);
    setLoadingNotice(true);
    try {
      const data = await vendorsApi.noticePreview({
        vendor_name: inv.vendor_name,
        vendor_gstin: inv.vendor_gstin,
        vendor_email: "accounts@" + (inv.vendor_name?.toLowerCase().replace(/[^a-z]/g, "") || "vendor") + ".com",
        vendor_phone: "6282374326",
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        amount: inv.amount,
        tax_amount: inv.tax_amount,
      });
      setNoticePreview(data);
    } catch (err) {
      alert("Could not generate notice: " + err.message);
    } finally {
      setLoadingNotice(false);
    }
  }

  function handleCopy(text, type) {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(""), 2500);
  }

  const vendorsList = (scorecard?.vendors || []).filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.vendor_name.toLowerCase().includes(q) ||
      (v.vendor_gstin && v.vendor_gstin.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <Topbar
        title="Vendor Compliance & GSTR-2B Reconciliation"
        subtitle={`${business?.name || "Business"} · Counterparty Compliance Ratings & 1-Click Notices`}
        action={
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Reconciliation</span>
          </button>
        }
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Total Active Suppliers
            </p>
            <p className="font-display text-2xl font-bold mt-2" style={{ color: "var(--ink)" }}>
              {scorecard?.summary?.total_vendors || 0}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Purchases recorded this fiscal year
            </span>
          </div>

          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Green (Compliant)
            </p>
            <p className="font-display text-2xl font-bold mt-2 text-emerald-700">
              {scorecard?.summary?.green_compliant || 0}
            </p>
            <span className="text-[11px] text-emerald-600 mt-1 block">
              &gt; 90% GSTR-1 filing match rate
            </span>
          </div>

          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Red (High Risk Vendors)
            </p>
            <p className="font-display text-2xl font-bold mt-2 text-red-600">
              {scorecard?.summary?.red_high_risk || 0}
            </p>
            <span className="text-[11px] text-red-500 mt-1 block">
              Missing invoices blocking ITC
            </span>
          </div>

          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Total ITC at Risk
            </p>
            <p className="font-display text-2xl font-bold mt-2 text-red-700">
              ₹{(scorecard?.summary?.total_itc_at_risk || 0).toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Missing in government GSTR-2B
            </span>
          </div>
        </div>

        {/* Tab Controls & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 w-fit">
            <button
              onClick={() => setActiveTab("scorecard")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "scorecard"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Vendor Scorecard ({scorecard?.vendors?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("missing")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "missing"
                  ? "bg-white text-red-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Missing Invoices in 2B ({missingInvoices.length})
            </button>
          </div>

          {activeTab === "scorecard" && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor or GSTIN…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white"
              />
            </div>
          )}
        </div>

        {/* TAB 1: VENDOR SCORECARD */}
        {activeTab === "scorecard" && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Supplier Compliance Directory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Suppliers rated by their GSTR-1 promptness and GSTR-2B match rates.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                <p className="text-xs">Computing vendor compliance scorecards…</p>
              </div>
            ) : vendorsList.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Users size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No Vendors Found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-6 py-3">Vendor / Supplier</th>
                      <th className="text-left px-4 py-3">GSTIN</th>
                      <th className="text-center px-4 py-3">Rating</th>
                      <th className="text-center px-4 py-3">2B Match Rate</th>
                      <th className="text-right px-4 py-3">Total Spend</th>
                      <th className="text-right px-4 py-3">ITC Claimed</th>
                      <th className="text-right px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vendorsList.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-bold text-xs text-slate-900">{v.vendor_name}</p>
                          <span className="text-[11px] text-slate-400">{v.total_invoices} bills recorded</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono-data text-xs text-slate-600">
                          {v.vendor_gstin || "Unregistered"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              v.rating === "Green"
                                ? "bg-emerald-100 text-emerald-900"
                                : v.rating === "Amber"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-red-100 text-red-900"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              v.rating === "Green" ? "bg-emerald-500" : v.rating === "Amber" ? "bg-amber-500" : "bg-red-500"
                            }`} />
                            {v.rating} · {v.risk_label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-mono-data font-bold text-xs text-slate-800">
                              {v.match_percentage}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {v.matched_count} of {v.total_invoices} matched
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-data text-xs text-slate-700">
                          ₹{v.total_spend.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-data font-semibold text-xs text-slate-900">
                          ₹{v.total_itc.toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {v.missing_count > 0 ? (
                            <button
                              onClick={() => {
                                const firstMissing = v.invoices.find((inv) => !inv.is_matched);
                                if (firstMissing) {
                                  handleOpenNotice({
                                    ...firstMissing,
                                    vendor_name: v.vendor_name,
                                    vendor_gstin: v.vendor_gstin,
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100 transition-colors cursor-pointer"
                            >
                              <MessageSquare size={12} />
                              Send Notice
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> Reconciled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MISSING GSTR-2B INVOICES */}
        {activeTab === "missing" && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50/30">
              <div>
                <h3 className="font-display font-bold text-base text-red-950 flex items-center gap-2">
                  <AlertTriangle size={17} className="text-red-600" />
                  GSTR-2B Missing Invoices — Action Center
                </h3>
                <p className="text-xs text-red-800 mt-0.5">
                  These invoices are in your purchase ledger but have not been uploaded by your suppliers to the GST portal.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                {missingInvoices.length} Unmatched Invoices
              </span>
            </div>

            {missingInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ShieldCheck size={32} className="mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-bold text-slate-800">All Purchase Invoices Reconciled!</p>
                <p className="text-xs text-slate-500 mt-1">
                  100% of your vendor invoices match active GSTR-2B records.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-6 py-3">Invoice #</th>
                      <th className="text-left px-4 py-3">Vendor Name</th>
                      <th className="text-left px-4 py-3">Vendor GSTIN</th>
                      <th className="text-left px-4 py-3">Invoice Date</th>
                      <th className="text-right px-4 py-3">Invoice Amount</th>
                      <th className="text-right px-4 py-3">ITC Blocked</th>
                      <th className="text-right px-6 py-3">1-Click Notice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {missingInvoices.map((inv) => (
                      <tr key={inv.invoice_id} className="hover:bg-red-50/20 transition-colors">
                        <td className="px-6 py-3.5 font-mono-data font-bold text-xs text-slate-900">
                          {inv.invoice_number}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-xs text-slate-800">
                          {inv.vendor_name}
                        </td>
                        <td className="px-4 py-3.5 font-mono-data text-xs text-slate-500">
                          {inv.vendor_gstin || "—"}
                        </td>
                        <td className="px-4 py-3.5 font-mono-data text-xs text-slate-600">
                          {inv.invoice_date}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-data text-xs text-slate-700">
                          ₹{inv.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono-data font-bold text-xs text-red-600">
                          ₹{inv.tax_amount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => handleOpenNotice(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm cursor-pointer"
                          >
                            <MessageSquare size={13} />
                            Send Notice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VENDOR NOTICE COMPOSER MODAL */}
      {activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-700" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  Vendor ITC Follow-up Notice
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveNotice(null);
                  setNoticePreview(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {loadingNotice ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                <p className="text-xs">Generating customized statutory reminder…</p>
              </div>
            ) : noticePreview ? (
              <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                  <p className="font-semibold text-emerald-950">
                    Recipient: {activeNotice.vendor_name} ({activeNotice.vendor_gstin || "No GSTIN"})
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    Invoice: {activeNotice.invoice_number} · Amount: ₹{activeNotice.amount?.toLocaleString("en-IN")} · Blocked ITC: ₹{activeNotice.tax_amount?.toLocaleString("en-IN")}
                  </p>
                </div>

                {/* WhatsApp Message Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-emerald-600" />
                      WhatsApp Reminder (1-Click)
                    </span>
                    <button
                      onClick={() => handleCopy(noticePreview.whatsapp_text, "wa")}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      {copiedText === "wa" ? <Check size={12} /> : <Copy size={12} />}
                      {copiedText === "wa" ? "Copied!" : "Copy Text"}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans">
                    {noticePreview.whatsapp_text}
                  </pre>
                  <a
                    href={noticePreview.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer"
                  >
                    Open in WhatsApp Web <ExternalLink size={12} />
                  </a>
                </div>

                {/* Email Body Preview */}
                <div className="border-t pt-4 border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Mail size={14} className="text-indigo-600" />
                      Formal Email Letterhead Notice
                    </span>
                    <button
                      onClick={() => handleCopy(noticePreview.email_body, "email")}
                      className="text-[11px] font-semibold text-indigo-700 hover:underline flex items-center gap-1"
                    >
                      {copiedText === "email" ? <Check size={12} /> : <Copy size={12} />}
                      {copiedText === "email" ? "Copied!" : "Copy Email"}
                    </button>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-col gap-2">
                    <p className="font-semibold text-slate-900">
                      Subject: {noticePreview.email_subject}
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-slate-600">
                      {noticePreview.email_body}
                    </pre>
                  </div>
                  <a
                    href={noticePreview.mailto_url}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
                  >
                    Launch Email Client (Outlook / Mail) <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

