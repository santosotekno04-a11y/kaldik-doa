export const KALDIK_STATUS = [
  "Draft",
  "Valid",
  "Perlu Cek",
  "Final",
  "Dibatalkan",
  "Diarsipkan",
] as const;

export type KaldikStatus = (typeof KALDIK_STATUS)[number];

export const STATUS_BADGE_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Valid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Perlu Cek": "bg-amber-100 text-amber-700 border-amber-200",
  Final: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Dibatalkan: "bg-red-100 text-red-700 border-red-200",
  Diarsipkan: "bg-slate-100 text-slate-600 border-slate-200",
  Locked: "bg-purple-100 text-purple-700 border-purple-200",
  "Auto Draft": "bg-gray-100 text-gray-700 border-gray-200",
  "Edited Manual": "bg-amber-100 text-amber-700 border-amber-200",
};

export const DOA_STATUS = ["Auto Draft", "Edited Manual", "Final"] as const;

export type DoaStatus = (typeof DOA_STATUS)[number];

export const KATEGORI_LIST = [
  "Ibadah",
  "Ujian",
  "Rapor",
  "Asesmen",
  "MPLS",
  "Home Visit",
  "Orientasi",
  "Ulang Tahun",
  "Libur",
  "Kegiatan",
  "Rapat",
  "Umum",
  "Sabtu",
  "Minggu",
  "Doa Umum Harian",
] as const;

export const KATEGORI_PRIORITY: Record<string, number> = {
  Ibadah: 3,
  Ujian: 4,
  Rapor: 4,
  Asesmen: 4,
  MPLS: 5,
  "Home Visit": 5,
  Orientasi: 5,
  "Ulang Tahun": 6,
  Libur: 7,
  Kegiatan: 8,
  Rapat: 8,
  Umum: 9,
  Sabtu: 10,
  Minggu: 10,
  "Doa Umum Harian": 11,
};
