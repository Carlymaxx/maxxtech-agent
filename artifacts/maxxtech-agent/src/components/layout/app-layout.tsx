import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { Zap, Menu, X } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  // Close drawer when route changes
  if (typeof location === "string" && mobileOpen) {
    // don't auto-close here to avoid re-render loops; handle in sidebar clicks instead
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground dark">
      {/* ── Desktop Sidebar ────────────────────────────────── */}
      <div className="hidden md:flex w-[280px] shrink-0 border-r border-border bg-sidebar flex-col h-full">
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <Zap className="w-5 h-5 fill-primary text-primary" />
            <span>MaxxTech</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <Sidebar onNavigate={() => {}} />
        </div>
      </div>

      {/* ── Mobile Drawer Overlay ──────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Sliding Drawer ──────────────────────────── */}
      <div
        className={`fixed top-0 left-0 h-full w-[280px] z-50 bg-sidebar border-r border-border flex flex-col md:hidden transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-lg" onClick={() => setMobileOpen(false)}>
            <Zap className="w-5 h-5 fill-primary text-primary" />
            <span>MaxxTech</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden h-14 border-b border-border flex items-center px-4 shrink-0 bg-background/95 backdrop-blur sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary mr-2 -ml-1"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 text-primary font-bold">
            <Zap className="w-4 h-4 fill-primary text-primary" />
            <span className="text-base">MaxxTech</span>
          </Link>
        </div>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
