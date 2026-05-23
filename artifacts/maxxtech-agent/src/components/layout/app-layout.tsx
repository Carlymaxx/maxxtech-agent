import React from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { Zap } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground dark">
      {/* Sidebar */}
      <div className="w-[280px] shrink-0 border-r border-border bg-sidebar flex flex-col h-full hidden md:flex">
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0 hover-elevate cursor-pointer">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <Zap className="w-5 h-5 fill-primary text-primary" />
            <span>MaxxTech</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden h-14 border-b border-border flex items-center px-4 shrink-0 bg-background">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold">
            <Zap className="w-5 h-5 fill-primary text-primary" />
            <span>MaxxTech</span>
          </Link>
        </div>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
