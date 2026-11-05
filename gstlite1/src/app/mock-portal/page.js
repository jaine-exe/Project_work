"use client";

import { useState, useEffect } from "react";
import { auth as authApi, returns as returnsApi } from "@/lib/api";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  Lock,
  ArrowRight,
  HelpCircle,
  FileCheck2,
} from "lucide-react";

export default function MockGstPortalPage() {
  const [selectedFy, setSelectedFy] = useState("2026-27");
  const [selectedQuarter, setSelectedQuarter] = useState("Q2 (Jul - Sep)");
  const [selectedPeriod, setSelectedPeriod] = useState("September");
  
  // Return statuses
  const [gstr3bStatus, setGstr3bStatus] = useState("NOT_FILED"); // "NOT_FILED" | "PROCESSED" | "FILED"
  const [filingArn, setFilingArn] = useState("");
  const [filingDate, setFilingDate] = useState("");
  
  // Offline upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedJson, setUploadedJson] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadStep, setUploadStep] = useState(1); // 1: Upload, 2: Preview Tables, 3: Success EVC
  
  // Verification code
  const [evcCode, setEvcCode] = useState("123456");
  const [evcLoading, setEvcLoading] = useState(false);

  // Active Business Entity
  const [currentBusiness, setCurrentBusiness] = useState({
    name: "Alan Enterprises Pvt Ltd",
    gstin: "32AAECS1234F1Z5",
    state: "Kerala",
  });

  // Authentication State (default true for instant demo)
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [loginUser, setLoginUser] = useState("alan_enterprises");
  const [loginPass, setLoginPass] = useState("Taxpayer@2026");
  const [captchaInput, setCaptchaInput] = useState("84921");
  const [captchaCode, setCaptchaCode] = useState("84921");
  const [loginLoading, setLoginLoading] = useState(false);

  // Sync with GST Lite backend on mount
  useEffect(() => {
    fetchActiveBusiness();
    fetchLiveGstLiteStatus();
  }, []);

  async function fetchActiveBusiness() {
    // 1. Check URL parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qName = params.get("business_name");
      const qGstin = params.get("gstin");
      if (qName || qGstin) {
        setCurrentBusiness((prev) => ({
          ...prev,
          name: qName || prev.name,
          gstin: qGstin || prev.gstin,
        }));
        if (qName) {
          setLoginUser(qName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 18));
        }
        return;
      }
    }

    // 2. Fetch active session business from API
    try {
      const me = await authApi.me();
      if (me?.business) {
        setCurrentBusiness({
          name: me.business.name || "Alan Enterprises Pvt Ltd",
          gstin: me.business.gstin || "32AAECS1234F1Z5",
          state: me.business.state || "Kerala",
        });
        const username = me.business.name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 18);
        setLoginUser(username);
      }
    } catch (e) {
      console.log("Could not load user profile for mock portal:", e);
    }
  }

  function periodNameToKey(name) {
    if (name === "October") return "2026-10";
    if (name === "September") return "2026-09";
    if (name === "August") return "2026-08";
    if (name === "July") return "2026-07";
    return "2026-10";
  }

  async function fetchLiveGstLiteStatus(targetMonth) {
    // 1. Direct URL override (if launched with ?arn=...&period=...)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlArn = params.get("arn");
      const urlPeriod = params.get("period");
      if (urlArn) {
        setGstr3bStatus("FILED");
        setFilingArn(urlArn);
        setFilingDate(new Date().toLocaleString("en-IN"));
        if (urlPeriod === "2026-10") setSelectedPeriod("October");
        else if (urlPeriod === "2026-09") setSelectedPeriod("September");
        return;
      }
    }

    const monthName = targetMonth || selectedPeriod;
    const periodKey = periodNameToKey(monthName);

    try {
      const data = await returnsApi.status(periodKey);
      if (data?.is_filed) {
        setGstr3bStatus("FILED");
        setFilingArn(data.arn || "AA3210208111263");
        setFilingDate(new Date(data.filed_at || Date.now()).toLocaleString("en-IN"));
        return;
      }
    } catch (e) {
      console.log("Status fetch error for period", periodKey, e);
    }

    // Check October if current was September or default
    if (periodKey !== "2026-10") {
      try {
        const dataOct = await returnsApi.status("2026-10");
        if (dataOct?.is_filed) {
          setSelectedPeriod("October");
          setSelectedQuarter("Q3 (Oct - Dec)");
          setGstr3bStatus("FILED");
          setFilingArn(dataOct.arn || "AA3210208111263");
          setFilingDate(new Date(dataOct.filed_at || Date.now()).toLocaleString("en-IN"));
          return;
        }
      } catch (err) {}
    }

    setGstr3bStatus("NOT_FILED");
    setFilingArn("");
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    processJsonFile(file);
  }

  function processJsonFile(file) {
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.gstin || !parsed.ret_period) {
          throw new Error("Invalid GSTR-3B JSON Schema. Missing 'gstin' or 'ret_period'.");
        }
        setUploadedJson(parsed);
        setUploadStep(2);
      } catch (err) {
        setUploadError(err.message || "Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  }

  function loadSampleJson() {
    const sample = {
      gstin: currentBusiness.gstin,
      ret_period: "092026",
      filing_typ: "GSTR3B",
      taxpayer_name: currentBusiness.name,
      sup_details: {
        osup_det: {
          txval: 125000.0,
          iamt: 0.0,
          camt: 11250.0,
          samt: 11250.0,
          csamt: 0.0,
        },
      },
      itc_elg: {
        itc_avl: [
          { ty: "OTH", iamt: 0.0, camt: 7200.0, samt: 7200.0, csamt: 0.0 },
        ],
        itc_inelg: [
          { ty: "RUL", iamt: 0.0, camt: 1800.0, samt: 1800.0, csamt: 0.0 },
        ],
      },
    };
    setUploadedJson(sample);
    setUploadStep(2);
  }

  function handleFileWithEvc(e) {
    e.preventDefault();
    setEvcLoading(true);
    setTimeout(() => {
      const generatedArn = "AA32092600" + Math.floor(10000 + Math.random() * 90000);
      setFilingArn(generatedArn);
      setFilingDate(new Date().toLocaleString("en-IN"));
      setGstr3bStatus("FILED");
      setUploadStep(3);
      setEvcLoading(false);
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-800 font-sans">
      {/* 1. Official Government Header */}
      <header className="bg-white border-b border-slate-300">
        {/* Top utility row */}
        <div className="bg-[#003366] text-white text-xs px-6 py-1.5 flex flex-wrap justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="font-semibold tracking-wide">GOVERNMENT OF INDIA</span>
            <span className="text-slate-300">|</span>
            <span>Goods and Services Tax Portal (Demonstration Replica)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-200">
            <span>Skip to Main Content</span>
            <span>|</span>
            <span>Language: <b>English</b></span>
            <span>|</span>
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="text-amber-300 font-medium">Logged in: {currentBusiness.gstin}</span>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => setIsLoggedIn(false)}
                  className="text-white hover:text-amber-200 font-bold underline cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoggedIn(true)}
                className="text-amber-300 hover:text-white font-bold cursor-pointer"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {/* Main Logo & Title */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-xl shadow-inner">
              GST
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#003366]">
                Goods and Services Tax
              </h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                Government of India · One Nation, One Tax, One Market
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">{currentBusiness.name}</p>
              <p className="text-[11px] font-mono text-slate-500">GSTIN: {currentBusiness.gstin}</p>
            </div>
            <a
              href="http://localhost:3000/gst-summary"
              className="px-3 py-1.5 rounded text-xs font-semibold bg-[#e8eff7] text-[#003366] hover:bg-[#d5e4f3] border border-[#b8cfe6] flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink size={13} /> Return to GST Lite App
            </a>
          </div>
        </div>

        {/* Navy Ribbon Menu */}
        <nav className="bg-[#1f4f82] text-white text-sm px-6 py-2.5 flex items-center gap-6 overflow-x-auto shadow-sm">
          <span className="font-bold border-b-2 border-amber-400 pb-0.5 cursor-pointer">
            Dashboard
          </span>
          <span className="hover:text-amber-200 cursor-pointer">Services</span>
          <span className="hover:text-amber-200 cursor-pointer">GST Law</span>
          <span className="hover:text-amber-200 cursor-pointer">Downloads</span>
          <span className="hover:text-amber-200 cursor-pointer">Search Taxpayer</span>
          <span className="hover:text-amber-200 cursor-pointer">Help and Taxpayer Facilities</span>
        </nav>
      </header>

      {/* 2. Breadcrumbs & Notice */}
      <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div>
          <span>Home</span> &gt; <span>{isLoggedIn ? "Dashboard" : "Login"}</span>
          {isLoggedIn && (
            <> &gt; <span className="font-semibold text-slate-900">Return Dashboard</span></>
          )}
        </div>
        <div className="flex items-center gap-2 text-emerald-800 font-medium bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
          <ShieldCheck size={14} /> GSP Sandbox Connected & Ready
        </div>
      </div>

      {!isLoggedIn ? (
        <main className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-300 rounded-lg shadow-lg">
          <div className="bg-[#003366] text-white p-3 -m-6 mb-6 rounded-t-lg">
            <h2 className="text-sm font-bold tracking-wide">Login to Your GST Account</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLoginLoading(true);
              setTimeout(() => {
                setIsLoggedIn(true);
                setLoginLoading(false);
              }, 400);
            }}
            className="flex flex-col gap-4 text-xs"
          >
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Characters Shown Below (Captcha) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-slate-200 tracking-widest font-mono font-bold text-base px-4 py-2 border border-slate-400 select-none line-through text-slate-800">
                  {captchaCode}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = String(Math.floor(10000 + Math.random() * 90000));
                    setCaptchaCode(next);
                    setCaptchaInput(next);
                  }}
                  className="text-xs text-[#003366] underline font-bold cursor-pointer"
                >
                  Refresh Captcha
                </button>
              </div>
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 font-mono font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="mt-2 w-full py-2.5 bg-[#003366] hover:bg-[#002244] text-white font-bold rounded shadow transition-colors cursor-pointer text-xs"
            >
              {loginLoading ? "Authenticating…" : "LOGIN"}
            </button>
            <div className="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
              <span className="hover:underline cursor-pointer">Forgot Username?</span>
              <span className="hover:underline cursor-pointer">Forgot Password?</span>
            </div>
          </form>
        </main>
      ) : (
        /* 3. Main Dashboard Body */
        <main className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        {/* Notice ticker */}
        <div className="bg-[#fff9e6] border-l-4 border-amber-500 p-3 text-xs text-slate-800 rounded shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>
              <b>Statutory Filing Notice:</b> Form GSTR-3B and GSTR-1 for tax period <b>{selectedPeriod} 2026</b> are active. Due date for GSTR-3B is <b>20/10/2026</b>.
            </span>
          </div>
          <button
            onClick={() => fetchLiveGstLiteStatus(selectedPeriod)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#003366] hover:underline"
          >
            <RefreshCw size={12} /> Sync Status
          </button>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-lg border border-slate-300 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#003366] mb-4 uppercase tracking-wider flex items-center gap-2">
            <Calendar size={16} /> File Returns — Period Selection
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Financial Year <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedFy}
                onChange={(e) => setSelectedFy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-[#003366]"
              >
                <option value="2026-27">2026-27</option>
                <option value="2025-26">2025-26</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Quarter <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-[#003366]"
              >
                <option value="Q3 (Oct - Dec)">Quarter 3 (Oct - Dec)</option>
                <option value="Q2 (Jul - Sep)">Quarter 2 (Jul - Sep)</option>
                <option value="Q1 (Apr - Jun)">Quarter 1 (Apr - Jun)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Return Filing Period <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  fetchLiveGstLiteStatus(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-[#003366]"
              >
                <option value="October">October</option>
                <option value="September">September</option>
                <option value="August">August</option>
                <option value="July">July</option>
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={() => fetchLiveGstLiteStatus(selectedPeriod)}
                className="w-full bg-[#003366] hover:bg-[#002244] text-white py-1.5 rounded text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Search size={14} /> Search
              </button>
            </div>
          </div>
        </div>

        {/* 4. Return Tiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tile 1: GSTR-1 */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#003366]">GSTR-1</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  UPLOADED
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 mt-1">
                Details of outward supplies of goods or services
              </h3>
              <p className="text-xs text-slate-500 mt-1">Due Date: 11/10/2026</p>
            </div>
            <div className="p-4 flex gap-2">
              <button
                type="button"
                onClick={() => alert("GSTR-1 data is prepared in GST Lite and exported via Offline JSON.")}
                className="flex-1 py-1.5 text-center text-xs font-bold text-[#003366] bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
              >
                PREPARE ONLINE
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(true);
                  setUploadStep(1);
                }}
                className="flex-1 py-1.5 text-center text-xs font-bold text-white bg-[#003366] hover:bg-[#002244] rounded"
              >
                PREPARE OFFLINE
              </button>
            </div>
          </div>

          {/* Tile 2: GSTR-2B */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#003366]">GSTR-2B</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  AVAILABLE
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 mt-1">
                Auto-drafted ITC Statement for the month
              </h3>
              <p className="text-xs text-slate-500 mt-1">Generated: 14/10/2026</p>
            </div>
            <div className="p-4 flex gap-2">
              <a
                href="http://localhost:3000/vendors"
                className="flex-1 py-1.5 text-center text-xs font-bold text-[#003366] bg-slate-100 hover:bg-slate-200 rounded border border-slate-300"
              >
                VIEW 2B SUMMARY
              </a>
              <button
                type="button"
                onClick={() => alert("GSTR-2B data is already synchronized with GST Lite.")}
                className="flex-1 py-1.5 text-center text-xs font-bold text-white bg-[#1f4f82] hover:bg-[#153860] rounded"
              >
                DOWNLOAD JSON
              </button>
            </div>
          </div>

          {/* Tile 3: GSTR-3B (CORE DEMO TILE) */}
          <div className="bg-white rounded-lg border-2 border-[#003366] shadow-md flex flex-col justify-between overflow-hidden relative">
            <div className="bg-[#003366] text-white text-[11px] px-3 py-1 font-bold flex items-center justify-between">
              <span>PRIMARY STATUTORY RETURN</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded">MONTHLY</span>
            </div>

            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#003366]">GSTR-3B</span>
                {gstr3bStatus === "FILED" ? (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={12} /> FILED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    NOT FILED
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-800 mt-1">
                Monthly Return (Tax liability & ITC summary)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Due Date: 20/10/2026</p>

              {gstr3bStatus === "FILED" && (
                <div className="mt-3 p-2 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-900">
                  <p className="font-bold flex items-center gap-1">
                    <ShieldCheck size={14} className="text-emerald-700" /> Return Filed Successfully
                  </p>
                  <p className="font-mono mt-0.5">ARN: <b>{filingArn}</b></p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{filingDate}</p>
                </div>
              )}
            </div>

            <div className="p-4 flex gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(true);
                  if (gstr3bStatus === "FILED") setUploadStep(3);
                  else setUploadStep(1);
                }}
                className={`flex-1 py-2 text-center text-xs font-bold text-white rounded shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                  gstr3bStatus === "FILED"
                    ? "bg-[#003366] hover:bg-[#002244]"
                    : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {gstr3bStatus === "FILED" ? (
                  <>
                    <FileCheck2 size={14} /> VIEW OFFICIAL ARN RECEIPT & SUMMARY
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} /> PREPARE OFFLINE (JSON)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 5. Information & Instructions Box */}
        <div className="bg-white rounded-lg border border-slate-300 p-5 shadow-sm text-xs leading-relaxed text-slate-600">
          <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
            <HelpCircle size={16} className="text-[#003366]" />
            Official GST Portal Demo Instructions for Evaluators & Examiners
          </h4>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              <b>Direct Integration Verification:</b> If you clicked <i>"Direct GSTN Portal Push"</i> inside GST Lite, this portal immediately reads the filed state from the local server and displays <b>STATUS: FILED</b> with the verified ARN.
            </li>
            <li>
              <b>Offline JSON Verification:</b> Click <b>"PREPARE OFFLINE"</b> above. Upload the JSON file exported from GST Lite (e.g. <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">GSTR3B_32AACCA1234F1Z5_202609.json</span>).
            </li>
            <li>
              The portal parser will ingest the JSON, populate the statutory Table 3.1 (Outward Supplies) and Table 4 (Eligible ITC), and let you file with EVC to generate the government ARN receipt.
            </li>
          </ol>
        </div>
      </main>
      )}

      {/* ========================================================================= */}
      {/* 6. OFFLINE UPLOAD & STATUTORY FORM MODAL                                  */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#003366] text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 size={18} />
                <span className="font-bold text-sm">
                  Upload Return Offline — Form GSTR-3B (September 2026)
                </span>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-300 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 text-xs text-slate-700">
              {/* STEP 1: UPLOAD JSON */}
              {uploadStep === 1 && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded text-blue-900">
                    <p className="font-bold">Instructions:</p>
                    <p className="mt-1">
                      Upload the official JSON file generated from your GST Lite accounting software. The file will be parsed against GSTN Schema v3.1.2.
                    </p>
                  </div>

                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded font-medium">
                      {uploadError}
                    </div>
                  )}

                  {/* Dropzone */}
                  <label className="border-2 border-dashed border-[#003366]/40 hover:border-[#003366] rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-colors">
                    <UploadCloud size={36} className="text-[#003366]" />
                    <div className="text-center">
                      <p className="font-bold text-sm text-slate-800">
                        Click to Browse or Drag and Drop GSTR-3B JSON File
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Accepts official offline utility payload (.json)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Quick 1-Click Button for presentation */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Don't have file open right now?</span>
                    <button
                      type="button"
                      onClick={loadSampleJson}
                      className="px-4 py-2 bg-[#1f4f82] hover:bg-[#153860] text-white rounded font-bold transition-colors cursor-pointer"
                    >
                      ⚡ Quick Load Sample GST Lite Export JSON
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PREVIEW PARSED STATUTORY TABLES */}
              {uploadStep === 2 && uploadedJson && (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center justify-between">
                    <div>
                      <p className="font-bold">✓ File Validated Successfully (Error Report: NIL)</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        GSTIN: <b>{uploadedJson.gstin}</b> | Return Period: <b>{uploadedJson.ret_period}</b> | Type: <b>{uploadedJson.filing_typ}</b>
                      </p>
                    </div>
                    <button
                      onClick={() => setUploadStep(1)}
                      className="text-xs text-[#003366] underline font-bold"
                    >
                      Change File
                    </button>
                  </div>

                  {/* Table 3.1 Outward Supplies */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800 border-b border-slate-300 flex justify-between">
                      <span>3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge</span>
                      <span className="text-emerald-700">Matched with GSTR-1</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] border-b border-slate-200 text-slate-600">
                          <th className="p-2">Nature of Supplies</th>
                          <th className="p-2 text-right">Total Taxable Value (₹)</th>
                          <th className="p-2 text-right">IGST (₹)</th>
                          <th className="p-2 text-right">CGST (₹)</th>
                          <th className="p-2 text-right">SGST (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="p-2 font-medium">
                            (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
                          </td>
                          <td className="p-2 text-right font-mono font-semibold">
                            ₹{(uploadedJson.sup_details?.osup_det?.txval || 125000).toLocaleString("en-IN")}
                          </td>
                          <td className="p-2 text-right font-mono">
                            ₹{(uploadedJson.sup_details?.osup_det?.iamt || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-emerald-800">
                            ₹{(uploadedJson.sup_details?.osup_det?.camt || 11250).toLocaleString("en-IN")}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-emerald-800">
                            ₹{(uploadedJson.sup_details?.osup_det?.samt || 11250).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 4 Eligible ITC */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800 border-b border-slate-300 flex justify-between">
                      <span>4. Eligible Input Tax Credit (ITC)</span>
                      <span className="text-blue-700">Reconciled with GSTR-2B</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] border-b border-slate-200 text-slate-600">
                          <th className="p-2">Details</th>
                          <th className="p-2 text-right">IGST (₹)</th>
                          <th className="p-2 text-right">CGST (₹)</th>
                          <th className="p-2 text-right">SGST (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="p-2 font-medium">(A)(5) All other ITC (Purchases from registered vendors)</td>
                          <td className="p-2 text-right font-mono">₹0.00</td>
                          <td className="p-2 text-right font-mono font-semibold text-blue-800">₹7,200.00</td>
                          <td className="p-2 text-right font-mono font-semibold text-blue-800">₹7,200.00</td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-red-50/40">
                          <td className="p-2 font-medium text-red-800">
                            (B)(1) Ineligible ITC under Section 17(5) (Blocked Credit)
                          </td>
                          <td className="p-2 text-right font-mono text-red-800">₹0.00</td>
                          <td className="p-2 text-right font-mono font-semibold text-red-800">₹1,800.00</td>
                          <td className="p-2 text-right font-mono font-semibold text-red-800">₹1,800.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Form Submission Action */}
                  <form onSubmit={handleFileWithEvc} className="p-4 bg-slate-50 border border-slate-300 rounded flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">Ready for Electronic Verification (EVC)</p>
                      <p className="text-[11px] text-slate-500">
                        Enter 6-digit OTP sent to registered mobile ending in *1Z5 (Demo: <b>123456</b>)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={evcCode}
                        onChange={(e) => setEvcCode(e.target.value)}
                        className="w-28 text-center font-mono font-bold py-1.5 border border-slate-300 rounded bg-white"
                      />
                      <button
                        type="submit"
                        disabled={evcLoading}
                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold transition-colors cursor-pointer"
                      >
                        {evcLoading ? "Submitting…" : "FILE GSTR-3B WITH EVC"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 3: STATUTORY FILING CONFIRMATION & RECEIPT */}
              {uploadStep === 3 && (
                <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-emerald-900">
                      GSTR-3B Successfully Filed on Common Portal!
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Return for Tax Period <b>September 2026</b> has been received and logged in the National GST Registry.
                    </p>
                  </div>

                  {/* Receipt Box */}
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-lg p-4 text-left font-mono text-xs flex flex-col gap-1.5">
                    <p><b>Acknowledgment Reference Number (ARN):</b> <span className="text-emerald-800 font-bold">{filingArn || "AA3209260049281"}</span></p>
                    <p><b>GSTIN:</b> {currentBusiness.gstin}</p>
                    <p><b>Legal Name:</b> {currentBusiness.name}</p>
                    <p><b>Return Type:</b> Form GSTR-3B (Monthly Summary)</p>
                    <p><b>Date & Time of Filing:</b> {filingDate || new Date().toLocaleString("en-IN")}</p>
                    <p><b>Mode of Verification:</b> Aadhaar OTP / EVC (Electronic Verification Code)</p>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className="px-5 py-2 bg-[#003366] text-white rounded font-bold text-xs"
                    >
                      Done & Close
                    </button>
                    <a
                      href="http://localhost:3000/gst-summary"
                      className="px-5 py-2 border border-slate-300 bg-white hover:bg-slate-50 rounded font-bold text-xs text-slate-700"
                    >
                      Back to GST Lite Workspace
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-slate-300 text-center py-4 text-xs text-slate-500">
        <p>© Goods and Services Tax Network (GSTN) · Simulated Educational Replica for GST Lite Academic Demonstration</p>
      </footer>
    </div>
  );
}

