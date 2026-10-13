"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { notices as noticesApi, auth as authApi } from "@/lib/api";
import {
  Scale,
  Calendar,
  AlertTriangle,
  Clock,
  FileText,
  Sparkles,
  Plus,
  X,
  Copy,
  Check,
  Loader2,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Building,
} from "lucide-react";

export default function NoticesPage() {
  const [noticesList, setNoticesList] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  // Notice Logging Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    notice_number: "ZA32" + Math.floor(10000000 + Math.random() * 90000000) + "K",
    form_type: "ASMT-10",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    financial_year: "2025-26",
    section_referred: "Section 61 (Scrutiny of Returns)",
    tax_demand: 25000,
    penalty_demand: 2500,
    issuing_officer: "Superintendent, Range-1, GST Division",
    description: "Difference observed between ITC claimed in GSTR-3B and GSTR-2B. Please explain mismatch.",
  });

  // Reply Draft Modal
  const [activeNotice, setActiveNotice] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [nData, fData, meData] = await Promise.all([
        noticesApi.list(),
        noticesApi.forecast(),
        authApi.me(),
      ]);
      setNoticesList(nData.notices || []);
      setForecast(fData);
      setBusiness(meData.business);
    } catch (err) {
      console.warn("Could not load notice data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNotice(e) {
    e.preventDefault();
    setSubmittingNotice(true);
    try {
      await noticesApi.create(noticeForm);
      setShowLogModal(false);
      await loadData();
      alert("Tax department notice logged successfully.");
    } catch (err) {
      alert(err.message || "Failed to log notice.");
    } finally {
      setSubmittingNotice(false);
    }
  }

  async function handleDraftReply(notice) {
    setActiveNotice(notice);
    setDrafting(true);
    setReplyDraft("");
    try {
      const res = await noticesApi.draftReply(notice.id, {
        additional_facts: "All suppliers are active GST taxpayers with filed returns.",
      });
      setReplyDraft(res.reply_draft);
      await loadData();
    } catch (err) {
      alert("Failed to draft reply: " + err.message);
    } finally {
      setDrafting(false);
    }
  }

  function handleCopyReply() {
    navigator.clipboard.writeText(replyDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div>
      <Topbar
        title="Tax Notice Desk & Advance Cash Forecast"
        subtitle={`${business?.name || "Business"} · Statutory Scrutiny Defense & Cash Outflow Planning`}
        action={
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={14} />
            <span>Log Department Notice</span>
          </button>
        }
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {/* ADVANCE TAX OUTFLOW FORECAST WIDGET */}
        {forecast && (
          <div className="card p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-700/60 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-emerald-400" />
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Next Statutory Filing Deadline: {forecast.due_date}
                  </span>
                </div>
                <h2 className="font-display font-bold text-xl sm:text-2xl mt-1 text-white">
                  Advance Tax Cash Outflow Forecast
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {forecast.recommendation}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block">Days to Deadline</span>
                <span className="font-display text-4xl font-extrabold text-emerald-400">
                  {forecast.days_remaining}
                </span>
                <span className="text-[11px] text-slate-400 block">Days Left</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">Output Tax (Sales)</span>
                <span className="font-mono-data text-lg font-bold text-slate-200 mt-0.5 block">
                  ₹{forecast.projected_output_tax?.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">Eligible Input Credit</span>
                <span className="font-mono-data text-lg font-bold text-emerald-400 mt-0.5 block">
                  ₹{forecast.available_itc?.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">Sec 17(5) Blocked ITC</span>
                <span className="font-mono-data text-lg font-bold text-red-400 mt-0.5 block">
                  ₹{forecast.blocked_itc?.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 block">Net Cash Payable</span>
                <span className={`font-mono-data text-lg font-bold mt-0.5 block ${forecast.net_cash_payable > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  ₹{forecast.net_cash_payable?.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAX DEPARTMENT NOTICE DESK */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Scale size={18} className="text-indigo-600" />
                Tax Notice & Scrutiny Assistant (ASMT-10, DRC-01)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Track department notices, response deadlines, and draft legal rebuttals with statutory citation.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {noticesList.length} Active Records
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
              <p className="text-xs">Loading tax notices…</p>
            </div>
          ) : noticesList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Scale size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No Department Notices Logged</p>
              <p className="text-xs text-slate-500 mt-1">
                Your GST record is clean. Log notices received from the tax department to track deadlines.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-6 py-3">Notice #</th>
                    <th className="text-left px-4 py-3">Form Type</th>
                    <th className="text-left px-4 py-3">Issue Date</th>
                    <th className="text-left px-4 py-3">Reply Due Date</th>
                    <th className="text-right px-4 py-3">Demand (Tax + Penalty)</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">AI Legal Defense</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {noticesList.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-mono-data font-bold text-xs text-slate-900">
                          {n.notice_number}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 max-w-xs">
                          {n.description}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                          {n.form_type}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.section_referred}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono-data text-xs text-slate-600">
                        {n.issue_date}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono-data text-xs text-slate-800 font-semibold">
                          {n.due_date}
                        </span>
                        {n.is_urgent && (
                          <span className="block text-[10px] text-red-600 font-bold mt-0.5 flex items-center gap-0.5">
                            <Clock size={10} /> {n.days_left} Days Remaining!
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-data font-bold text-xs text-red-600">
                        ₹{n.total_demand?.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          n.status === "drafted"
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-900"
                        }`}>
                          {n.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleDraftReply(n)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
                        >
                          <Sparkles size={12} />
                          {n.reply_draft ? "View Legal Draft" : "Draft AI Reply"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* LOG NOTICE MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-indigo-600" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  Log Tax Department Notice
                </h3>
              </div>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Notice Reference No</label>
                  <input
                    type="text"
                    required
                    value={noticeForm.notice_number}
                    onChange={(e) => setNoticeForm({ ...noticeForm, notice_number: e.target.value })}
                    className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Form Type</label>
                  <select
                    value={noticeForm.form_type}
                    onChange={(e) => setNoticeForm({ ...noticeForm, form_type: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="ASMT-10">ASMT-10 (Scrutiny Notice)</option>
                    <option value="DRC-01">DRC-01 (Show Cause Notice)</option>
                    <option value="DRC-07">DRC-07 (Demand Order)</option>
                    <option value="SCN">General SCN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={noticeForm.issue_date}
                    onChange={(e) => setNoticeForm({ ...noticeForm, issue_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Reply Due Date</label>
                  <input
                    type="date"
                    required
                    value={noticeForm.due_date}
                    onChange={(e) => setNoticeForm({ ...noticeForm, due_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Tax Demand (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={noticeForm.tax_demand}
                    onChange={(e) => setNoticeForm({ ...noticeForm, tax_demand: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Penalty (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={noticeForm.penalty_demand}
                    onChange={(e) => setNoticeForm({ ...noticeForm, penalty_demand: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Description / Allegation</label>
                <textarea
                  rows={3}
                  required
                  value={noticeForm.description}
                  onChange={(e) => setNoticeForm({ ...noticeForm, description: e.target.value })}
                  placeholder="e.g. Scrutiny discrepancy between GSTR-3B Table 4(A) and GSTR-2B..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="mt-4 pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNotice}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-sm"
                >
                  {submittingNotice ? "Saving Notice…" : "Record Department Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI LEGAL DRAFT MODAL */}
      {activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                <h3 className="font-display font-bold text-base text-indigo-950">
                  AI Legal Reply Drafter — {activeNotice.form_type}
                </h3>
              </div>
              <button onClick={() => setActiveNotice(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 text-xs text-indigo-900">
                <p className="font-bold">
                  Notice {activeNotice.notice_number} · Demand: ₹{activeNotice.total_demand?.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-indigo-800 mt-0.5">
                  Allegation: {activeNotice.description}
                </p>
              </div>

              {drafting ? (
                <div className="p-12 text-center text-slate-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-xs font-semibold text-slate-700">Synthesizing Statutory Legal Reply…</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Citing CGST Act Sections, CBIC Circular No. 183/15/2022-GST, and High Court precedents.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Formal Legal Letterhead Draft</span>
                    <button
                      onClick={handleCopyReply}
                      className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? "Copied to Clipboard!" : "Copy Legal Text"}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans max-h-[50vh] overflow-y-auto leading-relaxed">
                    {replyDraft || activeNotice.reply_draft}
                  </pre>
                </div>
              )}

              <div className="mt-4 pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={() => setActiveNotice(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  onClick={handleCopyReply}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
                >
                  {copied ? "Copied!" : "Copy Full Legal Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

