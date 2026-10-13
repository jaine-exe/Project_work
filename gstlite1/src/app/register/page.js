"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Hash,
  MapPin,
} from "lucide-react";
import { auth, setToken, ApiError } from "@/lib/api";

const STATE_CODES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const ALL_STATES = Object.values(STATE_CODES).filter(
  (v, i, a) => a.indexOf(v) === i
).sort();

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function RegisterPage() {
  const router = useRouter();

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [state, setState] = useState("Kerala");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle GSTIN change with Auto-State extraction
  function handleGstinChange(val) {
    const clean = val.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
    setGstin(clean);

    if (clean.length >= 2) {
      const code = clean.slice(0, 2);
      if (STATE_CODES[code]) {
        setState(STATE_CODES[code]);
      }
    }
  }

  const isGstinValid = GSTIN_REGEX.test(gstin);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isGstinValid) {
      setError("Please enter a valid 15-character GSTIN (e.g. 32AACCA1234F1Z5)");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        business_name: businessName.trim(),
        gstin: gstin.trim(),
        state,
      };

      const { access_token } = await auth.register(payload);
      setToken(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Registration failed. Is the backend running at http://127.0.0.1:8000?"
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between px-12 py-12 relative overflow-hidden"
        style={{ background: "var(--sidebar)" }}
      >
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, var(--sidebar-active), transparent 70%)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg w-8 h-8 font-display font-bold text-sm"
            style={{ background: "var(--sidebar-active)", color: "white" }}
          >
            G
          </div>
          <span className="font-display font-bold text-[15px]" style={{ color: "var(--ink-on-dark)" }}>
            GST Lite
          </span>
        </div>

        <div className="relative max-w-md">
          <p
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium mb-6"
            style={{ background: "var(--sidebar-hover)", color: "var(--ink-on-dark)" }}
          >
            <Sparkles size={13} />
            Quick Business Onboarding
          </p>
          <h1 className="font-display text-[32px] leading-[1.18] font-bold mb-4" style={{ color: "var(--ink-on-dark)" }}>
            Get your GST compliance audit-ready in minutes.
          </h1>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: "var(--ink-on-dark-soft)" }}>
            Register your business profile to verify supplier GSTINs, catch entity mismatches before filing, and auto-generate GSTR-3B tax packs.
          </p>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--sidebar-hover)" }}>
            <div className="flex items-center gap-2.5 text-xs text-white font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Automated CGST Act Section 16(2) compliance verification</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Books vs GSTR-2B Input Tax Credit reconciliation</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-white font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Formal PDF return packs & GST portal JSON exports</span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-4 text-xs" style={{ color: "var(--ink-on-dark-soft)" }}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} /> Bank-grade encryption
          </span>
          <span>•</span>
          <span>Rule-grounded legal advisor</span>
        </div>
      </div>

      {/* Registration Form Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div
              className="flex items-center justify-center rounded-lg w-8 h-8 font-display font-bold text-sm text-white"
              style={{ background: "var(--primary)" }}
            >
              G
            </div>
            <span className="font-display font-bold text-[15px]">GST Lite</span>
          </div>

          <h2 className="font-display text-2xl font-bold mb-1.5">Create your business account</h2>
          <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
            Enter your company details to set up your GST workspace.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {error && (
              <div
                className="flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm"
                style={{ background: "var(--danger-light)", color: "var(--danger)" }}
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: User Profile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--ink)" }}>
                  <User size={13} style={{ color: "var(--primary)" }} /> Full Name
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jaine Thomas"
                  className="rounded-lg px-3 py-2 text-sm border outline-none transition-shadow"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--ink)" }}>
                  <Mail size={13} style={{ color: "var(--primary)" }} /> Email Address
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="rounded-lg px-3 py-2 text-sm border outline-none transition-shadow"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--ink)" }}>
                <Lock size={13} style={{ color: "var(--primary)" }} /> Password
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="rounded-lg px-3 py-2 text-sm border outline-none transition-shadow"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
              <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                Must be at least 8 characters long
              </span>
            </label>

            {/* Section 2: Business & GSTIN */}
            <div className="pt-2 border-t" style={{ borderColor: "var(--border-soft)" }}>
              <label className="flex flex-col gap-1 mb-3">
                <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--ink)" }}>
                  <Building2 size={13} style={{ color: "var(--primary)" }} /> Business / Legal Entity Name
                </span>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Nexora Systems Project Lab"
                  className="rounded-lg px-3 py-2 text-sm border outline-none transition-shadow"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold flex items-center justify-between" style={{ color: "var(--ink)" }}>
                    <span className="flex items-center gap-1">
                      <Hash size={13} style={{ color: "var(--primary)" }} /> GSTIN (15 Digits)
                    </span>
                    {isGstinValid && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Valid Format
                      </span>
                    )}
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="32AACCA1234F1Z5"
                    className="font-mono-data rounded-lg px-3 py-2 text-sm uppercase tracking-wider border outline-none transition-shadow"
                    style={{
                      borderColor: isGstinValid ? "var(--primary)" : "var(--border)",
                      background: "var(--surface)",
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--ink)" }}>
                    <MapPin size={13} style={{ color: "var(--primary)" }} /> State Jurisdiction
                  </span>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm border outline-none transition-shadow cursor-pointer"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    {ALL_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-3 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-70 cursor-pointer shadow-sm"
              style={{ background: "var(--primary)" }}
            >
              {loading ? "Registering business workspace…" : "Complete Registration & Launch"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-sm text-center mt-6" style={{ color: "var(--ink-soft)" }}>
            Already registered?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--primary)" }}>
              Log in to your workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

