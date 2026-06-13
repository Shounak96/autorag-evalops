import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface QualityGateLayoutProps {
  children: ReactNode;
}

export default function QualityGateLayout({
  children,
}: QualityGateLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}