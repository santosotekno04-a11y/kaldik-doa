"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import {
  Building2, RefreshCw, CheckCircle, XCircle, Clock, Ban,
  ExternalLink, Filter, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Users, CalendarDays
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

const PORTAL_URL = "https://script.google.com/macros/s/AKfycbx.../exec"; // Ganti dengan URL Portal asli

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
  const [tahun] = useState(now.getFullYear());
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [data, setData] = useState<PortalJadwal[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [jadwalRes, dashRes] = await Promise.all([
        portalApi("getJadwal", { unit: unitFilter, bulan, tahun }),
        portalApi("getDashboard", { bulan, tahun }),
      ]);

      if (jadwalRes.error) throw new Error(jadwalRes.error);
      if (dashRes.error) throw new Error(dashRes.error);

      setData(jadwalRes.data || []);
      setStats(dashRes.stats || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data Portal";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [unitFilter, bulan, tahun]);

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

        {/* Bulan */}
        <div>
          <label className="text-[11px] font-medium text-gray-400 mb-1 block">Bulan</label>
          <select
            value={bulan}
            onChange={(e) => { setBulan(Number(e.target.value)); setPage(0); }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {BULAN_LABELS.slice(1).map((b, i) => (
              <option key={i + 1} value={i + 1}>{b}</option>
            ))}
          </select>
        </div>

        {/* Unit */}
        <div>
          <label className="text-[11px] font-medium text-gray-400 mb-1 block">Unit</label>
          <div className="flex flex-wrap gap-1">
            {["ALL", "TK", "SD", "SMP", "TBI"].map((u) => (
              <button
                key={u}
                onClick={() => { setUnitFilter(u); setPage(0); }}
                className={cn(
                  "px-2 py-1 text-[10px] font-semibold rounded-md border transition-all",
                  unitFilter === u
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                )}
              >
                {u === "ALL" ? "Semua" : u}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-[11px] font-medium text-gray-400 mb-1 block">Status</label>
          <div className="flex flex-wrap gap-1">
            {["all", "pending", "approved", "rejected", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); }}
                className={cn(
                  "px-2 py-1 text-[10px] font-semibold rounded-md border transition-all capitalize",
                  statusFilter === s
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                )}
              >
                {s === "all" ? "Semua" : s}
              </button>
            ))}
          </div>
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
              {BULAN_LABELS[bulan]} {tahun} — Kelola peminjaman gedung
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total", value: stats.total, icon: CalendarDays, color: "text-gray-600", bg: "bg-gray-50" },
              { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Disetujui", value: stats.approved, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Ditolak", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-xl border border-gray-200 p-3", s.bg)}>
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon size={14} className={s.color} />
                  <span className="text-[11px] font-medium text-gray-500">{s.label}</span>
                </div>
                <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Unit Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            {["TK", "SD", "SMP", "TBI"].map((u) => (
              <div key={u} className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
                <div
                  className="w-2 h-2 rounded-full mx-auto mb-1"
                  style={{ backgroundColor: UNIT_COLORS[u] }}
                />
                <p className="text-[11px] font-semibold text-gray-700">{u}</p>
                <p className="text-xs text-gray-400">{stats.byUnit[u]?.total || 0} jadwal</p>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Gagal memuat data</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              <p className="text-xs text-red-500 mt-2">
                Pastikan PORTAL_PROXY_URL dan PORTAL_API_KEY sudah dikonfigurasi di .env.local
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && (
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
      </div>
    </div>
  );
}
