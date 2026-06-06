import { AlertTriangle, CheckCircle2, CircleMinus } from "lucide-react";

interface StatusBadgeProps {
  variant: "success" | "warning" | "neutral";
  children: React.ReactNode;
}

export function StatusBadge({
  variant,
  children,
}: StatusBadgeProps) {
  const styles = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700",
    neutral:
      "border-slate-200 bg-slate-50 text-slate-600",
  };

  const icons = {
    success: <CheckCircle2 className="h-3.5 w-3.5" />,
    warning: <AlertTriangle className="h-3.5 w-3.5" />,
    neutral: <CircleMinus className="h-3.5 w-3.5" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[variant]}`}
    >
      {icons[variant]}
      {children}
    </span>
  );
}