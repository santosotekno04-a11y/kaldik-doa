"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
};

export function Topbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex items-center h-14 px-4 lg:px-6 bg-white border-b border-slate-200">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
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
    </header>
  );
}
