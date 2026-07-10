"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2, RefreshCw, CheckCircle, XCircle, Clock, Ban,
  ExternalLink, Filter, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Users, CalendarDays, Settings2, List
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PortalJadwal {
  sheetName: string;
  row: number;
  unit: string;
  tanggal: string;
  tanggalDisplay?: string;
  acara: string;
  jamMulai: string;
  jamSelesai: string;
  jam: string;
  persiapan?: string;
  hadirin: number;
  deskripsi?: string;
  status: string;
  catatan?: string;
  pdfUrl?: string;
  kebutuhan?: string;
  docUrl?: string;
}

interface PortalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byUnit: Record<string, { total: number; pending: number; approved: number }>;
}

const UNIT_COLORS: Record<string, string> = {
  TK: "#f43f5e",
  SD: "#3b82f6",
  SMP: "#8b5cf6",
  TBI: "#10b981",
};

const BULAN_LABELS = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const CAL_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const CAL_DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function getTAMonths(startMonth: number, startYear: number) {
  const months: { month: number; year: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    let m = startMonth + i;
    let y = startYear;
    if (m > 12) { m -= 12; y += 1; }
    months.push({ month: m, year: y, label: `${BULAN_LABELS[m].slice(0, 3)} ${y}` });
  }
  return months;
}

function getDaysInMonthGrid(month: number, year: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const days: (number | null)[] = [];
  const startOffset = startDay === 0 ? 6 : startDay - 1;
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function getUnitDotColor(unit: string): string {
  const colors: Record<string, string> = {
    TK: "bg-rose-500",
    SD: "bg-blue-500",
    SMP: "bg-purple-500",
    TBI: "bg-teal-500",
  };
  return colors[unit] || "bg-gray-500";
}

function portalDateMatches(item: PortalJadwal, day: number, month: number, year: number): boolean {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
  if (item.tanggal === dateStr) return true;
  if (item.tanggalDisplay === dateStr) return true;
  try {
    const d = new Date(item.tanggal);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) return true;
  } catch {}
  return false;
}

const PORTAL_URL = "https://script.google.com/macros/s/AKfycbw13TcgOlXWXe2Ry8-RCPa31N_mdhdFIJaslAU2zeyCLROpriMQelTzic2I8NstAm6h/exec"; // Ganti dengan URL Portal asli

async function portalApi(action: string, params: Record<string, unknown> = {}) {
  const resp = await fetch("/api/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  return resp.json();
}

export default function PortalPage() {
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [data, setData] = useState<PortalJadwal[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Academic Year
  const [taStartMonth, setTaStartMonth] = useState(7);
  const [taStartYear, setTaStartYear] = useState(2026);
  const [showTaSettings, setShowTaSettings] = useState(false);
  const taMonths = useMemo(() => getTAMonths(taStartMonth, taStartYear), [taStartMonth, taStartYear]);

  // View mode & Calendar
  const [viewMode, setViewMode] = useState<"table" | "calendar">(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "calendar" : "table"
  );
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<{ day: number; events: PortalJadwal[] } | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (bulan === 0) {
        // Fetch all months in the TA range
        const results = await Promise.all(
          taMonths.map((m) =>
            Promise.all([
              portalApi("getJadwal", { unit: unitFilter, bulan: m.month, tahun: m.year }),
              portalApi("getDashboard", { bulan: m.month, tahun: m.year }),
            ])
          )
        );
        const allJadwal: PortalJadwal[] = [];
        const agg: PortalStats = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0, byUnit: {} };
        for (const [jRes, dRes] of results) {
          if (jRes.data) allJadwal.push(...jRes.data);
          if (dRes.stats) {
            agg.total += dRes.stats.total;
            agg.pending += dRes.stats.pending;
            agg.approved += dRes.stats.approved;
            agg.rejected += dRes.stats.rejected;
            agg.cancelled += dRes.stats.cancelled;
            for (const [u, s] of Object.entries(dRes.stats.byUnit as Record<string, { total: number; pending: number; approved: number }>)) {
              if (!agg.byUnit[u]) agg.byUnit[u] = { total: 0, pending: 0, approved: 0 };
              agg.byUnit[u].total += s.total;
              agg.byUnit[u].pending += s.pending;
              agg.byUnit[u].approved += s.approved;
            }
          }
        }
        setData(allJadwal);
        setStats(agg);
      } else {
        const [jadwalRes, dashRes] = await Promise.all([
          portalApi("getJadwal", { unit: unitFilter, bulan, tahun }),
          portalApi("getDashboard", { bulan, tahun }),
        ]);
        if (jadwalRes.error) throw new Error(jadwalRes.error);
        if (dashRes.error) throw new Error(dashRes.error);
        setData(jadwalRes.data || []);
        setStats(dashRes.stats || null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data Portal";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [unitFilter, bulan, tahun, taMonths]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (item: PortalJadwal, newStatus: string) => {
    const confirmMsg = newStatus === "Approved"
      ? `ACC jadwal "${item.acara}" pada ${item.tanggalDisplay}?`
      : newStatus === "Rejected"
        ? `Tolak jadwal "${item.acara}"?`
        : `Batalkan jadwal "${item.acara}"?`;

    if (!confirm(confirmMsg)) return;

    setActionLoading(item.row);
    try {
      const res = await portalApi("updateStatus", {
        unit: item.unit,
        row: item.row,
        newStatus,
      });
      if (res.error) throw new Error(res.error);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter data
  const filteredData = data.filter((item) => {
    if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter) return false;
    return true;
  });

  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredData.length / pageSize);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: "bg-amber-50 text-amber-700 border-amber-200",
      Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Rejected: "bg-red-50 text-red-700 border-red-200",
      Cancelled: "bg-gray-50 text-gray-500 border-gray-200",
    };
    return styles[status] || styles.Pending;
  };

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[220px_1fr] lg:gap-4">
      {/* Sidebar Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-4 h-fit lg:sticky lg:top-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter</h3>

        {/* Tahun Ajaran */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-gray-400">Tahun Ajaran</label>
            <button
              onClick={() => setShowTaSettings(!showTaSettings)}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Settings2 size={12} />
            </button>
          </div>
          <p className="text-[10px] font-semibold text-blue-600 mb-1.5">
            {BULAN_LABELS[taStartMonth]} {taStartYear} — {(() => { let m = taStartMonth + 11; let y = taStartYear; if (m > 12) { m -= 12; y += 1; } return `${BULAN_LABELS[m]} ${y}`; })()}
          </p>
          {showTaSettings && (
            <div className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 block mb-0.5">Mulai Bulan</label>
                  <select
                    value={taStartMonth}
                    onChange={(e) => {
                      setTaStartMonth(Number(e.target.value));
                      setBulan(0);
                      setPage(0);
                    }}
                    className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-md"
                  >
                    {BULAN_LABELS.slice(1).map((b, i) => (
                      <option key={i + 1} value={i + 1}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 block mb-0.5">Tahun</label>
                  <select
                    value={taStartYear}
                    onChange={(e) => {
                      setTaStartYear(Number(e.target.value));
                      setBulan(0);
                      setPage(0);
                    }}
                    className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-md"
                  >
                    {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <select
            value={bulan === 0 ? "all" : `${bulan}|${tahun}`}
            onChange={(e) => {
              if (e.target.value === "all") {
                setBulan(0);
              } else {
                const [m, y] = e.target.value.split("|").map(Number);
                setBulan(m);
                setTahun(y);
              }
              setPage(0);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua</option>
            {taMonths.map((m, i) => (
              <option key={i} value={`${m.month}|${m.year}`}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <a
            href={PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ExternalLink size={12} />
            Buka Portal
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={20} className="text-blue-600" />
              Portal Jadwal Gedung
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              TA {BULAN_LABELS[taStartMonth]} {taStartYear} — {bulan === 0 ? "Semua Bulan" : `${BULAN_LABELS[bulan]} ${tahun}`}
            </p>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all",
                viewMode === "table"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <List size={12} />
              Tabel
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all",
                viewMode === "calendar"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <CalendarDays size={12} />
              Kalender
            </button>
          </div>
        </div>

        {/* Stats - Interactive as filters */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total", value: stats.total, icon: CalendarDays, color: "text-gray-600", bg: "bg-gray-50", borderActive: "border-gray-400", filterVal: "all" },
              { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", borderActive: "border-amber-400", filterVal: "pending" },
              { label: "Disetujui", value: stats.approved, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", borderActive: "border-emerald-400", filterVal: "approved" },
              { label: "Ditolak", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50", borderActive: "border-red-400", filterVal: "rejected" },
            ].map((s) => {
              const isActive = statusFilter === s.filterVal;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => { setStatusFilter(s.filterVal); setPage(0); }}
                  className={cn(
                    "rounded-xl border-2 p-3 transition-all cursor-pointer text-left",
                    isActive ? `${s.bg} ${s.borderActive} shadow-sm` : "bg-white border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={14} className={s.color} />
                    <span className="text-[11px] font-medium text-gray-500">{s.label}</span>
                  </div>
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Unit Stats - Interactive as filters */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            {["TK", "SD", "SMP", "TBI"].map((u) => {
              const isActive = unitFilter === u;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => { setUnitFilter(isActive ? "ALL" : u); setPage(0); }}
                  className={cn(
                    "bg-white rounded-xl border-2 p-2.5 text-center transition-all cursor-pointer",
                    isActive ? "border-blue-400 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: UNIT_COLORS[u] }}
                  />
                  <p className="text-[11px] font-semibold text-gray-700">{u}</p>
                  <p className="text-xs text-gray-400">{stats.byUnit[u]?.total || 0} jadwal</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          error.toLowerCase().includes("not configured") || error.toLowerCase().includes("portal_proxy_url") ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Portal belum dikonfigurasi</p>
                  <p className="text-xs text-amber-600 mt-1">{error}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-amber-200 p-4 space-y-3 text-xs text-gray-700">
                <p className="font-semibold text-gray-900">Panduan Setup:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Deploy <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">portal-proxy.gs</code> sebagai Google Apps Script terlebih dahulu
                  </li>
                  <li>
                    Buka <span className="font-medium">Vercel Dashboard → Settings → Environment Variables</span>, lalu tambahkan:
                    <div className="mt-1.5 space-y-1 ml-4">
                      <p><code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">PORTAL_PROXY_URL</code> — URL deployment Google Apps Script</p>
                      <p><code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">PORTAL_API_KEY</code> — API key yang sama dengan yang di-set di script</p>
                    </div>
                  </li>
                  <li>Redeploy aplikasi setelah menambahkan environment variables</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Gagal memuat data</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && viewMode === "table" && (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Tanggal</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Acara</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Unit</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Jam</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Hadirin</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-500">Status</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedData.map((item, idx) => (
                      <tr key={`${item.unit}-${item.row}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {item.tanggalDisplay || item.tanggal}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">
                          {item.acara}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                            style={{ backgroundColor: UNIT_COLORS[item.unit] || "#6b7280" }}
                          >
                            {item.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{item.jam}</td>
                        <td className="px-3 py-2 text-gray-500">{item.hadirin}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", getStatusBadge(item.status))}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {item.status === "Pending" && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleAction(item, "Approved")}
                                disabled={actionLoading === item.row}
                                className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                title="ACC"
                              >
                                {actionLoading === item.row ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                              </button>
                              <button
                                onClick={() => handleAction(item, "Rejected")}
                                disabled={actionLoading === item.row}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Tolak"
                              >
                                <XCircle size={14} />
                              </button>
                              <button
                                onClick={() => handleAction(item, "Cancelled")}
                                disabled={actionLoading === item.row}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Batalkan"
                              >
                                <Ban size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {pagedData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                          Tidak ada data ditemukan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-2">
              {pagedData.map((item, idx) => (
                <div
                  key={`${item.unit}-${item.row}-${idx}`}
                  className="bg-white rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: UNIT_COLORS[item.unit] || "#6b7280" }}
                      >
                        {item.unit}
                      </span>
                      <span className="text-[11px] text-gray-500">{item.tanggalDisplay || item.tanggal}</span>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", getStatusBadge(item.status))}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.acara}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                    <span>{item.jam}</span>
                    <span>•</span>
                    <span>{item.hadirin} orang</span>
                  </div>
                  {item.status === "Pending" && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleAction(item, "Approved")}
                        disabled={actionLoading === item.row}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                      >
                        <CheckCircle size={12} />
                        ACC
                      </button>
                      <button
                        onClick={() => handleAction(item, "Rejected")}
                        disabled={actionLoading === item.row}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                      >
                        <XCircle size={12} />
                        Tolak
                      </button>
                      <button
                        onClick={() => handleAction(item, "Cancelled")}
                        disabled={actionLoading === item.row}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <Ban size={12} />
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {pagedData.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <p className="text-sm text-gray-400">Tidak ada data ditemukan</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-gray-400">
                  {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredData.length)} dari {filteredData.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2 text-xs text-gray-500">{page + 1}/{totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Calendar View */}
        {!loading && !error && viewMode === "calendar" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                  else { setCalMonth(calMonth - 1); }
                  setSelectedDay(null);
                }}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-3 relative">
                <button
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  className="text-sm sm:text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {CAL_MONTH_NAMES[calMonth]} {calYear} ▾
                </button>
                {showMonthPicker && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[260px]">
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setCalYear(calYear - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-semibold text-gray-800">{calYear}</span>
                      <button onClick={() => setCalYear(calYear + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CAL_MONTH_NAMES.map((name, i) => {
                        const isCurrentMonth = i === now.getMonth() && calYear === now.getFullYear();
                        const isSelected = i === calMonth;
                        return (
                          <button
                            key={name}
                            onClick={() => {
                              setCalMonth(i);
                              setShowMonthPicker(false);
                              setSelectedDay(null);
                            }}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              isSelected
                                ? "bg-blue-600 text-white"
                                : isCurrentMonth
                                  ? "bg-blue-50 text-blue-700 font-semibold"
                                  : "text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            {name.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setCalMonth(now.getMonth());
                    setCalYear(now.getFullYear());
                    setSelectedDay(null);
                  }}
                  className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                >
                  Hari Ini
                </button>
              </div>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                  else { setCalMonth(calMonth + 1); }
                  setSelectedDay(null);
                }}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Close month picker on outside click */}
            {showMonthPicker && (
              <div className="fixed inset-0 z-40" onClick={() => setShowMonthPicker(false)} />
            )}

            {/* Calendar Grid */}
            <div className="w-full overflow-hidden">
              <div className="grid grid-cols-7 w-full">
                {CAL_DAY_HEADERS.map((day, dayIdx) => (
                  <div
                    key={day}
                    className={cn(
                      "py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-semibold border-b border-gray-100 uppercase tracking-wide whitespace-nowrap",
                      dayIdx >= 5 ? "text-red-600" : "text-gray-500"
                    )}
                  >
                    {day}
                  </div>
                ))}

                {getDaysInMonthGrid(calMonth, calYear).map((day, idx) => {
                  const dayEvents = day
                    ? filteredData.filter((item: PortalJadwal) => portalDateMatches(item, day, calMonth, calYear))
                    : [];
                  const today = new Date();
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (day && dayEvents.length > 0) {
                          setSelectedDay({ day, events: dayEvents });
                        }
                      }}
                      className={cn(
                        "min-h-[60px] sm:min-h-[110px] border-b border-r border-gray-100 p-0.5 sm:p-1.5 transition-colors min-w-0 overflow-hidden",
                        !day && "bg-gray-50/50",
                        day && "hover:bg-gray-50/80",
                        day && dayEvents.length > 0 && "cursor-pointer",
                        idx % 7 === 0 && "border-l-0",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      {day && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-xs font-semibold",
                                isToday
                                  ? "bg-blue-600 text-white ring-2 ring-blue-200"
                                  : "text-gray-700"
                              )}
                            >
                              {day}
                            </span>
                            {dayEvents.length > 0 && (
                              <span className="text-[9px] font-medium text-gray-400 hidden sm:inline">{dayEvents.length}</span>
                            )}
                          </div>

                          {/* Desktop: Show pills */}
                          <div className="hidden sm:flex flex-col gap-0.5 min-w-0 overflow-hidden">
                            {dayEvents.slice(0, 3).map((evt, eIdx) => (
                              <div
                                key={`${evt.unit}-${evt.row}-${eIdx}`}
                                className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border min-w-0"
                                style={{
                                  backgroundColor: `${UNIT_COLORS[evt.unit] || "#6b7280"}15`,
                                  color: UNIT_COLORS[evt.unit] || "#6b7280",
                                  borderColor: `${UNIT_COLORS[evt.unit] || "#6b7280"}30`,
                                }}
                                title={`${evt.acara} (${evt.unit})`}
                              >
                                <span className="truncate">{evt.acara.length > 18 ? evt.acara.slice(0, 18) + "..." : evt.acara}</span>
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} lagi</span>
                            )}
                          </div>

                          {/* Mobile: Show colored dots */}
                          <div className="sm:hidden">
                            {dayEvents.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                                {dayEvents.slice(0, 5).map((evt, eIdx) => (
                                  <span
                                    key={`${evt.unit}-${evt.row}-${eIdx}`}
                                    className={cn("w-2.5 h-2.5 rounded-full shrink-0", getUnitDotColor(evt.unit))}
                                    title={`${evt.acara} (${evt.unit})`}
                                  />
                                ))}
                                {dayEvents.length > 5 && (
                                  <span className="text-[8px] text-gray-400 font-medium leading-none self-center">{dayEvents.length - 5}+</span>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <span className="text-[10px] text-gray-400 font-medium">Unit:</span>
              {Object.entries(UNIT_COLORS).map(([unit, color]) => (
                <span key={unit} className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-gray-500">{unit}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
