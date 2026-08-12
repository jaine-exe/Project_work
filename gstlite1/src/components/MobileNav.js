"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UploadCloud, ShieldCheck, FileText, MessageCircleMore } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/compliance", label: "Report", icon: ShieldCheck },
  { href: "/gst-summary", label: "Summary", icon: FileText },
  { href: "/chat", label: "Advisor", icon: MessageCircleMore },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-between px-1 pt-1"
      style={{ background: "var(--sidebar)", paddingBottom: "env(safe-area-inset-bottom, 6px)" }}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg"
            style={{ color: active ? "white" : "var(--ink-on-dark-soft)" }}
          >
            <Icon size={18} strokeWidth={2} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
