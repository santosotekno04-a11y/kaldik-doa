'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  CalendarDays, AlertCircle, CalendarOff, Users, Star, BookHeart,
  RefreshCw, FileUp, Plus, ArrowRight, Clock, CheckCircle2, Loader2,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { UnitBadge } from '@/components/ui/unit-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/lib/supabase/client';
import { formatDate, getMonthName } from '@/lib/utils/date';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

interface DashboardData {
  kaldik_bulan_ini: number;
  perlu_cek: number;
  tanpa_tanggal: number;
  karyawan_aktif: number;
  hari_khusus_bulan_ini: number;
  pokok_doa_bulan_ini: number;
  agenda_terdekat: Record<string, unknown>[];
  last_sync: Record<string, unknown> | null;
  ta_aktif: string;
  semester_aktif: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { addToast } = useToast();

  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  const fetchDashboard = async () => {
    try {
      const [kaldikRes, perluCekRes, tanpaRes, karyawanRes, hariRes, doaRes, agendaRes, syncRes, settingsRes] = await Promise.all([
        supabase.from('kaldik').select('id', { count: 'exact', head: true }).eq('bulan', bulan).eq('tahun', tahun).neq('status', 'Dibatalkan'),
        supabase.from('perlu_cek').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('tanpa_tanggal').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('karyawan').select('id', { count: 'exact', head: true }).eq('status', 'Aktif'),
        supabase.from('hari_khusus').select('id', { count: 'exact', head: true }).gte('tanggal', `${tahun}-${String(bulan).padStart(2, '0')}-01`).lt('tanggal', `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`),
        supabase.from('pokok_doa').select('id', { count: 'exact', head: true }).eq('bulan', bulan).eq('tahun', tahun),
        supabase.from('kaldik').select('*, unit:units(name, color)').gte('tanggal_mulai', now.toISOString().split('T')[0]).neq('status', 'Dibatalkan').order('tanggal_mulai', { ascending: true }).limit(5),
        supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(1),
        supabase.from('settings').select('key, value').in('key', ['TA_AKTIF', 'SEMESTER_AKTIF']),
      ]);

      const settingsMap: Record<string, string> = {};
      (settingsRes.data || []).forEach((s: Record<string, string>) => { settingsMap[s.key] = s.value; });

      setData({
        kaldik_bulan_ini: kaldikRes.count || 0,
        perlu_cek: perluCekRes.count || 0,
        tanpa_tanggal: tanpaRes.count || 0,
        karyawan_aktif: karyawanRes.count || 0,
        hari_khusus_bulan_ini: hariRes.count || 0,
        pokok_doa_bulan_ini: doaRes.count || 0,
        agenda_terdekat: agendaRes.data || [],
        last_sync: syncRes.data?.[0] || null,
        ta_aktif: settingsMap.TA_AKTIF || '2026-2027',
        semester_aktif: settingsMap.SEMESTER_AKTIF || '1',
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/manual', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        addToast('success', `Sync berhasil! ${result.inserted || 0} ditambah, ${result.updated || 0} diupdate.`);
        fetchDashboard();
      } else {
        addToast('error', `Sync gagal: ${result.error || 'Unknown error'}`);
      }
    } catch {
      addToast('error', 'Gagal terhubung ke server sync');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan Kaldik & Pokok Doa — {getMonthName(bulan)} {tahun}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Ringkasan</h2>
          <Link href="/kaldik" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
            Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
          <Link href="/kaldik" className="group">
            <StatCard label="Agenda Bulan Ini" value={d.kaldik_bulan_ini} icon={CalendarDays} color="indigo" className="group-hover:shadow-lg group-hover:scale-[1.02] transition-all cursor-pointer" />
          </Link>
          <Link href="/perlu-cek" className="group">
            <StatCard label="Perlu Cek" value={d.perlu_cek} icon={AlertCircle} color="amber" className="group-hover:shadow-lg group-hover:scale-[1.02] transition-all cursor-pointer" />
          </Link>
          <Link href="/tanpa-tanggal" className="group">
            <StatCard label="Tanpa Tanggal" value={d.tanpa_tanggal} icon={CalendarOff} color="red" className="group-hover:shadow-lg group-hover:scale-[1.02] transition-all cursor-pointer" />
          </Link>
          <Link href="/karyawan" className="group">
            <StatCard label="Karyawan Aktif" value={d.karyawan_aktif} icon={Users} color="emerald" className="group-hover:shadow-lg group-hover:scale-[1.02] transition-all cursor-pointer" />
          </Link>
          <Link href="/hari-khusus" className="group">
            <StatCard label="Hari Khusus" value={d.hari_khusus_bulan_ini} icon={Star} color="purple" className="group-hover:shadow-lg group-hover:scale-[1.02] transition-all cursor-pointer" />
          </Link>
          <Link href="/hasil-pokok-doa" className="group">
            <StatCard label="Pokok Doa" value={d.pokok_doa_bulan_ini} icon={BookHeart} color="blue" className="group-hover:shadow-lg group-hover:scale-[1.02] transition-all cursor-pointer" />
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/kaldik" className="flex items-center gap-3 p-4 min-h-[56px] bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all group">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 group-hover:scale-110 transition-all">
            <Plus className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Tambah Agenda</p>
            <p className="text-xs text-slate-500 truncate">Kaldik baru</p>
          </div>
        </Link>
        <Link href="/import-data" className="flex items-center gap-3 p-4 min-h-[56px] bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-emerald-200 hover:scale-[1.02] active:scale-[0.98] transition-all group">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
            <FileUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Import Data</p>
            <p className="text-xs text-slate-500 truncate">CSV / Spreadsheet</p>
          </div>
        </Link>
        <Link href="/generate-doa" className="flex items-center gap-3 p-4 min-h-[56px] bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-purple-200 hover:scale-[1.02] active:scale-[0.98] transition-all group">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 group-hover:scale-110 transition-all">
            <BookHeart className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Generate Doa</p>
            <p className="text-xs text-slate-500 truncate">Pokok doa bulanan</p>
          </div>
        </Link>
        <button onClick={handleSync} disabled={syncing} className="flex items-center gap-3 p-4 min-h-[56px] bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-blue-200 hover:scale-[1.02] active:scale-[0.98] transition-all group disabled:opacity-50 disabled:hover:scale-100">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 group-hover:scale-110 transition-all">
            <RefreshCw className={`w-5 h-5 text-blue-600 ${syncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{syncing ? 'Syncing...' : 'Sync Sekarang'}</p>
            <p className="text-xs text-slate-500 truncate">Spreadsheet → Supabase</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Agenda Terdekat */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Agenda Terdekat</h2>
            </div>
            <Link href="/kaldik" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {d.agenda_terdekat.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Belum ada agenda terdekat</div>
            ) : (
              d.agenda_terdekat.map((agenda: Record<string, unknown>) => {
                const unit = agenda.unit as Record<string, string> | null;
                const tanggal = agenda.tanggal_mulai as string;
                return (
                  <Link key={agenda.id as string} href="/kaldik" className="flex items-center gap-4 px-5 py-3.5 hover:bg-indigo-50/60 transition-colors cursor-pointer group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex flex-col items-center justify-center group-hover/item:bg-indigo-100 transition-colors">
                      <span className="text-xs font-bold text-indigo-600">{tanggal?.split('-')[2]}</span>
                      <span className="text-[10px] text-indigo-400">{getMonthName(parseInt(tanggal?.split('-')[1] || '0')).slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{agenda.nama_kegiatan as string}</p>
                      <p className="text-xs text-slate-500 truncate">{agenda.kategori as string}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {unit && <UnitBadge unitName={unit.name} />}
                      <StatusBadge status={agenda.status as string} />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Status Sync & Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900">Status Sync</h2>
              </div>
              <Link href="/setting" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                Lihat Detail <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Terakhir</span>
                <span className="text-xs font-medium text-slate-700">
                  {d.last_sync ? formatDate(d.last_sync.finished_at as string || d.last_sync.created_at as string) : 'Belum pernah'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Status</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${(d.last_sync?.status as string) === 'success' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {d.last_sync ? (d.last_sync.status as string === 'success' ? 'Berhasil' : d.last_sync.status as string) : 'Belum ada'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Jadwal</span>
                <span className="text-xs font-medium text-slate-700">Setiap Selasa</span>
              </div>
              {d.last_sync && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Data diproses</span>
                  <span className="text-xs font-medium text-slate-700">{(d.last_sync.total_rows as number) || 0} baris</span>
                </div>
              )}
            </div>
            <button onClick={handleSync} disabled={syncing} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 min-h-[44px] bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Sekarang'}
            </button>
          </div>

          <Link href="/setting" className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Tahun Ajaran Aktif</h2>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Tahun Ajaran</span>
                <span className="text-sm font-bold text-indigo-600">{d.ta_aktif}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Semester</span>
                <span className="text-sm font-bold text-indigo-600">{d.semester_aktif} ({d.semester_aktif === '1' ? 'Ganjil' : 'Genap'})</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
