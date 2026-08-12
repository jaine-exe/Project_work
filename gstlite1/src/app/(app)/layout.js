import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import AuthGuard from "@/components/AuthGuard";

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
        <Sidebar />
        <div className="flex-1 min-w-0 pb-16 md:pb-0">{children}</div>
        <MobileNav />
      </div>
    </AuthGuard>
  );
}
