"use client";

import { Bell, CircleUserRound } from "lucide-react";
import { HealthStatusBadge } from "@/components/dashboard/health-status-badge";
import { usePathname } from "next/navigation";

interface RouteMetadata {
  eyebrow: string;
  title: string;
}

const routeMetadata: Record<string, RouteMetadata> = {
  "/dashboard": {
    eyebrow: "LLMOps Workspace",
    title: "Evaluation Dashboard",
  },
  "/playground": {
    eyebrow: "Agentic RAG Workspace",
    title: "Advanced RAG Playground",
  },
  "/documents": {
    eyebrow: "Knowledge Base",
    title: "Document Management",
  },
  "/runs": {
    eyebrow: "Evaluation History",
    title: "Evaluation Runs",
  },
  "/prompts": {
    eyebrow: "Prompt Engineering",
    title: "Prompt Versions",
  },
};

export function Topbar() {
  const pathname = usePathname();

  const metadata =
    routeMetadata[pathname] ?? routeMetadata["/dashboard"];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-20 items-center justify-between px-5 sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
            {metadata.eyebrow}
          </p>

          <h1 className="mt-1 text-lg font-semibold text-slate-950">
            {metadata.title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <HealthStatusBadge />

          <button
            type="button"
            aria-label="Notifications"
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Bell className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label="User account"
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <CircleUserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}