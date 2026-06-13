import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface ComparisonsLayoutProps {
  children: ReactNode;
}

export default function ComparisonsLayout({
  children,
}: ComparisonsLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}