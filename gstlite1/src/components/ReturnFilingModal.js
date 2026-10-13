"use client";

import { useState, useEffect } from "react";
import {
  X,
  FileCheck2,
  Download,
  Send,
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Globe,
  KeyRound,
  FileText,
} from "lucide-react";
import { returns as returnsApi, gst as gstApi } from "@/lib/api";

export default function ReturnFilingModal({
  isOpen,
  onClose,
  period = "2026-09",
  business,
  summary,
  onFilingUpdated,
}) {
  const [activeTab, setActiveTab] = useState("offline"); // "offline" | "portal" | "audit"
  const [filingStatus, setFilingStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Download states
  const [downloading3B, setDownloading3B] = useState(false);
  const [downloading1, setDownloading1] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Direct Portal API states
  const [portalStep, setPortalStep] = useState(1); // 1: request OTP, 2: verify OTP, 3: submit return, 4: receipt
  const [otp, setOtp] = useState("123456");
  const [sessionToken, setSessionToken] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalNotice, setPortalNotice] = useState("");
  const [portalError, setPortalError] = useState("");
  const [portalReceipt, setPortalReceipt] = useState(null);

  // Manual filing / lock states
  const [markingFiled, setMarkingFiled] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const cleanGstin = business?.gstin || "32AACCA1234F1Z5";

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();
  }, [isOpen, period]);

  async function refreshStatus() {
    setLoadingStatus(true);
    try {
      const data = await returnsApi.status(period);
      setFilingStatus(data);
      if (data?.is_filed) {
        setActiveTab("audit");
      }
    } catch (err) {
      console.warn("Could not fetch return status:", err);
    } finally {
      setLoadingStatus(false);
    }
  }

  if (!isOpen) return null;

  // 1. Offline JSON Downloads
  async function handleDownload3BJson() {
    setDownloading3B(true);
    try {
      await returnsApi.downloadGstr3bJson(period, cleanGstin);
    } catch (err) {
      alert(err.message || "Failed to download GSTR-3B offline JSON");
    } finally {
      setDownloading3B(false);
    }
  }

  async function handleDownload1Json() {
    setDownloading1(true);
    try {
      await returnsApi.downloadGstr1Json(period, cleanGstin);
    } catch (err) {
      alert(err.message || "Failed to download GSTR-1 offline JSON");
    } finally {
      setDownloading1(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      await gstApi.downloadSummaryPdf(period);
    } catch (err) {
      alert(err.message || "Failed to export PDF pack");
    } finally {
      setDownloadingPdf(false);
    }
  }

  // 2. Mark as Filed & Lock Invoices
  async function handleMarkFiledOffline() {
    if (!confirm(`Are you sure you want to mark ${period} return as FILED? This will lock all invoices for this period against modifications.`)) {
      return;
    }
    setMarkingFiled(true);
    setActionMsg("");
    try {
      const res = await returnsApi.file({
        period,
        return_type: "GSTR-3B",
        filing_mode: "offline_json",
      });
      setActionMsg(res.message);
      await refreshStatus();
      if (onFilingUpdated) onFilingUpdated();
    } catch (err) {
      alert(err.message || "Could not mark return as filed");
    } finally {
      setMarkingFiled(false);
    }
  }

  // 3. Unlock Period
  async function handleUnlockPeriod() {
    if (!confirm(`Unlock invoices for period ${period}? Only do this if an amendment or revision is required.`)) {
      return;
    }
    setUnlocking(true);
    try {
      const res = await returnsApi.unlock(period);
      setActionMsg(res.message);
      await refreshStatus();
      if (onFilingUpdated) onFilingUpdated();
    } catch (err) {
      alert(err.message || "Could not unlock period");
    } finally {
      setUnlocking(false);
    }
  }

  // 4. Direct Portal Integration
  async function handleRequestPortalOtp() {
    setPortalLoading(true);
    setPortalError("");
    setPortalNotice("");
    try {
      const res = await returnsApi.portalAuthOtp(cleanGstin);
      setPortalNotice(res.message);
      setPortalStep(2);
    } catch (err) {
      setPortalError(err.message || "Could not request OTP from GST portal");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleVerifyPortalOtp(e) {
    e.preventDefault();
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await returnsApi.portalVerifyOtp(cleanGstin, otp);
      setSessionToken(res.session_token);
      setPortalNotice(res.message);
      setPortalStep(3);
    } catch (err) {
      setPortalError(err.message || "Invalid OTP");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleDirectPortalPush() {
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await returnsApi.portalPushReturn({
        period,
        return_type: "GSTR-3B",
        session_token: sessionToken,
      });
      setPortalReceipt(res.portal_acknowledgement);
      setPortalStep(4);
      await refreshStatus();
      if (onFilingUpdated) onFilingUpdated();
    } catch (err) {
      setPortalError(err.message || "Direct portal submission failed");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-sunken)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
              <FileCheck2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base sm:text-lg" style={{ color: "var(--ink)" }}>
                  GST Return Filing & Official GSTN Export Hub
                </h3>
                <span className="font-mono-data text-xs px-2 py-0.5 rounded font-bold bg-white text-emerald-800 border border-emerald-200">
                  {period}
                </span>
                {filingStatus?.is_filed ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 size={12} /> FILED ON GSTN
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                    <AlertTriangle size={12} /> DRAFT / UNFILED
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 text-slate-500">
                {business?.name || "Taxpayer Workspace"} · GSTIN: <span className="font-mono-data font-semibold">{cleanGstin}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Financial Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b bg-slate-50/70" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Output Tax (Sales)</p>
            <p className="font-mono-data font-bold text-sm text-slate-900 mt-0.5">
              ₹{(summary?.output_tax_liability || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Eligible ITC (Purchases)</p>
            <p className="font-mono-data font-bold text-sm text-emerald-700 mt-0.5">
              ₹{(summary?.input_tax_credit || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Net Cash Payable</p>
            <p className="font-mono-data font-bold text-sm text-blue-700 mt-0.5">
              ₹{(summary?.net_payable || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Audit Lock Status</p>
            <p className="text-xs font-semibold mt-1 flex items-center gap-1">
              {filingStatus?.is_locked ? (
                <span className="text-red-600 flex items-center gap-1 font-bold">
                  <Lock size={12} /> {filingStatus.locked_invoices} Invoices Locked
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1 font-medium">
                  <Unlock size={12} /> Open for edits
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b bg-white" style={{ borderColor: "var(--border-soft)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("offline")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "offline"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Download size={14} />
            1. Offline Utility JSON & PDF Export
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("portal")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "portal"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Globe size={14} />
            2. Direct GSTN Portal Filing (API / OTP)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "audit"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck size={14} />
            3. Filing Receipt & Audit Trail
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {actionMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                {actionMsg}
              </span>
              <button onClick={() => setActionMsg("")} className="text-emerald-600 hover:opacity-80">
                <X size={14} />
              </button>
            </div>
          )}

          {/* TAB 1: OFFLINE UTILITY JSON & PDF */}
          {activeTab === "offline" && (
            <div className="flex flex-col gap-6">
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900 mb-1">
                  Official GST Common Portal Offline Utility Exports
                </h4>
                <p className="text-xs text-slate-500">
                  Download exact government-standard JSON schema packages to upload directly to{" "}
                  <a
                    href="https://services.gst.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                  >
                    services.gst.gov.in <ExternalLink size={11} />
                  </a>
                  {" "}via the GST Offline Tool.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* GSTR-3B Card */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:border-emerald-500 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        Monthly Tax Return
                      </span>
                      <span className="text-[11px] font-mono-data text-slate-400">GSTR3B_Offline_v1.0</span>
                    </div>
                    <h5 className="font-display font-bold text-base text-slate-900">
                      GSTR-3B Offline JSON
                    </h5>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Includes Table 3.1 (Outward taxable supplies), Table 4 (Eligible & Ineligible ITC), Table 5 (Inward supplies), and Net Cash Tax liability.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={downloading3B}
                    onClick={handleDownload3BJson}
                    className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
                    style={{ background: "var(--primary)" }}
                  >
                    {downloading3B ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {downloading3B ? "Generating JSON…" : "Download GSTR-3B JSON"}
                  </button>
                </div>

                {/* GSTR-1 Card */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:border-emerald-500 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Outward Sales Return
                      </span>
                      <span className="text-[11px] font-mono-data text-slate-400">GSTR1_Offline_v3.1.2</span>
                    </div>
                    <h5 className="font-display font-bold text-base text-slate-900">
                      GSTR-1 Offline JSON
                    </h5>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Includes Tables 4A/4B (B2B invoices grouped by recipient GSTIN), Table 7 (B2CS), Table 12 (HSN summary), and Table 13 (Document issues).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={downloading1}
                    onClick={handleDownload1Json}
                    className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    {downloading1 ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {downloading1 ? "Generating JSON…" : "Download GSTR-1 JSON"}
                  </button>
                </div>
              </div>

              {/* PDF & Filing Lock Actions */}
              <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: "var(--border-soft)" }}>
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 border hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {downloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Export Formal PDF Summary Pack
                </button>

                {!filingStatus?.is_filed ? (
                  <button
                    type="button"
                    disabled={markingFiled}
                    onClick={handleMarkFiledOffline}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-black transition-colors cursor-pointer shadow-sm"
                  >
                    {markingFiled ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                    Mark Filed on Portal & Lock Period Invoices
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={unlocking}
                    onClick={handleUnlockPeriod}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    {unlocking ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                    Unlock Invoices for Amendment
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT GSTN PORTAL FILING (API / OTP) */}
          {activeTab === "portal" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Globe size={16} className="text-emerald-600" />
                    Direct GSTN Portal API Integration (via GSP Sandbox)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Push GSTR-3B directly to the government portal via authenticated API without manual file uploading.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
                  Live Sandbox
                </span>
              </div>

              {portalError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
                  {portalError}
                </div>
              )}

              {portalNotice && (
                <div className="p-3 rounded-xl bg-blue-50 text-blue-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>{portalNotice}</span>
                </div>
              )}

              {/* Step 1: Request OTP */}
              {portalStep === 1 && (
                <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                      <KeyRound size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900">Step 1: Authenticate with GST Portal</p>
                      <p className="text-xs text-slate-500">
                        Request a 6-digit OTP to the authorized signatory mobile for GSTIN <b>{cleanGstin}</b>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={portalLoading}
                    onClick={handleRequestPortalOtp}
                    className="w-fit flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
                    style={{ background: "var(--primary)" }}
                  >
                    {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Request Portal OTP
                  </button>
                </div>
              )}

              {/* Step 2: Verify OTP */}
              {portalStep === 2 && (
                <form onSubmit={handleVerifyPortalOtp} className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col gap-4">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">Step 2: Enter 6-Digit OTP</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter the authentication code sent to your GST portal registered phone. <i>(Demo OTP: <b>123456</b>)</i>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      className="w-48 font-mono-data text-center tracking-widest text-lg font-bold px-3 py-2 rounded-xl border border-slate-300 focus:outline-emerald-600 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={portalLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
                      style={{ background: "var(--primary)" }}
                    >
                      {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      Verify & Open GSTN Session
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Push Return */}
              {portalStep === 3 && (
                <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/30 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900">Step 3: Ready for Direct Portal Submission</p>
                      <p className="text-xs text-slate-600 font-mono-data">
                        Active GSTN Session: {sessionToken}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-emerald-100 text-xs flex flex-col gap-1">
                    <p><b>Target Return:</b> GSTR-3B ({period})</p>
                    <p><b>Net Payable:</b> ₹{(summary?.net_payable || 0).toLocaleString("en-IN")}</p>
                    <p><b>Total Claimed ITC:</b> ₹{(summary?.input_tax_credit || 0).toLocaleString("en-IN")}</p>
                  </div>

                  <button
                    type="button"
                    disabled={portalLoading}
                    onClick={handleDirectPortalPush}
                    className="w-fit flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md cursor-pointer disabled:opacity-60 bg-emerald-700 hover:bg-emerald-800"
                  >
                    {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit Return to GSTN Portal & Lock Month
                  </button>
                </div>
              )}

              {/* Step 4: Submission Success Receipt */}
              {portalStep === 4 && portalReceipt && (
                <div className="p-6 rounded-2xl border border-emerald-300 bg-emerald-50/50 flex flex-col gap-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-emerald-600 text-white">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h5 className="font-display font-bold text-base text-emerald-900">
                        Filed Successfully on GST Common Portal!
                      </h5>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Government Acknowledgement Received.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-emerald-200 text-xs">
                    <div>
                      <p className="text-slate-400">Application Reference Number (ARN)</p>
                      <p className="font-mono-data font-bold text-sm text-slate-900 mt-0.5">
                        {portalReceipt.arn}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Filing Mode</p>
                      <p className="font-semibold text-slate-900 mt-0.5">{portalReceipt.filing_mode}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Filing Period</p>
                      <p className="font-mono-data font-semibold text-slate-900 mt-0.5">{portalReceipt.period}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Official Portal Status</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                        {portalReceipt.status}
                      </span>
                    </div>
                  </div>

                  <a
                    href={portalReceipt.portal_receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    View Official Acknowledgement Receipt on GST Portal <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FILING RECEIPT & AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="flex flex-col gap-5">
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900 mb-1">
                  Return Filing Audit Trail & Period Lock
                </h4>
                <p className="text-xs text-slate-500">
                  Verifiable audit log preserving statutory timestamps, government reference numbers, and anti-tamper locks.
                </p>
              </div>

              {filingStatus?.is_filed ? (
                <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck size={20} className="text-emerald-700" />
                      <span className="font-display font-bold text-sm text-emerald-900">
                        Filing Record Verified
                      </span>
                    </div>
                    <span className="font-mono-data text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-200 text-emerald-900">
                      ARN: {filingStatus.arn}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white border border-emerald-100 text-xs">
                    <div>
                      <p className="text-slate-400">Filing Timestamp</p>
                      <p className="font-mono-data font-semibold text-slate-800 mt-0.5">
                        {filingStatus.filed_at ? new Date(filingStatus.filed_at).toLocaleString("en-IN") : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Submission Mode</p>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {filingStatus.filing_mode === "direct_portal_otp" ? "Direct GSTN API" : "Offline JSON Upload"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Protected Invoices</p>
                      <p className="font-bold text-red-700 mt-0.5 flex items-center gap-1">
                        <Lock size={12} /> {filingStatus.locked_invoices} Locked Invoices
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[11px] text-slate-500">
                      Invoices for this period cannot be edited or deleted while locked.
                    </p>
                    <button
                      type="button"
                      disabled={unlocking}
                      onClick={handleUnlockPeriod}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-50 transition-colors cursor-pointer"
                    >
                      {unlocking ? <Loader2 size={12} className="animate-spin" /> : null}
                      Unlock Period for Amendment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
                  <p className="font-semibold text-sm text-slate-800">
                    No Filing Record for {period}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    This period has not been marked as filed yet. Download the official JSON or submit via direct portal integration to lock and generate your filing audit trail.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

