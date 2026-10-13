"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  UploadCloud,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Building2,
  KeyRound,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import PipelineStepper from "@/components/PipelineStepper";
import { auth, setToken, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await auth.login(email, password);
      setToken(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server. Is the backend running at http://127.0.0.1:8000?"
      );
      setLoading(false);
    }
  }

  async function handleQuickLogin(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
    setLoading(true);
    try {
      const { access_token } = await auth.login(demoEmail, demoPassword);
      setToken(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to log in with demo account. Ensure backend is running."
      );
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (resetNewPassword.length < 8) {
      setResetError("New password must be at least 8 characters long.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await auth.resetPassword(resetEmail, resetNewPassword);
      setResetSuccess(res.message || "Password updated! You can now log in.");
      setEmail(resetEmail);
      setPassword(resetNewPassword);
      setTimeout(() => {
        setShowForgotModal(false);
        setResetSuccess("");
      }, 1500);
    } catch (err) {
      setResetError(err.message || "Could not reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between px-12 py-12 relative overflow-hidden"
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
            Built for MSME filers
          </p>
          <h1 className="font-display text-[34px] leading-[1.15] font-bold mb-4" style={{ color: "var(--ink-on-dark)" }}>
            From raw invoices to a filed return, explained in plain language.
          </h1>
          <p className="text-[15px] leading-relaxed mb-8" style={{ color: "var(--ink-on-dark-soft)" }}>
            GST Lite reads your invoices, checks them against actual GST law, scores your filing
            risk, and tells you exactly what to fix — before the deadline finds you.
          </p>

          <div className="rounded-xl p-5" style={{ background: "var(--sidebar-hover)" }}>
            <p className="text-xs font-medium mb-4" style={{ color: "var(--ink-on-dark-soft)" }}>
              Every invoice follows this path
            </p>
            <PipelineStepper currentStage="risk" />
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-xs" style={{ color: "var(--ink-on-dark-soft)" }}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} /> Rule-accurate compliance engine
          </span>
          <span className="flex items-center gap-1.5">
            <UploadCloud size={14} /> Bulk invoice parsing
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-sm my-auto">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div
              className="flex items-center justify-center rounded-lg w-8 h-8 font-display font-bold text-sm text-white"
              style={{ background: "var(--primary)" }}
            >
              G
            </div>
            <span className="font-display font-bold text-[15px]">GST Lite</span>
          </div>

          <h2 className="font-display text-2xl font-bold mb-1.5">Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
            Log in with your credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div
                className="flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm"
                style={{ background: "var(--danger-light)", color: "var(--danger)" }}
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                className="rounded-lg px-3.5 py-2.5 text-sm border outline-none transition-shadow"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Password
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="rounded-lg px-3.5 py-2.5 text-sm border outline-none transition-shadow"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
            </label>

            <div className="flex items-center justify-between text-sm -mt-1">
              <label className="flex items-center gap-2 select-none" style={{ color: "var(--ink-soft)" }}>
                <input type="checkbox" defaultChecked className="rounded" style={{ accentColor: "var(--primary)" }} />
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email || "");
                  setShowForgotModal(true);
                }}
                className="font-medium text-xs hover:underline cursor-pointer"
                style={{ color: "var(--primary)" }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-70 cursor-pointer shadow-sm"
              style={{ background: "var(--primary)" }}
            >
              {loading ? "Signing in…" : "Log in"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* 1-Click Demo Profiles */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2 size={13} style={{ color: "var(--primary)" }} />
                1-Click Demo Profiles
              </p>
              <span className="text-[10px] text-slate-400">Pre-seeded test workspaces</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("jaine@test.com", "password123")}
                className="flex items-center justify-between p-2.5 rounded-xl border text-left hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-xs cursor-pointer group"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-emerald-700">
                    Ashoka Textiles Pvt. Ltd.
                  </p>
                  <p className="font-mono-data text-[11px] text-slate-500">
                    32AACCA1234F1Z5 · Jaine Thomas
                  </p>
                </div>
                <span
                  className="font-semibold px-2 py-1 rounded text-[11px] shrink-0"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}
                >
                  Launch →
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("alan@example.com", "password123")}
                className="flex items-center justify-between p-2.5 rounded-xl border text-left hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-xs cursor-pointer group"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-emerald-700">
                    Alan Enterprises Pvt Ltd
                  </p>
                  <p className="font-mono-data text-[11px] text-slate-500">
                    32AAECS1234F1Z5 · Alan Test
                  </p>
                </div>
                <span
                  className="font-semibold px-2 py-1 rounded text-[11px] shrink-0"
                  style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}
                >
                  Launch →
                </span>
              </button>
            </div>
          </div>

          <p className="text-sm text-center mt-6" style={{ color: "var(--ink-soft)" }}>
            New to GST Lite?{" "}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot / Reset Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <KeyRound size={18} style={{ color: "var(--primary)" }} />
                <span>Reset Account Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="mt-4 flex flex-col gap-3.5">
              <p className="text-xs text-slate-600">
                Enter your registered email and your desired new password to update your login credentials.
              </p>

              {resetError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">Account Email</span>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="rounded-lg px-3 py-2 text-sm border outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">New Password (Min 8 chars)</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  className="rounded-lg px-3 py-2 text-sm border outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </label>

              <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t" style={{ borderColor: "var(--border-soft)" }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                  style={{ background: "var(--primary)" }}
                >
                  {resetLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                  {resetLoading ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
