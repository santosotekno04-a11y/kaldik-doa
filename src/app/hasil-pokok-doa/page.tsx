"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookHeart,
  Lock,
  Unlock,
  CheckCircle2,
  Save,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Edit3,
  Trash2,
} from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PageHeader,
  EmptyState,
  FilterBar,
  FilterSelect,
} from "@/components/ui/filter-bar";
import { Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase/client";
import { formatDate, getMonthName, getDaysInMonth } from "@/lib/utils/date";
import type { PokokDoa } from "@/lib/types";

// --- Constants ---
const UNIT_MODES = [
  { value: "Universal", label: "Universal" },
  { value: "TK", label: "TK" },
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "Gabungan Semua Unit", label: "Gabungan Semua Unit" },
];

const BULAN_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: getMonthName(i + 1),
}));

const TAHUN_OPTIONS = [2024, 2025, 2026, 2027, 2028].map((y) => ({
  value: String(y),
  label: String(y),
}));

const STATUS_OPTIONS = [
  { value: "Auto Draft", label: "Auto Draft" },
  { value: "Edited Manual", label: "Edited Manual" },
  { value: "Final", label: "Final" },
];

function getDayName(dateStr: string): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const d = new Date(dateStr + "T00:00:00");
  return days[d.getDay()];
}

function formatTanggalDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// --- Page Component ---
export default function HasilPokokDoaPage() {
  const { addToast } = useToast();

  // Filter state
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [bulan, setBulan] = useState(String(currentMonth));
  const [tahun, setTahun] = useState(String(currentYear));
  const [unitMode, setUnitMode] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Data state
  const [doaList, setDoaList] = useState<PokokDoa[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDoa, setEditingDoa] = useState<PokokDoa | null>(null);
  const [editJudul, setEditJudul] = useState("");
  const [editIsi, setEditIsi] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<void>>(() => Promise.resolve());
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Finalize all state
  const [finalizeAllLoading, setFinalizeAllLoading] = useState(false);

  // Fetch data
  const fetchDoa = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pokok_doa")
        .select("*")
        .eq("bulan", parseInt(bulan))
        .eq("tahun", parseInt(tahun))
        .order("tanggal", { ascending: true });

      if (unitMode) {
        query = query.eq("unit_mode", unitMode);
      }
      if (statusFilter) {
        query = query.eq("status_doa", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDoaList(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      addToast("error", "Gagal memuat data pokok doa.");
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun, unitMode, statusFilter, addToast]);

  useEffect(() => {
    fetchDoa();
  }, [fetchDoa]);

  // Stats
  const totalCount = doaList.length;
  const autoDraftCount = doaList.filter((d) => d.status_doa === "Auto Draft").length;
  const editedCount = doaList.filter((d) => d.status_doa === "Edited Manual").length;
  const finalCount = doaList.filter((d) => d.status_doa === "Final").length;
  const lockedCount = doaList.filter((d) => d.locked).length;

  // Handlers
  const openEditModal = (doa: PokokDoa) => {
    if (doa.locked) {
      addToast("warning", "Doa ini terkunci. Buka kunci terlebih dahulu untuk mengedit.");
      return;
    }
    setEditingDoa(doa);
    setEditJudul(doa.judul || "");
    setEditIsi(doa.isi_doa || "");
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDoa) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("pokok_doa")
        .update({
          judul: editJudul,
          isi_doa: editIsi,
          status_doa: "Edited Manual",
        })
        .eq("id", editingDoa.id);

      if (error) throw error;

      addToast("success", "Pokok doa berhasil diperbarui.");
      setEditModalOpen(false);
      setEditingDoa(null);
      fetchDoa();
    } catch (err) {
      console.error("Edit error:", err);
      addToast("error", "Gagal menyimpan perubahan.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleLock = async (doa: PokokDoa) => {
    const newLocked = !doa.locked;
    try {
      const { error } = await supabase
        .from("pokok_doa")
        .update({ locked: newLocked })
        .eq("id", doa.id);

      if (error) throw error;

      addToast(
        "success",
        newLocked ? "Doa berhasil dikunci." : "Doa berhasil dibuka kuncinya."
      );
      fetchDoa();
    } catch (err) {
      console.error("Lock error:", err);
      addToast("error", "Gagal mengubah status kunci.");
    }
  };

  const handleFinalize = (doa: PokokDoa) => {
    if (doa.status_doa === "Final") {
      addToast("info", "Doa ini sudah berstatus Final.");
      return;
    }
    setConfirmTitle("Finalisasi Doa");
    setConfirmMessage(
      `Apakah Anda yakin ingin memfinalisasi doa "${doa.judul}" tanggal ${formatTanggalDisplay(doa.tanggal)}? Doa akan dikunci dan tidak dapat diubah lagi.`
    );
    setConfirmAction(() => async () => {
      setConfirmLoading(true);
      try {
        const { error } = await supabase
          .from("pokok_doa")
          .update({ status_doa: "Final", locked: true })
          .eq("id", doa.id);

        if (error) throw error;

        addToast("success", "Doa berhasil difinalisasi.");
        fetchDoa();
      } catch (err) {
        console.error("Finalize error:", err);
        addToast("error", "Gagal memfinalisasi doa.");
      } finally {
        setConfirmLoading(false);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleFinalizeAll = () => {
    const nonFinalCount = doaList.filter((d) => d.status_doa !== "Final").length;
    if (nonFinalCount === 0) {
      addToast("info", "Semua doa sudah berstatus Final.");
      return;
    }
    setConfirmTitle("Finalisasi Semua Doa");
    setConfirmMessage(
      `Apakah Anda yakin ingin memfinalisasi semua ${nonFinalCount} doa bulan ${getMonthName(parseInt(bulan))} ${tahun}? Semua doa akan dikunci dan tidak dapat diubah lagi.`
    );
    setConfirmAction(() => async () => {
      setFinalizeAllLoading(true);
      setConfirmLoading(true);
      try {
        const { error } = await supabase
          .from("pokok_doa")
          .update({ status_doa: "Final", locked: true })
          .eq("bulan", parseInt(bulan))
          .eq("tahun", parseInt(tahun))
          .neq("status_doa", "Final");

        if (unitMode) {
          // Re-run with unit_mode filter if set
          const { error: err2 } = await supabase
            .from("pokok_doa")
            .update({ status_doa: "Final", locked: true })
            .eq("bulan", parseInt(bulan))
            .eq("tahun", parseInt(tahun))
            .eq("unit_mode", unitMode)
            .neq("status_doa", "Final");
          if (err2) throw err2;
        } else {
          if (error) throw error;
        }

        addToast("success", `${nonFinalCount} doa berhasil difinalisasi.`);
        fetchDoa();
      } catch (err) {
        console.error("Finalize all error:", err);
        addToast("error", "Gagal memfinalisasi semua doa.");
      } finally {
        setFinalizeAllLoading(false);
        setConfirmLoading(false);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const handleDelete = (doa: PokokDoa) => {
    if (doa.locked) {
      addToast("warning", "Doa ini terkunci. Buka kunci terlebih dahulu untuk menghapus.");
      return;
    }
    setConfirmTitle("Hapus Doa");
    setConfirmMessage(
      `Apakah Anda yakin ingin menghapus doa "${doa.judul}" tanggal ${formatTanggalDisplay(doa.tanggal)}?`
    );
    setConfirmAction(() => async () => {
      setConfirmLoading(true);
      try {
        const { error } = await supabase
          .from("pokok_doa")
          .delete()
          .eq("id", doa.id);

        if (error) throw error;

        addToast("success", "Doa berhasil dihapus.");
        fetchDoa();
      } catch (err) {
        console.error("Delete error:", err);
        addToast("error", "Gagal menghapus doa.");
      } finally {
        setConfirmLoading(false);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  // Navigate month
  const goToPrevMonth = () => {
    let newBulan = parseInt(bulan) - 1;
    let newTahun = parseInt(tahun);
    if (newBulan < 1) {
      newBulan = 12;
      newTahun -= 1;
    }
    setBulan(String(newBulan));
    setTahun(String(newTahun));
  };

  const goToNextMonth = () => {
    let newBulan = parseInt(bulan) + 1;
    let newTahun = parseInt(tahun);
    if (newBulan > 12) {
      newBulan = 1;
      newTahun += 1;
    }
    setBulan(String(newBulan));
    setTahun(String(newTahun));
  };

  // Group doa by week for calendar view
  const daysInMonth = getDaysInMonth(parseInt(bulan), parseInt(tahun));
  const firstDayOfWeek = new Date(parseInt(tahun), parseInt(bulan) - 1, 1).getDay();

  const doaByDate = new Map<string, PokokDoa>();
  for (const doa of doaList) {
    doaByDate.set(doa.tanggal, doa);
  }

  const calendarDays: (number | null)[] = [];
  // Pad start
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hasil Pokok Doa"
        description="Lihat, edit, dan finalisasi pokok doa bulanan"
        action={
          <button
            onClick={handleFinalizeAll}
            disabled={finalizeAllLoading || doaList.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {finalizeAllLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Finalisasi Semua
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center min-w-[160px]">
              <p className="text-sm font-semibold text-slate-900">
                {getMonthName(parseInt(bulan))} {tahun}
              </p>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3 flex-1">
            <div className="w-32">
              <Select
                label="Bulan"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                options={BULAN_OPTIONS}
              />
            </div>
            <div className="w-24">
              <Select
                label="Tahun"
                value={tahun}
                onChange={(e) => setTahun(e.target.value)}
                options={TAHUN_OPTIONS}
              />
            </div>
            <div className="w-44">
              <FilterSelect
                value={unitMode}
                onChange={setUnitMode}
                options={UNIT_MODES}
                placeholder="Semua Unit"
              />
            </div>
            <div className="w-36">
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                placeholder="Semua Status"
              />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {doaList.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold text-slate-700">{totalCount}</span>
            </span>
            <span className="text-xs text-slate-500">
              Auto Draft:{" "}
              <span className="font-semibold text-gray-600">{autoDraftCount}</span>
            </span>
            <span className="text-xs text-slate-500">
              Edited:{" "}
              <span className="font-semibold text-amber-600">{editedCount}</span>
            </span>
            <span className="text-xs text-slate-500">
              Final:{" "}
              <span className="font-semibold text-emerald-600">{finalCount}</span>
            </span>
            <span className="text-xs text-slate-500">
              Terkunci:{" "}
              <span className="font-semibold text-purple-600">{lockedCount}</span>
            </span>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-slate-200">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : doaList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={<BookHeart size={48} />}
            title="Belum ada pokok doa"
            description={`Tidak ada pokok doa untuk bulan ${getMonthName(parseInt(bulan))} ${tahun}. Gunakan halaman Generate Doa untuk membuatnya.`}
          />
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-xs font-medium text-slate-500 text-center"
                >
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="min-h-[80px] bg-slate-50/50 border-b border-r border-slate-100" />;
                }
                const dateStr = `${parseInt(tahun)}-${String(parseInt(bulan)).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const doa = doaByDate.get(dateStr);
                const isWeekend = new Date(dateStr + "T00:00:00").getDay() === 0 || new Date(dateStr + "T00:00:00").getDay() === 6;

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 ${
                      isWeekend ? "bg-slate-50/80" : ""
                    } ${doa ? "cursor-pointer hover:bg-indigo-50/50" : ""} transition-colors`}
                    onClick={() => doa && openEditModal(doa)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          isWeekend ? "text-slate-400" : "text-slate-700"
                        }`}
                      >
                        {day}
                      </span>
                      {doa?.locked && <Lock size={10} className="text-purple-500" />}
                    </div>
                    {doa && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-medium text-slate-800 leading-tight line-clamp-2">
                          {doa.judul}
                        </p>
                        <StatusBadge
                          status={doa.status_doa}
                          className="!text-[9px] !px-1.5 !py-0"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* List View */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Daftar Pokok Doa
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {doaList.map((doa) => {
                const dayName = getDayName(doa.tanggal);
                const dayNum = new Date(doa.tanggal + "T00:00:00").getDate();

                return (
                  <div
                    key={doa.id}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-50 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-indigo-600 leading-none">
                        {dayNum}
                      </span>
                      <span className="text-[10px] text-indigo-400 leading-none">
                        {dayName.slice(0, 3)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-slate-900 truncate">
                          {doa.judul}
                        </h3>
                        <StatusBadge status={doa.status_doa} />
                        {doa.locked && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            <Lock size={8} />
                            Terkunci
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-1.5">
                        {doa.isi_doa}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">
                          {formatTanggalDisplay(doa.tanggal)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Sumber: {doa.sumber_data}
                        </span>
                        {doa.unit_mode && (
                          <span className="text-[11px] text-slate-400">
                            Unit: {doa.unit_mode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(doa);
                        }}
                        disabled={doa.locked}
                        title="Edit"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLock(doa);
                        }}
                        title={doa.locked ? "Buka Kunci" : "Kunci"}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${
                          doa.locked
                            ? "text-purple-500 hover:text-purple-700"
                            : "text-slate-400 hover:text-purple-600"
                        }`}
                      >
                        {doa.locked ? <Unlock size={14} /> : <Lock size={14} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFinalize(doa);
                        }}
                        disabled={doa.status_doa === "Final"}
                        title="Finalisasi"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doa);
                        }}
                        disabled={doa.locked}
                        title="Hapus"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingDoa(null);
        }}
        title="Edit Pokok Doa"
        size="lg"
      >
        {editingDoa && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">
                {formatTanggalDisplay(editingDoa.tanggal)} &middot; Sumber:{" "}
                {editingDoa.sumber_data}
              </p>
              <StatusBadge status={editingDoa.status_doa} />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Judul
              </label>
              <input
                type="text"
                value={editJudul}
                onChange={(e) => setEditJudul(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <Textarea
              label="Isi Doa"
              value={editIsi}
              onChange={(e) => setEditIsi(e.target.value)}
              rows={4}
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingDoa(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (!confirmLoading) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={confirmAction}
        title={confirmTitle}
        message={confirmMessage}
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
        variant="primary"
        loading={confirmLoading}
      />
    </div>
  );
}
