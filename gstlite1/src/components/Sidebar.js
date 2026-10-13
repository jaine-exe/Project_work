"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  ShieldCheck,
  FileText,
  MessageCircleMore,
  Settings,
  LogOut,
  Building2,
  ChevronRight,
  Check,
  X,
  Receipt,
  Users,
  FolderSync,
  Scale,
} from "lucide-react";
import { auth as authApi, clearToken } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoicing", label: "Sales & E-Invoicing", icon: Receipt },
  { href: "/upload", label: "Upload invoices", icon: UploadCloud },
  { href: "/compliance", label: "Compliance & ITC", icon: ShieldCheck },
  { href: "/gst-summary", label: "GST summary", icon: FileText },
  { href: "/vendors", label: "Vendor scorecard", icon: Users },
  { href: "/integrations", label: "ERP & Tally sync", icon: FolderSync },
  { href: "/notices", label: "Notice desk & cash", icon: Scale },
  { href: "/chat", label: "AI advisor", icon: MessageCircleMore },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [userProfile, setUserProfile] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((data) => {
        if (!cancelled && data) {
          setUserProfile(data);
        }
      })
      .catch(() => {});

    authApi
      .businesses()
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setBusinesses(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  async function handleSwitchBusiness(businessId) {
    setSwitching(true);
    try {
      await authApi.switchBusiness(businessId);
      setShowSwitchModal(false);
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch business:", err);
    } finally {
      setSwitching(false);
    }
  }

  const activeBusiness = userProfile?.business || {
    name: "Ashoka Textiles Pvt. Ltd.",
    gstin: "32AACCA1234F1Z5",
    state: "Kerala",
  };

  const initials = activeBusiness.name
    ? activeBusiness.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "GL";

  return (
    <>
      <aside
        className="hidden md:flex md:flex-col w-64 shrink-0 h-screen sticky top-0"
        style={{ background: "var(--sidebar)" }}
      >
        <div className="flex items-center gap-2.5 px-6 pt-6 pb-5">
          <div
            className="flex items-center justify-center rounded-lg w-8 h-8 font-display font-bold text-sm"
            style={{ background: "var(--sidebar-active)", color: "white" }}
          >
            G
          </div>
          <div>
            <p className="font-display font-bold text-[15px] leading-tight" style={{ color: "var(--ink-on-dark)" }}>
              GST Lite
            </p>
            <p className="text-[11px]" style={{ color: "var(--ink-on-dark-soft)" }}>
              AI compliance copilot
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--sidebar-active)" : "transparent",
                  color: active ? "white" : "var(--ink-on-dark-soft)",
                }}
              >
                <Icon size={17} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 flex flex-col gap-0.5">
          <Link
            href="/register"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={{ color: "var(--ink-on-dark-soft)" }}
          >
            <Building2 size={17} />
            Add new entity / branch
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left cursor-pointer"
            style={{ color: "var(--ink-on-dark-soft)" }}
          >
            <LogOut size={17} />
            Log out
          </button>

          {/* Active Business Card & Switcher */}
          <div
            onClick={() => setShowSwitchModal(true)}
            className="mt-3 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2.5 cursor-pointer hover:opacity-90 transition-all border border-white/5"
            style={{ background: "var(--sidebar-hover)" }}
            title="Click to switch active GSTIN / Entity"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="flex items-center justify-center rounded-lg w-8 h-8 text-xs font-bold shrink-0"
                style={{ background: "var(--gold)", color: "white" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--ink-on-dark)" }}>
                  {activeBusiness.name}
                </p>
                <p className="text-[10px] font-mono-data truncate" style={{ color: "var(--ink-on-dark-soft)" }}>
                  {activeBusiness.gstin}
                </p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/80 shrink-0">
              Switch
            </span>
          </div>
        </div>
      </aside>

      {/* Multi-Entity Switcher Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl relative"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Building2 size={18} style={{ color: "var(--primary)" }} />
                <span>Switch Active Entity (Multi-GSTIN)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <p className="text-xs text-slate-500 mb-1">
                Select a registered company to switch your active workspace, invoices, and filing periods:
              </p>

              {businesses.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No other businesses registered.
                </div>
              ) : (
                businesses.map((b) => {
                  const isActive = b.id === activeBusiness.id || b.gstin === activeBusiness.gstin;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={switching || isActive}
                      onClick={() => handleSwitchBusiness(b.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/40"
                          : "hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      style={{ borderColor: isActive ? "var(--primary)" : "var(--border)" }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-xs text-slate-900">{b.name}</p>
                          {isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="font-mono-data text-[11px] text-slate-500 mt-0.5">
                          {b.gstin} {b.state ? `· ${b.state}` : ""}
                        </p>
                      </div>

                      {isActive ? (
                        <Check size={16} className="text-emerald-600 shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}

              <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border-soft)" }}>
                <Link
                  href="/register"
                  onClick={() => setShowSwitchModal(false)}
                  className="text-xs font-semibold hover:underline flex items-center gap-1"
                  style={{ color: "var(--primary)" }}
                >
                  + Register new company GSTIN
                </Link>
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
