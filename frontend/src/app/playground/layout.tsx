import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface PlaygroundLayoutProps {
  children: ReactNode;
}

export default function PlaygroundLayout({
  children,
}: PlaygroundLayoutProps) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}