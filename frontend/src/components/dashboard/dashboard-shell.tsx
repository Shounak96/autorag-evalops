import type { ReactNode } from "react";

import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <div className="lg:pl-72">
        <Topbar />

        <main className="px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}