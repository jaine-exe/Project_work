"use client";

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
} from "lucide-react";
import { business } from "@/lib/mock-data";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload invoices", icon: UploadCloud },
  { href: "/compliance", label: "Compliance report", icon: ShieldCheck },
  { href: "/gst-summary", label: "GST summary", icon: FileText },
  { href: "/chat", label: "AI advisor", icon: MessageCircleMore },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
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
          href="#"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ color: "var(--ink-on-dark-soft)" }}
        >
          <Settings size={17} />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left"
          style={{ color: "var(--ink-on-dark-soft)" }}
        >
          <LogOut size={17} />
          Log out
        </button>

        <div
          className="mt-3 rounded-lg px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: "var(--sidebar-hover)" }}
        >
          <div
            className="flex items-center justify-center rounded-full w-8 h-8 text-xs font-semibold shrink-0"
            style={{ background: "var(--gold)", color: "white" }}
          >
            AT
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--ink-on-dark)" }}>
              {business.name}
            </p>
            <p className="text-[11px] font-mono-data truncate" style={{ color: "var(--ink-on-dark-soft)" }}>
              {business.gstin}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
