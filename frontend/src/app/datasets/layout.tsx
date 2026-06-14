import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface DatasetsLayoutProps {
  children: ReactNode;
}

export default function DatasetsLayout({
  children,
}: DatasetsLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}