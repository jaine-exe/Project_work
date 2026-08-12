"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UploadCloud, Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import PipelineStepper from "@/components/PipelineStepper";
import { auth, setToken, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
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
          <p className="text-sm mb-8" style={{ color: "var(--ink-soft)" }}>
            Log in with your email to continue.
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
                <input type="checkbox" className="rounded" style={{ accentColor: "var(--primary)" }} />
                Keep me signed in
              </label>
              <a href="#" className="font-medium" style={{ color: "var(--primary)" }}>
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-70"
              style={{ background: "var(--primary)" }}
            >
              {loading ? "Signing in…" : "Log in"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-sm text-center mt-8" style={{ color: "var(--ink-soft)" }}>
            New to GST Lite?{" "}
            <a href="#" className="font-semibold" style={{ color: "var(--primary)" }}>
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
