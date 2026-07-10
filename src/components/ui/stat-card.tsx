import { cn } from "@/lib/utils/cn";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "indigo",
  className,
}: StatCardProps) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    indigo: {
      bg: "bg-indigo-50",
      icon: "text-indigo-600",
      text: "text-indigo-700",
    },
    amber: {
      bg: "bg-amber-50",
      icon: "text-amber-600",
      text: "text-amber-700",
    },
    red: {
      bg: "bg-red-50",
      icon: "text-red-600",
      text: "text-red-700",
    },
    emerald: {
      bg: "bg-emerald-50",
      icon: "text-emerald-600",
      text: "text-emerald-700",
    },
    blue: {
      bg: "bg-blue-50",
      icon: "text-blue-600",
      text: "text-blue-700",
    },
    purple: {
      bg: "bg-purple-50",
      icon: "text-purple-600",
      text: "text-purple-700",
    },
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl",
          c.bg
        )}
      >
        <Icon className={cn("w-6 h-6", c.icon)} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
