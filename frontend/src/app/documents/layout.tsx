import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface DocumentsLayoutProps {
  children: ReactNode;
}

export default function DocumentsLayout({
  children,
}: DocumentsLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}