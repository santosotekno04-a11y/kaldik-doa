"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Edit2,
  Copy,
  XCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { UnitBadge } from "@/components/ui/unit-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SearchBar,
  FilterBar,
  FilterSelect,
  PageHeader,
} from "@/components/ui/filter-bar";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  formatDate,
  formatDateDisplay,
  getCurrentTahunAjaran,
  getMonthName,
} from "@/lib/utils/date";
import { generateId } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import { KALDIK_STATUS, KATEGORI_LIST } from "@/lib/constants/status";
import { cn } from "@/lib/utils/cn";
import type { Kaldik, Unit } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────
type KaldikWithUnit = Kaldik & {
  unit: { id: string; code: string; name: string; color: string } | null;
};

interface FormData {
  tahun_ajaran: string;
  semester: string;
  bulan: string;
  tahun: string;
  unit_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_mentah: string;
  nama_kegiatan: string;
  kategori: string;
  prioritas_doa: string;
  masuk_pokok_doa: boolean;
  catatan_doa: string;
  status: string;
  sumber_data: string;
}

// ── Constants ──────────────────────────────────────────────────
const STATUS_OPTIONS = KALDIK_STATUS.map((s) => ({ value: s, label: s }));
const KATEGORI_OPTIONS = KATEGORI_LIST.map((k) => ({ value: k, label: k }));
const SEMESTER_OPTIONS = [
  { value: "1", label: "Semester 1" },
  { value: "2", label: "Semester 2" },
];

function generateTahunAjaranOptions() {
  const currentYear = new Date().getFullYear();
  const options = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    options.push({ value: `${y}-${y + 1}`, label: `${y}-${y + 1}` });
  }
  return options;
}

function generateBulanOptions() {
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: getMonthName(i + 1),
  }));
}

function generatePrioritasOptions() {
  return Array.from({ length: 11 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions();
const BULAN_OPTIONS = generateBulanOptions();
const PRIORITAS_OPTIONS = generatePrioritasOptions();

function getDefaultFormData(): FormData {
  const now = new Date();
  return {
    tahun_ajaran: getCurrentTahunAjaran(),
    semester: now.getMonth() + 1 >= 7 ? "1" : "2",
    bulan: String(now.getMonth() + 1),
    tahun: String(now.getFullYear()),
    unit_id: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    tanggal_mentah: "",
    nama_kegiatan: "",
    kategori: "Umum",
    prioritas_doa: "5",
    masuk_pokok_doa: true,
    catatan_doa: "",
    status: "Draft",
    sumber_data: "Manual",
  };
}

// ── Component ──────────────────────────────────────────────────
export default function KaldikPage() {
  const { addToast } = useToast();

  // ── Data State ─────────────────────────────────────────────
  const [kaldik, setKaldik] = useState<KaldikWithUnit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filter State ───────────────────────────────────────────
  const [tahunAjaran, setTahunAjaran] = useState(getCurrentTahunAjaran());
  const [semesterFilter, setSemesterFilter] = useState("");
  const [bulanFilter, setBulanFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [search, setSearch] = useState("");

  // ── Selection & Bulk ───────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");

  // ── Modal State ────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingKaldik, setEditingKaldik] = useState<KaldikWithUnit | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(getDefaultFormData());

  // ── Confirm Dialog State ───────────────────────────────────
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "danger" as "danger" | "primary",
    loading: false,
  });

  // ── Derived Values ─────────────────────────────────────────
  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.id, label: u.name })),
    [units]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (semesterFilter) count++;
    if (bulanFilter) count++;
    if (unitFilter) count++;
    if (statusFilter) count++;
    if (kategoriFilter) count++;
    if (search) count++;
    return count;
  }, [semesterFilter, bulanFilter, unitFilter, statusFilter, kategoriFilter, search]);

  const filteredData = useMemo(() => {
    return kaldik.filter((item) => {
      if (semesterFilter && String(item.semester) !== semesterFilter)
        return false;
      if (bulanFilter && String(item.bulan) !== bulanFilter) return false;
      if (unitFilter && item.unit_id !== unitFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (kategoriFilter && item.kategori !== kategoriFilter) return false;
      if (
        search &&
        !item.nama_kegiatan.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [kaldik, semesterFilter, bulanFilter, unitFilter, statusFilter, kategoriFilter, search]);

  // ── Data Fetching ──────────────────────────────────────────
  const fetchUnits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      setUnits(data || []);
    } catch (err) {
      console.error("Gagal memuat unit:", err);
    }
  }, []);

  const fetchKaldik = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("kaldik")
        .select("*, unit:units(id, code, name, color)")
        .order("tanggal_mulai", { ascending: true, nullsFirst: false });

      if (tahunAjaran) {
        query = query.eq("tahun_ajaran", tahunAjaran);
      }

      const { data, error } = await query;
      if (error) throw error;
      setKaldik((data || []) as KaldikWithUnit[]);
    } catch (err) {
      console.error("Gagal memuat kaldik:", err);
      addToast("error", "Gagal memuat data kaldik");
    } finally {
      setLoading(false);
    }
  }, [tahunAjaran, addToast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    fetchKaldik();
  }, [fetchKaldik]);

  // ── Form Helpers ───────────────────────────────────────────
  const openCreateForm = useCallback(() => {
    setEditingKaldik(null);
    setFormData(getDefaultFormData());
    setShowForm(true);
  }, []);

  const openEditForm = useCallback(
    (item: KaldikWithUnit) => {
      setEditingKaldik(item);
      setFormData({
        tahun_ajaran: item.tahun_ajaran,
        semester: String(item.semester),
        bulan: String(item.bulan),
        tahun: String(item.tahun),
        unit_id: item.unit_id,
        tanggal_mulai: item.tanggal_mulai
          ? formatDate(item.tanggal_mulai, "yyyy-MM-dd")
          : "",
        tanggal_selesai: item.tanggal_selesai
          ? formatDate(item.tanggal_selesai, "yyyy-MM-dd")
          : "",
        tanggal_mentah: item.tanggal_mentah || "",
        nama_kegiatan: item.nama_kegiatan,
        kategori: item.kategori,
        prioritas_doa: String(item.prioritas_doa),
        masuk_pokok_doa: item.masuk_pokok_doa,
        catatan_doa: item.catatan_doa || "",
        status: item.status,
        sumber_data: item.sumber_data,
      });
      setShowForm(true);
    },
    []
  );

  const handleFormChange = useCallback(
    (field: keyof FormData, value: string | boolean) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        // Auto-derive bulan & tahun from tanggal_mulai
        if (field === "tanggal_mulai" && typeof value === "string" && value) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            next.bulan = String(d.getMonth() + 1);
            next.tahun = String(d.getFullYear());
          }
        }
        return next;
      });
    },
    []
  );

  // ── CRUD Handlers ──────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!formData.nama_kegiatan.trim()) {
      addToast("warning", "Nama kegiatan wajib diisi");
      return;
    }
    if (!formData.unit_id) {
      addToast("warning", "Unit wajib dipilih");
      return;
    }

    setSaving(true);
    try {
      const selectedUnit = units.find((u) => u.id === formData.unit_id);
      const payload = {
        tahun_ajaran: formData.tahun_ajaran,
        semester: Number(formData.semester) as 1 | 2,
        bulan: Number(formData.bulan),
        tahun: Number(formData.tahun),
        unit_id: formData.unit_id,
        unit_scope: selectedUnit?.code || "UNIT",
        tanggal_mulai: formData.tanggal_mulai || null,
        tanggal_selesai: formData.tanggal_selesai || null,
        tanggal_mentah: formData.tanggal_mentah || null,
        nama_kegiatan: formData.nama_kegiatan.trim(),
        kategori: formData.kategori,
        prioritas_doa: Number(formData.prioritas_doa),
        masuk_pokok_doa: formData.masuk_pokok_doa,
        catatan_doa: formData.catatan_doa || null,
        status: formData.status,
        sumber_data: formData.sumber_data,
      };

      if (editingKaldik) {
        const { error } = await supabase
          .from("kaldik")
          .update(payload)
          .eq("id", editingKaldik.id);
        if (error) throw error;
        addToast("success", "Kaldik berhasil diperbarui");
      } else {
        const { error } = await supabase.from("kaldik").insert({
          ...payload,
          kaldik_id: generateId("KAL"),
        });
        if (error) throw error;
        addToast("success", "Kaldik berhasil ditambahkan");
      }

      setShowForm(false);
      setEditingKaldik(null);
      fetchKaldik();
    } catch (err) {
      console.error("Gagal menyimpan kaldik:", err);
      addToast(
        "error",
        editingKaldik ? "Gagal memperbarui kaldik" : "Gagal menambahkan kaldik"
      );
    } finally {
      setSaving(false);
    }
  }, [formData, editingKaldik, units, addToast, fetchKaldik]);

  const handleDuplicate = useCallback(
    (item: KaldikWithUnit) => {
      setConfirmState({
        open: true,
        title: "Duplikasi Kaldik",
        message: `Buat salinan dari "${item.nama_kegiatan}"?`,
        variant: "primary",
        loading: false,
        onConfirm: async () => {
          setConfirmState((prev) => ({ ...prev, loading: true }));
          try {
            const { id, created_at, updated_at, unit, spreadsheet_row_id, ...rest } =
              item;
            const { error } = await supabase.from("kaldik").insert({
              ...rest,
              kaldik_id: generateId("KAL"),
              status: "Draft",
              sumber_data: "Manual",
            });
            if (error) throw error;
            addToast("success", "Kaldik berhasil diduplikasi");
            fetchKaldik();
            setConfirmState((prev) => ({
              ...prev,
              open: false,
              loading: false,
            }));
          } catch (err) {
            console.error("Gagal menduplikasi:", err);
            addToast("error", "Gagal menduplikasi kaldik");
            setConfirmState((prev) => ({ ...prev, loading: false }));
          }
        },
      });
    },
    [addToast, fetchKaldik]
  );

  const handleCancel = useCallback(
    (item: KaldikWithUnit) => {
      setConfirmState({
        open: true,
        title: "Batalkan Kaldik",
        message: `Yakin ingin membatalkan "${item.nama_kegiatan}"? Status akan berubah menjadi Dibatalkan.`,
        variant: "danger",
        loading: false,
        onConfirm: async () => {
          setConfirmState((prev) => ({ ...prev, loading: true }));
          try {
            const { error } = await supabase
              .from("kaldik")
              .update({ status: "Dibatalkan" })
              .eq("id", item.id);
            if (error) throw error;
            addToast("success", "Kaldik berhasil dibatalkan");
            fetchKaldik();
            setConfirmState((prev) => ({
              ...prev,
              open: false,
              loading: false,
            }));
          } catch (err) {
            console.error("Gagal membatalkan:", err);
            addToast("error", "Gagal membatalkan kaldik");
            setConfirmState((prev) => ({ ...prev, loading: false }));
          }
        },
      });
    },
    [addToast, fetchKaldik]
  );

  const handleDelete = useCallback(
    (item: KaldikWithUnit) => {
      setConfirmState({
        open: true,
        title: "Hapus Kaldik",
        message: `Yakin ingin menghapus "${item.nama_kegiatan}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
        variant: "danger",
        loading: false,
        onConfirm: async () => {
          setConfirmState((prev) => ({ ...prev, loading: true }));
          try {
            const { error } = await supabase
              .from("kaldik")
              .delete()
              .eq("id", item.id);
            if (error) throw error;
            addToast("success", "Kaldik berhasil dihapus");
            fetchKaldik();
            setConfirmState((prev) => ({
              ...prev,
              open: false,
              loading: false,
            }));
          } catch (err) {
            console.error("Gagal menghapus:", err);
            addToast("error", "Gagal menghapus kaldik");
            setConfirmState((prev) => ({ ...prev, loading: false }));
          }
        },
      });
    },
    [addToast, fetchKaldik]
  );

  const handleBulkStatusChange = useCallback(() => {
    if (!bulkStatus || selectedIds.length === 0) return;

    setConfirmState({
      open: true,
      title: "Ubah Status Massal",
      message: `Yakin ingin mengubah status ${selectedIds.length} data menjadi "${bulkStatus}"?`,
      variant: "primary",
      loading: false,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, loading: true }));
        try {
          const { error } = await supabase
            .from("kaldik")
            .update({ status: bulkStatus })
            .in("id", selectedIds);
          if (error) throw error;
          addToast(
            "success",
            `${selectedIds.length} data berhasil diubah ke "${bulkStatus}"`
          );
          setSelectedIds([]);
          setBulkStatus("");
          fetchKaldik();
          setConfirmState((prev) => ({
            ...prev,
            open: false,
            loading: false,
          }));
        } catch (err) {
          console.error("Gagal ubah status massal:", err);
          addToast("error", "Gagal mengubah status massal");
          setConfirmState((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  }, [bulkStatus, selectedIds, addToast, fetchKaldik]);

  const clearFilters = useCallback(() => {
    setSemesterFilter("");
    setBulanFilter("");
    setUnitFilter("");
    setStatusFilter("");
    setKategoriFilter("");
    setSearch("");
  }, []);

  // ── Table Columns ──────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        key: "tanggal",
        header: "Tanggal",
        width: "150px",
        render: (row: KaldikWithUnit) => {
          if (row.tanggal_mulai) {
            const start = formatDateDisplay(row.tanggal_mulai);
            if (
              row.tanggal_selesai &&
              row.tanggal_selesai !== row.tanggal_mulai
            ) {
              const end = formatDateDisplay(row.tanggal_selesai);
              return (
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {start}
                  </div>
                  <div className="text-xs text-gray-500">s/d {end}</div>
                </div>
              );
            }
            return (
              <span className="text-sm font-medium text-gray-900">
                {start}
              </span>
            );
          }
          return (
            <span className="text-sm text-gray-400 italic">
              {row.tanggal_mentah || "-"}
            </span>
          );
        },
      },
      {
        key: "nama_kegiatan",
        header: "Nama Kegiatan",
        render: (row: KaldikWithUnit) => (
          <div>
            <div className="text-sm font-medium text-gray-900">
              {row.nama_kegiatan}
            </div>
            {row.masuk_pokok_doa && (
              <div className="text-xs text-indigo-500 mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Pokok Doa
              </div>
            )}
          </div>
        ),
      },
      {
        key: "unit",
        header: "Unit",
        width: "120px",
        render: (row: KaldikWithUnit) => (
          <UnitBadge unitName={row.unit?.name || row.unit_scope || "-"} />
        ),
      },
      {
        key: "kategori",
        header: "Kategori",
        width: "110px",
        render: (row: KaldikWithUnit) => (
          <span className="text-sm text-gray-600">{row.kategori}</span>
        ),
      },
      {
        key: "prioritas_doa",
        header: "Prioritas",
        width: "80px",
        align: "center" as const,
        render: (row: KaldikWithUnit) => (
          <span
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold",
              row.prioritas_doa <= 3
                ? "bg-red-100 text-red-700"
                : row.prioritas_doa <= 6
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
            )}
          >
            {row.prioritas_doa}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "110px",
        render: (row: KaldikWithUnit) => <StatusBadge status={row.status} />,
      },
      {
        key: "aksi",
        header: "Aksi",
        width: "150px",
        align: "center" as const,
        render: (row: KaldikWithUnit) => (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditForm(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Duplikasi"
            >
              <Copy size={14} />
            </button>
            {row.status !== "Dibatalkan" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel(row);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Batalkan"
              >
                <XCircle size={14} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Hapus"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
      },
    ],
    [openEditForm, handleDuplicate, handleCancel, handleDelete]
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Kalender Pendidikan"
        description="Kelola agenda kegiatan kalender pendidikan"
        action={
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Tambah Kegiatan
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Cari nama kegiatan..."
            className="sm:w-64"
          />
          <FilterBar
            activeCount={activeFilterCount}
            onClearAll={clearFilters}
          >
            <FilterSelect
              value={tahunAjaran}
              onChange={setTahunAjaran}
              options={TAHUN_AJARAN_OPTIONS}
              placeholder="Tahun Ajaran"
            />
            <FilterSelect
              value={semesterFilter}
              onChange={setSemesterFilter}
              options={SEMESTER_OPTIONS}
              placeholder="Semester"
            />
            <FilterSelect
              value={bulanFilter}
              onChange={setBulanFilter}
              options={BULAN_OPTIONS}
              placeholder="Bulan"
            />
            <FilterSelect
              value={unitFilter}
              onChange={setUnitFilter}
              options={unitOptions}
              placeholder="Unit"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              placeholder="Status"
            />
            <FilterSelect
              value={kategoriFilter}
              onChange={setKategoriFilter}
              options={KATEGORI_OPTIONS}
              placeholder="Kategori"
            />
          </FilterBar>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.length} data dipilih
          </span>
          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Pilih status...</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkStatusChange}
              disabled={!bulkStatus}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Ubah Status
            </button>
            <button
              onClick={() => {
                setSelectedIds([]);
                setBulkStatus("");
              }}
              className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Tidak ada data kaldik ditemukan"
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        idField="id"
        pageSize={25}
      />

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingKaldik(null);
        }}
        title={editingKaldik ? "Edit Kaldik" : "Tambah Kegiatan Baru"}
        size="lg"
      >
        <div className="space-y-5">
          {/* Nama Kegiatan */}
          <Input
            label="Nama Kegiatan *"
            value={formData.nama_kegiatan}
            onChange={(e) => handleFormChange("nama_kegiatan", e.target.value)}
            placeholder="Contoh: Ibadah Pembukaan Tahun Ajaran"
          />

          {/* Row: Tahun Ajaran & Semester */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tahun Ajaran *"
              value={formData.tahun_ajaran}
              onChange={(e) =>
                handleFormChange("tahun_ajaran", e.target.value)
              }
              options={TAHUN_AJARAN_OPTIONS}
            />
            <Select
              label="Semester *"
              value={formData.semester}
              onChange={(e) => handleFormChange("semester", e.target.value)}
              options={SEMESTER_OPTIONS}
            />
          </div>

          {/* Row: Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal Mulai"
              type="date"
              value={formData.tanggal_mulai}
              onChange={(e) =>
                handleFormChange("tanggal_mulai", e.target.value)
              }
            />
            <Input
              label="Tanggal Selesai"
              type="date"
              value={formData.tanggal_selesai}
              onChange={(e) =>
                handleFormChange("tanggal_selesai", e.target.value)
              }
            />
          </div>

          {/* Row: Bulan & Tahun */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Bulan *"
              value={formData.bulan}
              onChange={(e) => handleFormChange("bulan", e.target.value)}
              options={BULAN_OPTIONS}
            />
            <Input
              label="Tahun *"
              type="number"
              value={formData.tahun}
              onChange={(e) => handleFormChange("tahun", e.target.value)}
              min={2020}
              max={2035}
            />
          </div>

          {/* Row: Unit & Kategori */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Unit *"
              value={formData.unit_id}
              onChange={(e) => handleFormChange("unit_id", e.target.value)}
              options={unitOptions}
              placeholder="Pilih unit..."
            />
            <Select
              label="Kategori"
              value={formData.kategori}
              onChange={(e) => handleFormChange("kategori", e.target.value)}
              options={KATEGORI_OPTIONS}
            />
          </div>

          {/* Row: Prioritas & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Prioritas Doa"
              value={formData.prioritas_doa}
              onChange={(e) =>
                handleFormChange("prioritas_doa", e.target.value)
              }
              options={PRIORITAS_OPTIONS}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => handleFormChange("status", e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>

          {/* Masuk Pokok Doa */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.masuk_pokok_doa}
              onChange={(e) =>
                handleFormChange("masuk_pokok_doa", e.target.checked)
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Masuk Pokok Doa
            </span>
          </label>

          {/* Catatan Doa */}
          <Textarea
            label="Catatan Doa"
            value={formData.catatan_doa}
            onChange={(e) => handleFormChange("catatan_doa", e.target.value)}
            placeholder="Catatan untuk pokok doa..."
            rows={3}
          />

          {/* Row: Tanggal Mentah & Sumber */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal Mentah"
              value={formData.tanggal_mentah}
              onChange={(e) =>
                handleFormChange("tanggal_mentah", e.target.value)
              }
              placeholder="Teks tanggal asli"
            />
            <Input
              label="Sumber Data"
              value={formData.sumber_data}
              onChange={(e) =>
                handleFormChange("sumber_data", e.target.value)
              }
              placeholder="Manual"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingKaldik(null);
              }}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving
                ? "Menyimpan..."
                : editingKaldik
                  ? "Simpan Perubahan"
                  : "Tambah Kegiatan"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() =>
          setConfirmState((prev) => ({ ...prev, open: false, loading: false }))
        }
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        loading={confirmState.loading}
        confirmText={confirmState.loading ? "Memproses..." : "Ya, Lanjutkan"}
        cancelText="Batal"
      />
    </div>
  );
}
