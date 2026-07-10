"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  CalendarDays,
  BookHeart,
  Users,
  MoreHorizontal,
} from "lucide-react";

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kaldik", label: "Kaldik", icon: CalendarDays },
  { href: "/generate-doa", label: "Doa", icon: BookHeart },
  { href: "/karyawan", label: "Karyawan", icon: Users },
  { href: "/setting", label: "Lainnya", icon: MoreHorizontal },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom">
      <ul className="flex items-center justify-around h-16">
        {primaryItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors",
                  isActive
                    ? "text-indigo-600"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
