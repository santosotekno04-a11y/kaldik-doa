"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  CalendarDays,
  Palette,
  AlertCircle,
  CalendarOff,
  Users,
  Star,
  BookHeart,
  ScrollText,
  FileDown,
  FileUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
} from "lucide-react";
import { useState } from "react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kaldik", label: "Kaldik", icon: CalendarDays },
  { href: "/jadwal", label: "Jadwal", icon: CalendarClock },
  { href: "/tema-bulanan", label: "Tema Bulanan", icon: Palette },
  { href: "/perlu-cek", label: "Perlu Cek", icon: AlertCircle },
  { href: "/tanpa-tanggal", label: "Tanpa Tanggal", icon: CalendarOff },
  { href: "/karyawan", label: "Karyawan", icon: Users },
  { href: "/hari-khusus", label: "Hari Khusus", icon: Star },
  { href: "/generate-doa", label: "Generate Doa", icon: BookHeart },
  { href: "/hasil-pokok-doa", label: "Hasil Pokok Doa", icon: ScrollText },
  { href: "/export", label: "Export", icon: FileDown },
  { href: "/import-data", label: "Import Data", icon: FileUp },
  { href: "/setting", label: "Setting", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen bg-white border-r border-slate-200 transition-all duration-300 sticky top-0",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-100">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate">
              Kaldik & Doa
            </span>
            <span className="text-xs text-slate-500 truncate">
              Kalender Pendidikan
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 flex-shrink-0",
                      isActive ? "text-indigo-600" : "text-slate-400"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-slate-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
