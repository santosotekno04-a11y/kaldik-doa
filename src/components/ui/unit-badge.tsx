import { cn } from "@/lib/utils/cn";
import { UNITS, UNIT_BADGE_COLORS } from "@/lib/constants/units";

interface UnitBadgeProps {
  unitName: string;
  className?: string;
}

export function UnitBadge({ unitName, className }: UnitBadgeProps) {
  const unit = UNITS.find((u) => u.name === unitName);
  const colorClass = unit
    ? UNIT_BADGE_COLORS[unit.color] || UNIT_BADGE_COLORS.gray
    : UNIT_BADGE_COLORS.gray;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
        colorClass,
        className
      )}
    >
      {unitName}
    </span>
  );
}
