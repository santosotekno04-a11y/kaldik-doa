export const UNITS = [
  { id: "U001", code: "U001", name: "Universal", color: "gray" },
  { id: "U002", code: "U002", name: "TK", color: "rose" },
  { id: "U003", code: "U003", name: "SD", color: "blue" },
  { id: "U004", code: "U004", name: "SMP", color: "purple" },
  { id: "U005", code: "U005", name: "Manajemen", color: "green" },
] as const;

export type UnitCode = (typeof UNITS)[number]["code"];

export const UNIT_MAP: Record<string, string> = {
  universal: "U001",
  uni: "U001",
  tk: "U002",
  toddler: "U002",
  kb: "U002",
  sd: "U003",
  smp: "U004",
  manajemen: "U005",
  mng: "U005",
  management: "U005",
};

export const UNIT_BADGE_COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
