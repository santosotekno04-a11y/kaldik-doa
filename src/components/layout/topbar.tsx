"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  kaldik: "Kaldik",
  "tema-bulanan": "Tema Bulanan",
  "perlu-cek": "Perlu Cek",
  "tanpa-tanggal": "Tanpa Tanggal",
  karyawan: "Karyawan",
  "hari-khusus": "Hari Khusus",
  "generate-doa": "Generate Doa",
  "hasil-pokok-doa": "Hasil Pokok Doa",
  export: "Export",
  "import-data": "Import Data",
  setting: "Setting",
  portal: "Portal Gedung",
  jadwal: "Jadwal",
  profil: "Profil",
};

export function Topbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 bg-white border-b border-slate-200 overflow-hidden">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm min-w-0 overflow-hidden">
        <Link
          href="/dashboard"
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          Home
        </Link>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const label = routeLabels[segment] || segment;
          const isLast = index === segments.length - 1;

          return (
            <span key={href} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              {isLast ? (
                <span className="font-medium text-slate-900">{label}</span>
              ) : (
                <Link
                  href={href}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Settings icon for mobile */}
      <Link
        href="/profil"
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        title="Profil & Pengaturan"
      >
        <Settings className="w-5 h-5" />
      </Link>
    </header>
  );
}
