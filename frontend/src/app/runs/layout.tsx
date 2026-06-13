import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface RunsLayoutProps {
  children: ReactNode;
}

export default function RunsLayout({
  children,
}: RunsLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}