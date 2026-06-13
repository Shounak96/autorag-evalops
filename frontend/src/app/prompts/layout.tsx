import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface PromptsLayoutProps {
  children: ReactNode;
}

export default function PromptsLayout({
  children,
}: PromptsLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}