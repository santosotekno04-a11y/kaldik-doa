import { cn } from "@/lib/utils/cn";
import { STATUS_BADGE_COLORS } from "@/lib/constants/status";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass =
    STATUS_BADGE_COLORS[status] || STATUS_BADGE_COLORS.Draft;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
        colorClass,
        className
      )}
    >
      {status}
    </span>
  );
}
