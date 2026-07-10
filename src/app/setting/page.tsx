"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import {
  Settings,
  RefreshCw,
  Database,
  Shield,
  Globe,
  Clock,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Server,
  Table2,
  Building2,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/form-controls";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import type { Setting, SyncLog } from "@/lib/types";

// ---------- types ----------
interface TableCount {
  name: string;
  label: string;
  count: number;
}

// ---------- component ----------
export default function SettingPage() {
  const { addToast } = useToast();

  // settings
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // sync
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [syncing, setSyncing] = useState(false);

  // sync logs
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // security
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  // database counts
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // units management
  interface UnitItem { id: string; code: string; name: string; color: string; is_active: boolean; }
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitColor, setUnitColor] = useState("blue");
  const [savingUnit, setSavingUnit] = useState(false);
  const [deleteUnitConfirm, setDeleteUnitConfirm] = useState<UnitItem | null>(null);

  // loading
  const [loading, setLoading] = useState(true);

  // load all data
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadSettings(),
      loadSyncLogs(),
      loadTableCounts(),
      loadUnits(),
    ]);
    setLoading(false);
  };

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .order("key");

    if (error) {
      addToast("error", "Gagal memuat pengaturan");
      return;
    }

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s: Setting) => {
        map[s.key] = s.value || "";
      });
      setSettings(map);
      setEditingSettings({ ...map });
    }
  };

  const loadSyncLogs = async () => {
    const { data } = await supabase
      .from("sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setSyncLogs(data as SyncLog[]);
      setLastSync(data[0] as SyncLog || null);
    }
  };

  const loadTableCounts = async () => {
    setLoadingCounts(true);
    const tables = [
      { name: "kaldik", label: "Kaldik" },
      { name: "tema_bulanan", label: "Tema Bulanan" },
      { name: "perlu_cek", label: "Perlu Cek" },
      { name: "tanpa_tanggal", label: "Tanpa Tanggal" },
      { name: "karyawan", label: "Karyawan" },
      { name: "hari_khusus", label: "Hari Khusus" },
      { name: "pokok_doa", label: "Pokok Doa" },
      { name: "sync_logs", label: "Sync Logs" },
      { name: "import_logs", label: "Import Logs" },
      { name: "change_logs", label: "Change Logs" },
    ];

    const counts: TableCount[] = [];
    for (const t of tables) {
      const { count } = await supabase
        .from(t.name)
        .select("id", { count: "exact", head: true });
      counts.push({ name: t.name, label: t.label, count: count || 0 });
    }
    setTableCounts(counts);
    setLoadingCounts(false);
  };

  const loadUnits = async () => {
    const { data } = await supabase.from("units").select("*").order("code");
    if (data) setUnits(data as UnitItem[]);
  };

  const handleSaveUnit = async () => {
    if (!unitName.trim()) { addToast("warning", "Nama unit wajib diisi"); return; }
    setSavingUnit(true);
    try {
      if (editingUnit) {
        const { error } = await supabase.from("units").update({ name: unitName.trim(), color: unitColor }).eq("id", editingUnit.id);
        if (error) throw error;
        addToast("success", `Unit "${unitName}" berhasil diupdate`);
      } else {
        const lastCode = units.map(u => parseInt(u.code.replace("U", ""))).sort((a, b) => b - a)[0] || 0;
        const nextCode = `U${String(lastCode + 1).padStart(3, "0")}`;
        const { error } = await supabase.from("units").insert({ code: nextCode, name: unitName.trim(), color: unitColor, is_active: true });
        if (error) throw error;
        addToast("success", `Unit "${unitName}" berhasil ditambahkan`);
      }
      setShowUnitModal(false);
      setEditingUnit(null);
      setUnitName("");
      setUnitColor("blue");
      loadUnits();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Gagal menyimpan unit");
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!deleteUnitConfirm) return;
    try {
      const { error } = await supabase.from("units").delete().eq("id", deleteUnitConfirm.id);
      if (error) throw error;
      addToast("success", `Unit "${deleteUnitConfirm.name}" berhasil dihapus`);
      setDeleteUnitConfirm(null);
      loadUnits();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Gagal menghapus unit");
    }
  };

  const openEditUnit = (unit: UnitItem) => {
    setEditingUnit(unit);
    setUnitName(unit.name);
    setUnitColor(unit.color);
    setShowUnitModal(true);
  };

  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitName("");
    setUnitColor("blue");
    setShowUnitModal(true);
  };

  // save individual setting
  const handleSaveSetting = async (key: string) => {
    setSavingKey(key);
    try {
      const value = editingSettings[key] || "";
      const { error } = await supabase
        .from("settings")
        .update({ value })
        .eq("key", key);

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));
      addToast("success", `${key} berhasil disimpan`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      addToast("error", msg);
    } finally {
      setSavingKey(null);
    }
  };

  // save PIN
  const handleSavePin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      addToast("warning", "Semua field PIN wajib diisi");
      return;
    }
    if (newPin.length !== 4) {
      addToast("warning", "PIN baru harus 4 digit");
      return;
    }
    if (newPin !== confirmPin) {
      addToast("error", "Konfirmasi PIN tidak cocok");
      return;
    }
    if (currentPin !== settings.APP_PIN) {
      addToast("error", "PIN lama salah");
      return;
    }

    setSavingPin(true);
    try {
      const { error } = await supabase
        .from("settings")
        .update({ value: newPin })
        .eq("key", "APP_PIN");

      if (error) throw error;

      setSettings((prev) => ({ ...prev, APP_PIN: newPin }));
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      addToast("success", "PIN berhasil diubah");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah PIN";
      addToast("error", msg);
    } finally {
      setSavingPin(false);
    }
  };

  // manual sync
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/manual", { method: "POST" });
      const json = await res.json();

      if (json.status === "success") {
        addToast("success", "Sinkronisasi berhasil!");
      } else {
        addToast("error", json.message || "Sinkronisasi gagal");
      }
      loadSyncLogs();
    } catch {
      addToast("error", "Gagal menjalankan sinkronisasi");
    } finally {
      setSyncing(false);
    }
  };

  // helpers
  const updateEditing = (key: string, value: string) => {
    setEditingSettings((prev) => ({ ...prev, [key]: value }));
  };

  const isChanged = (key: string) => editingSettings[key] !== settings[key];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Setting</h1>
          <p className="text-sm text-slate-500 mt-1">Memuat pengaturan...</p>
        </div>
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Setting</h1>
        <p className="text-sm text-slate-500 mt-1">
          Konfigurasi aplikasi, sinkronisasi, dan keamanan
        </p>
      </div>

      {/* Section: Aplikasi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Settings size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Aplikasi</h2>
        </div>
        <div className="p-5 space-y-4">
          {[
            { key: "APP_NAME", label: "Nama Aplikasi", placeholder: "Kaldik & Pokok Doa Terpadu" },
            { key: "TA_AKTIF", label: "Tahun Ajaran Aktif", placeholder: "2026-2027" },
            { key: "SEMESTER_AKTIF", label: "Semester Aktif", placeholder: "1 atau 2" },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label={label}
                  value={editingSettings[key] || ""}
                  onChange={(e) => updateEditing(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
              <button
                onClick={() => handleSaveSetting(key)}
                disabled={!isChanged(key) || savingKey === key}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  isChanged(key)
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                {savingKey === key ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Simpan
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Spreadsheet Integration */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Globe size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Spreadsheet Integration</h2>
        </div>
        <div className="p-5 space-y-4">
          {[
            { key: "GOOGLE_SHEET_ID", label: "Google Sheet ID", placeholder: "Masukkan ID Google Spreadsheet" },
            { key: "SYNC_SECRET_TOKEN", label: "Sync Secret Token", placeholder: "Token rahasia untuk endpoint sync" },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label={label}
                  value={editingSettings[key] || ""}
                  onChange={(e) => updateEditing(key, e.target.value)}
                  placeholder={placeholder}
                  type={key === "SYNC_SECRET_TOKEN" ? "password" : "text"}
                />
              </div>
              <button
                onClick={() => handleSaveSetting(key)}
                disabled={!isChanged(key) || savingKey === key}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  isChanged(key)
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                {savingKey === key ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Simpan
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Sync Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Clock size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Jadwal Sinkronisasi</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sinkronisasi Terakhir</span>
                <span className="text-sm font-medium text-slate-700">
                  {lastSync?.finished_at
                    ? formatDate(lastSync.finished_at, "d MMM yyyy HH:mm")
                    : lastSync?.created_at
                      ? formatDate(lastSync.created_at, "d MMM yyyy HH:mm")
                      : "Belum pernah"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Status</span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium",
                    lastSync?.status === "success"
                      ? "text-emerald-600"
                      : lastSync?.status === "error"
                        ? "text-red-600"
                        : "text-slate-500"
                  )}
                >
                  {lastSync?.status === "success" ? (
                    <CheckCircle2 size={14} />
                  ) : lastSync?.status === "error" ? (
                    <AlertCircle size={14} />
                  ) : null}
                  {lastSync?.status === "success"
                    ? "Berhasil"
                    : lastSync?.status === "error"
                      ? "Gagal"
                      : lastSync?.status === "running"
                        ? "Berjalan"
                        : "Idle"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Jadwal</span>
                <span className="text-sm font-medium text-slate-700">Setiap Selasa, 02:00</span>
              </div>
            </div>
            <div className="space-y-2">
              {lastSync && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total Baris</span>
                    <span className="text-sm font-medium text-slate-700">{lastSync.total_rows}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Insert</span>
                    <span className="text-sm font-medium text-emerald-600">{lastSync.inserted_rows}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Update</span>
                    <span className="text-sm font-medium text-blue-600">{lastSync.updated_rows}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Konflik</span>
                    <span className="text-sm font-medium text-amber-600">{lastSync.conflict_rows}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={syncing}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors",
              syncing
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {syncing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Menyinkronkan...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Sync Sekarang
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section: Sync Logs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Server size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Log Sinkronisasi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Tipe</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Insert</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Update</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Skip</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Konflik</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Error</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {syncLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Belum ada log sinkronisasi
                  </td>
                </tr>
              ) : (
                syncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm text-slate-600">
                      {formatDate(log.created_at, "d MMM yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 capitalize">
                      {log.sync_type}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-center">
                      {log.total_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-emerald-600 text-center">
                      {log.inserted_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-blue-600 text-center">
                      {log.updated_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-500 text-center">
                      {log.skipped_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-amber-600 text-center">
                      {log.conflict_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-red-600 text-center">
                      {log.error_rows}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
                          log.status === "success"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : log.status === "error"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : log.status === "running"
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {log.status === "success"
                          ? "Berhasil"
                          : log.status === "error"
                            ? "Gagal"
                            : log.status === "running"
                              ? "Berjalan"
                              : log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Security */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Shield size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Keamanan</h2>
        </div>
        <div className="p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Ubah PIN</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="PIN Saat Ini"
              type="password"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="****"
            />
            <Input
              label="PIN Baru (4 digit)"
              type="password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="****"
            />
            <Input
              label="Konfirmasi PIN Baru"
              type="password"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="****"
            />
          </div>
          <button
            onClick={handleSavePin}
            disabled={savingPin || !currentPin || !newPin || !confirmPin}
            className={cn(
              "flex items-center gap-2 mt-4 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors",
              savingPin || !currentPin || !newPin || !confirmPin
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            )}
          >
            {savingPin ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <KeyRound size={16} />
                Ubah PIN
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section: Manajemen Unit */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Manajemen Unit</h2>
          </div>
          <button
            onClick={openAddUnit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={12} />
            Tambah Unit
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: unit.color === "gray" ? "#6b7280" : unit.color === "rose" ? "#e11d48" : unit.color === "blue" ? "#2563eb" : unit.color === "purple" ? "#9333ea" : unit.color === "green" ? "#059669" : unit.color === "teal" ? "#0d9488" : "#6b7280" }}
                  >
                    {unit.code}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{unit.name}</p>
                    <p className="text-[11px] text-slate-500">{unit.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditUnit(unit)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteUnitConfirm(unit)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unit Modal */}
      <Modal
        open={showUnitModal}
        onClose={() => { setShowUnitModal(false); setEditingUnit(null); }}
        title={editingUnit ? "Edit Unit" : "Tambah Unit Baru"}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nama Unit"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="Contoh: TBI, TK A, SD Internasional"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Warna</label>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "gray", label: "Abu", bg: "#6b7280" },
                { name: "rose", label: "Merah Muda", bg: "#e11d48" },
                { name: "blue", label: "Biru", bg: "#2563eb" },
                { name: "purple", label: "Ungu", bg: "#9333ea" },
                { name: "green", label: "Hijau", bg: "#059669" },
                { name: "teal", label: "Teal", bg: "#0d9488" },
                { name: "amber", label: "Kuning", bg: "#d97706" },
                { name: "orange", label: "Oranye", bg: "#ea580c" },
                { name: "cyan", label: "Cyan", bg: "#0891b2" },
                { name: "pink", label: "Pink", bg: "#db2777" },
              ].map((c) => (
                <button
                  key={c.name}
                  onClick={() => setUnitColor(c.name)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    unitColor === c.name ? "border-slate-900 scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.bg }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowUnitModal(false); setEditingUnit(null); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              onClick={handleSaveUnit}
              disabled={savingUnit || !unitName.trim()}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg",
                savingUnit || !unitName.trim() ? "bg-slate-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
              )}
            >
              {savingUnit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingUnit ? "Update" : "Simpan"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Unit Confirm */}
      <ConfirmDialog
        open={!!deleteUnitConfirm}
        onClose={() => setDeleteUnitConfirm(null)}
        onConfirm={handleDeleteUnit}
        title="Hapus Unit"
        message={`Yakin ingin menghapus unit "${deleteUnitConfirm?.name}"? Data yang terkait unit ini tidak akan terhapus.`}
        confirmText="Hapus"
      />

      {/* Section: Database */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Database</h2>
          </div>
          <button
            onClick={loadTableCounts}
            disabled={loadingCounts}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {loadingCounts ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {tableCounts.map((tc) => (
              <div
                key={tc.name}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <Table2 size={16} className="text-slate-400" />
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {loadingCounts ? "-" : tc.count}
                  </p>
                  <p className="text-[11px] text-slate-500">{tc.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
