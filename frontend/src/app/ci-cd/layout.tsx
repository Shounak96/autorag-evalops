import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface CICDLayoutProps {
  children: ReactNode;
}

export default function CICDLayout({
  children,
}: CICDLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}