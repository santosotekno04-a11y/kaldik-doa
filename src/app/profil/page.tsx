"use client";
export const dynamic = 'force-dynamic';

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  Building2,
  CalendarDays,
  LogOut,
  Shield,
  ChevronRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/modal";

export default function ProfilPage() {
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("kaldik_auth");
    localStorage.removeItem("kaldik_auth_time");
    router.replace("/login");
  };

  const quickLinks = [
    { href: "/setting", label: "Pengaturan Aplikasi", icon: Settings, description: "Konfigurasi, sinkronisasi, dan keamanan" },
    { href: "/portal", label: "Portal Jadwal", icon: Building2, description: "Kelola peminjaman gedung" },
    { href: "/kaldik", label: "Kalender Pendidikan", icon: CalendarDays, description: "Lihat jadwal kaldik" },
  ];

  return (
    <div className="space-y-6 max-w-lg">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profil</h1>
        <p className="text-sm text-slate-500 mt-1">Informasi akun dan pengaturan</p>
      </div>

      {/* App Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg ring-2 ring-white/30 bg-white">
              <Image
                src="/logo-tbi.png"
                alt="Logo TBI"
                width={64}
                height={64}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Kaldik & Doa</h2>
              <p className="text-xs text-blue-100 mt-0.5">Kalender Pendidikan & Pokok Doa Terpadu</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Administrator</p>
              <p className="text-xs text-slate-500">Kelola aplikasi Kaldik & Doa</p>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Shield size={10} />
                Admin
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Menu Cepat</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <link.icon size={16} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{link.label}</p>
                <p className="text-[11px] text-slate-400 truncate">{link.description}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </Link>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <LogOut size={16} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-600">Keluar</p>
            <p className="text-[11px] text-red-400">Logout dari aplikasi</p>
          </div>
        </button>
      </div>

      {/* App Version */}
      <p className="text-center text-[11px] text-slate-400 pb-4">
        Kaldik & Doa v1.0.0
      </p>

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Keluar dari Aplikasi?"
        message="Anda akan logout dan diarahkan ke halaman login. Lanjutkan?"
        confirmText="Keluar"
      />
    </div>
  );
}
