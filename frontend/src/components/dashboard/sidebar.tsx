"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenText,
  Boxes,
  BrainCircuit,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const navigationGroups = [
  {
    label: "Platform",
    items: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: BarChart3,
      },
      {
        label: "Documents",
        href: "/documents",
        icon: FileText,
      },
      {
        label: "RAG Playground",
        href: "/playground",
        icon: BrainCircuit,
      },
    ],
  },
  {
    label: "Evaluation",
    items: [
      {
        label: "Datasets",
        href: "/datasets",
        icon: Boxes,
      },
      {
        label: "Evaluation Runs",
        href: "/runs",
        icon: Activity,
      },
      {
        label: "Prompt Versions",
        href: "/prompts",
        icon: BookOpenText,
      },
      {
        label: "A/B Comparisons",
        href: "/comparisons",
        icon: GitCompareArrows,
      },
    ],
  },
  {
    label: "Delivery",
    items: [
      {
        label: "Quality Gate",
        href: "/quality-gate",
        icon: ShieldCheck,
      },
      {
        label: "CI/CD Pipeline",
        href: "/pipeline",
        icon: Rocket,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-950/40">
          <Sparkles className="h-5 w-5 text-white" />
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-white">
            AutoRAG EvalOps
          </p>

          <p className="text-xs text-slate-400">
            Agentic RAG Platform
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
        {navigationGroups.map((group) => (
          <section key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/30"
                        : "text-slate-400 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-cyan-300" />

            <p className="text-xs font-semibold text-slate-200">
              Evaluation Mode
            </p>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Quality-gate checks and grounded evaluation traces are enabled.
          </p>
        </div>
      </div>
    </aside>
  );
}