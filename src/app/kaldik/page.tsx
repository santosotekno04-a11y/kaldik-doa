"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Edit2,
  Copy,
  XCircle,
  Trash2,
  Loader2,
  List,
  CalendarDays,
  ChevronLeft as CalChevronLeft,
  ChevronRight as CalChevronRight,
  Users,
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

// ── Calendar Helpers ─────────────────────────────────────────
const CAL_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const CAL_DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function getDaysInMonthGrid(month: number, year: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay(); // 0=Sun, 1=Mon, ...
  const days: (number | null)[] = [];

  // Monday-based offset
  const startOffset = startDay === 0 ? 6 : startDay - 1;
  for (let i = 0; i < startOffset; i++) days.push(null);

  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

  while (days.length % 7 !== 0) days.push(null);

  return days;
}

function getUnitColor(unitName: string | undefined): string {
  const colors: Record<string, string> = {
    'SD': 'bg-blue-100 text-blue-800 border-blue-200',
    'SMP': 'bg-purple-100 text-purple-800 border-purple-200',
    'TK': 'bg-rose-100 text-rose-800 border-rose-200',
    'TBI': 'bg-teal-100 text-teal-800 border-teal-200',
    'Manajemen': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Universal': 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[unitName || ''] || 'bg-indigo-100 text-indigo-800 border-indigo-200';
}

function getUnitDotColor(unitName: string | undefined): string {
  const colors: Record<string, string> = {
    'SD': 'bg-blue-500',
    'SMP': 'bg-purple-500',
    'TK': 'bg-rose-500',
    'TBI': 'bg-teal-500',
    'Manajemen': 'bg-emerald-500',
    'Universal': 'bg-gray-500',
  };
  return colors[unitName || ''] || 'bg-indigo-500';
}

function isHoliday(day: number | null, month: number, year: number, holidays: Set<string>): boolean {
  if (!day) return false;
  const date = new Date(year, month, day);
  const dow = date.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return true;
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return holidays.has(dateStr);
}

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

function detectDuplicates(data: KaldikWithUnit[]): Map<string, KaldikWithUnit[]> {
  const groups = new Map<string, KaldikWithUnit[]>();
  data.forEach(k => {
    if (!k.tanggal_mulai || !k.nama_kegiatan) return;
    const key = `${k.tanggal_mulai}::${k.nama_kegiatan.toLowerCase().trim()}`;
    const existing = groups.get(key) || [];
    existing.push(k);
    groups.set(key, existing);
  });
  const duplicates = new Map<string, KaldikWithUnit[]>();
  groups.forEach((items, key) => {
    if (items.length > 1) {
      duplicates.set(key, items);
    }
  });
  return duplicates;
}

type CalendarDisplayEvent = {
  key: string;
  nama_kegiatan: string;
  unitNames: string[];
  isMerged: boolean;
  events: KaldikWithUnit[];
};

function groupCalendarEvents(events: KaldikWithUnit[]): CalendarDisplayEvent[] {
  const groups = new Map<string, KaldikWithUnit[]>();
  events.forEach(evt => {
    const key = evt.nama_kegiatan.toLowerCase().trim();
    const existing = groups.get(key) || [];
    existing.push(evt);
    groups.set(key, existing);
  });
  const result: CalendarDisplayEvent[] = [];
  groups.forEach((items, key) => {
    const uniqueUnits = [...new Set(items.map(i => i.unit?.name || '-'))];
    result.push({
      key: uniqueUnits.length > 1 ? `merged-${key}` : items[0].id,
      nama_kegiatan: items[0].nama_kegiatan,
      unitNames: uniqueUnits,
      isMerged: uniqueUnits.length > 1,
      events: items,
    });
  });
  return result;
}

// ── Mobile Card List Component ──────────────────────────────
function MobileKaldikList({
  data,
  duplicates,
  onEdit,
  onDuplicate,
  onCancel,
  onDelete,
}: {
  data: KaldikWithUnit[];
  duplicates: Map<string, KaldikWithUnit[]>;
  onEdit: (item: KaldikWithUnit) => void;
  onDuplicate: (item: KaldikWithUnit) => void;
  onCancel: (item: KaldikWithUnit) => void;
  onDelete: (item: KaldikWithUnit) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const totalPages = Math.ceil(data.length / pageSize);
  const pagedData = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-2">
      {pagedData.map((item) => {
        const dupKey = item.tanggal_mulai && item.nama_kegiatan
          ? `${item.tanggal_mulai}::${item.nama_kegiatan.toLowerCase().trim()}`
          : '';
        const dupGroup = dupKey ? duplicates.get(dupKey) : undefined;
        const isDup = !!dupGroup && dupGroup.length > 1;

        return (
          <div
            key={item.id}
            className={cn(
              "bg-white rounded-xl border border-gray-200 p-3.5 active:bg-gray-50 transition-colors",
              isDup && "border-l-4 border-l-amber-400"
            )}
          >
            {/* Row 1: Date + Unit + Status */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-medium text-gray-500 shrink-0">
                  {item.tanggal_mulai
                    ? formatDateDisplay(item.tanggal_mulai)
                    : item.tanggal_mentah || "-"}
                </span>
                {item.tanggal_selesai && item.tanggal_selesai !== item.tanggal_mulai && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    s/d {formatDateDisplay(item.tanggal_selesai)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <UnitBadge unitName={item.unit?.name || item.unit_scope || "-"} />
                <StatusBadge status={item.status} />
              </div>
            </div>

            {/* Row 2: Activity Name */}
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate flex-1">
                {item.nama_kegiatan}
              </p>
              {isDup && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                  <Users size={9} />
                  ×{dupGroup!.length}
                </span>
              )}
            </div>

            {/* Row 3: Category + Priority + Doa */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400">{item.kategori}</span>
              <span className="text-[10px] text-gray-300">•</span>
              <span
                className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold",
                  item.prioritas_doa <= 3
                    ? "bg-red-100 text-red-700"
                    : item.prioritas_doa <= 6
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                )}
              >
                {item.prioritas_doa}
              </span>
              {item.masuk_pokok_doa && (
                <>
                  <span className="text-[10px] text-gray-300">•</span>
                  <span className="text-[11px] text-indigo-500 flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Doa
                  </span>
                </>
              )}
            </div>

            {/* Row 4: Actions */}
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => onEdit(item)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Edit2 size={12} />
                Edit
              </button>
              <button
                onClick={() => onDuplicate(item)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Copy size={12} />
                Duplikat
              </button>
              {item.status !== "Dibatalkan" && (
                <button
                  onClick={() => onCancel(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <XCircle size={12} />
                  Batal
                </button>
              )}
              <button
                onClick={() => onDelete(item)}
                className="flex items-center justify-center p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2.5">
          <span className="text-xs text-gray-400">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} dari {data.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <CalChevronLeft size={16} />
            </button>
            <span className="px-2 text-xs text-gray-500">{page + 1}/{totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <CalChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  // ── View Mode & Calendar State ────────────────────────────
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<{ day: number; events: KaldikWithUnit[] } | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [calendarUnitFilter, setCalendarUnitFilter] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // ── Duplicate Detection State ─────────────────────────────
  const [duplicates, setDuplicates] = useState<Map<string, KaldikWithUnit[]>>(new Map());
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

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

  const fetchHolidays = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hari_khusus')
        .select('tanggal, nama_hari');
      if (error) throw error;
      const dateSet = new Set<string>((data || []).map((h: { tanggal: string }) => h.tanggal));
      setHolidays(dateSet);
    } catch (err) {
      console.error('Gagal memuat hari khusus:', err);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    fetchKaldik();
  }, [fetchKaldik]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // ── Duplicate Detection ───────────────────────────────────
  useEffect(() => {
    setDuplicates(detectDuplicates(filteredData));
  }, [filteredData]);

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
        render: (row: KaldikWithUnit) => {
          const dupKey = row.tanggal_mulai && row.nama_kegiatan
            ? `${row.tanggal_mulai}::${row.nama_kegiatan.toLowerCase().trim()}`
            : '';
          const dupGroup = dupKey ? duplicates.get(dupKey) : undefined;
          const isDup = !!dupGroup && dupGroup.length > 1;
          const unitNames = isDup ? dupGroup.map(d => d.unit?.name || '-').join(', ') : '';
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {row.nama_kegiatan}
                </span>
                {isDup && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 shrink-0"
                    title={`Duplikat di unit: ${unitNames}`}
                  >
                    <Users size={10} />
                    ×{dupGroup.length} unit
                  </span>
                )}
              </div>
              {row.masuk_pokok_doa && (
                <div className="text-xs text-indigo-500 mt-0.5 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Pokok Doa
                </div>
              )}
            </div>
          );
        },
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
    [openEditForm, handleDuplicate, handleCancel, handleDelete, duplicates]
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Kalender Pendidikan"
        description="Kelola agenda kegiatan kalender pendidikan"
        action={
          <div className="flex items-center gap-2">
            {/* View Toggle - always visible */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all",
                  viewMode === "table"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <List size={14} />
                <span className="hidden sm:inline">Tabel</span>
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all",
                  viewMode === "calendar"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <CalendarDays size={14} />
                <span className="hidden sm:inline">Kalender</span>
              </button>
            </div>

            {duplicates.size > 0 && (
              <button
                onClick={() => setShowDuplicatesModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Users size={16} />
                <span className="hidden sm:inline">Gabungkan Duplikat</span>
                <span className="sm:hidden">Duplikat</span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                  {duplicates.size}
                </span>
              </button>
            )}
            <button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Tambah Kegiatan
            </button>
          </div>
        }
      />

      {/* Mobile Filter Toggle */}
      <button
        onClick={() => setShowMobileFilters(!showMobileFilters)}
        className="lg:hidden flex items-center justify-between w-full bg-white rounded-xl border border-gray-200 px-4 py-3"
      >
        <span className="text-sm font-medium text-gray-700">Filter & Pencarian</span>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <span className="text-gray-400 text-xs">{showMobileFilters ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 3-Panel Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_300px] gap-0 lg:gap-4">

        {/* ── Left Sidebar (Desktop Filters) ── */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3 sticky top-4">
            {/* Search */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Cari</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama kegiatan..."
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Tahun Ajaran */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tahun Ajaran</label>
              <select value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {TAHUN_AJARAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Semester</label>
              <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Semua</option>
                {SEMESTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Bulan */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Bulan</label>
              <select value={bulanFilter} onChange={(e) => setBulanFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Semua</option>
                {BULAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Unit Filter Chips */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Unit</label>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setUnitFilter("")} className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors", unitFilter === "" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>Semua</button>
                {['Universal', 'TK', 'SD', 'SMP', 'Manajemen', 'TBI'].map((unitName) => (
                  <button key={unitName} onClick={() => setUnitFilter(unitFilter === unitName ? "" : unitName)} className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors", unitFilter === unitName ? getUnitColor(unitName) : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")}>{unitName}</button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Semua</option>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Kategori */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Kategori</label>
              <select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Semua</option>
                {KATEGORI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* View Toggle */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tampilan</label>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setViewMode("table")} className={cn("inline-flex items-center gap-1 flex-1 justify-center px-2 py-1.5 text-[10px] font-medium rounded-md transition-all", viewMode === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                  <List size={12} /><span>Tabel</span>
                </button>
                <button onClick={() => setViewMode("calendar")} className={cn("inline-flex items-center gap-1 flex-1 justify-center px-2 py-1.5 text-[10px] font-medium rounded-md transition-all", viewMode === "calendar" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                  <CalendarDays size={12} /><span>Kalender</span>
                </button>
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="w-full text-[10px] text-indigo-600 hover:text-indigo-800 font-medium py-1">
                ✕ Hapus filter ({activeFilterCount})
              </button>
            )}

            {/* Tambah Agenda */}
            <button
              onClick={openCreateForm}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Tambah Agenda
            </button>
          </div>
        </div>

        {/* ── Mobile Collapsible Filters ── */}
        {showMobileFilters && (
          <div className="lg:hidden bg-white rounded-xl border border-gray-200 p-4 space-y-3">
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
            {/* View Toggle */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500 font-medium">Tampilan:</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    viewMode === "table"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <List size={14} />
                  <span className="hidden sm:inline">Tabel</span>
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    viewMode === "calendar"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <CalendarDays size={14} />
                  <span className="hidden sm:inline">Kalender</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Center Panel ── */}
        <div className="min-w-0">

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

      {/* Data Table - Desktop: normal table, Mobile: card list */}
      {viewMode === "table" ? (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              data={filteredData as unknown as Record<string, unknown>[]}
              loading={loading}
              emptyMessage="Tidak ada data kaldik ditemukan"
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              idField="id"
              pageSize={25}
              rowClassName={(row) => {
                const k = row as unknown as KaldikWithUnit;
                const dupKey = k.tanggal_mulai && k.nama_kegiatan
                  ? `${k.tanggal_mulai}::${k.nama_kegiatan.toLowerCase().trim()}`
                  : '';
                const dupGroup = dupKey ? duplicates.get(dupKey) : undefined;
                return dupGroup && dupGroup.length > 1 ? 'border-l-4 border-l-amber-400' : undefined;
              }}
            />
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">Tidak ada data kaldik ditemukan</p>
              </div>
            ) : (
              <MobileKaldikList
                data={filteredData}
                duplicates={duplicates}
                onEdit={openEditForm}
                onDuplicate={handleDuplicate}
                onCancel={handleCancel}
                onDelete={handleDelete}
              />
            )}
          </div>
        </>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-gray-500">Memuat data...</span>
            </div>
          ) : (
            <>
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear(calYear - 1);
                    } else {
                      setCalMonth(calMonth - 1);
                    }
                    setExpandedDay(null);
                    setSelectedDay(null);
                  }}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <CalChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-3 relative">
                  <button
                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                    className="text-sm sm:text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    {CAL_MONTH_NAMES[calMonth]} {calYear} ▾
                  </button>
                  {showMonthPicker && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[260px]">
                      {/* Year selector */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => setCalYear(calYear - 1)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        >
                          <CalChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold text-gray-800">{calYear}</span>
                        <button
                          onClick={() => setCalYear(calYear + 1)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        >
                          <CalChevronRight size={16} />
                        </button>
                      </div>
                      {/* Month grid */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {CAL_MONTH_NAMES.map((name, i) => {
                          const now = new Date();
                          const isCurrentMonth = i === now.getMonth() && calYear === now.getFullYear();
                          const isSelected = i === calMonth;
                          return (
                            <button
                              key={name}
                              onClick={() => {
                                setCalMonth(i);
                                setShowMonthPicker(false);
                                setExpandedDay(null);
                                setSelectedDay(null);
                              }}
                              className={cn(
                                "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : isCurrentMonth
                                    ? "bg-indigo-50 text-indigo-700 font-semibold"
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
                      const now = new Date();
                      setCalMonth(now.getMonth());
                      setCalYear(now.getFullYear());
                      setExpandedDay(null);
                      setSelectedDay(null);
                    }}
                    className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                  >
                    Hari Ini
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear(calYear + 1);
                    } else {
                      setCalMonth(calMonth + 1);
                    }
                    setExpandedDay(null);
                    setSelectedDay(null);
                  }}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <CalChevronRight size={18} />
                </button>
              </div>

              {/* Close month picker on outside click */}
              {showMonthPicker && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMonthPicker(false)}
                />
              )}

              {/* Unit Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 bg-gray-50/30 overflow-x-auto">
                <span className="text-[10px] text-gray-400 font-medium mr-1 shrink-0">Filter Unit:</span>
                <button
                  onClick={() => setCalendarUnitFilter(null)}
                  className={cn(
                    "px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium border transition-colors shrink-0",
                    calendarUnitFilter === null
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  Semua
                </button>
                {['Universal', 'TK', 'SD', 'SMP', 'Manajemen', 'TBI'].map((unitName) => (
                  <button
                    key={unitName}
                    onClick={() =>
                      setCalendarUnitFilter(calendarUnitFilter === unitName ? null : unitName)
                    }
                    className={cn(
                      "px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium border transition-colors shrink-0",
                      calendarUnitFilter === unitName
                        ? getUnitColor(unitName)
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {unitName}
                  </button>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="w-full overflow-hidden">
              <div className="grid grid-cols-7 w-full" style={{ tableLayout: 'fixed' }}>
                {/* Day Headers */}
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

                {/* Day Cells */}
                {getDaysInMonthGrid(calMonth, calYear).map((day, idx) => {
                  const dateStr = day
                    ? `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    : "";
                  const calendarFilteredData = calendarUnitFilter
                    ? filteredData.filter((k: KaldikWithUnit) => k.unit?.name === calendarUnitFilter)
                    : filteredData;
                  const dayEvents = day
                    ? calendarFilteredData.filter(
                        (k: KaldikWithUnit) =>
                          k.tanggal_mulai === dateStr ||
                          (k.tanggal_mulai && k.tanggal_mulai <= dateStr &&
                            k.tanggal_selesai && k.tanggal_selesai >= dateStr)
                      )
                    : [];
                  const today = new Date();
                  const isToday =
                    day === today.getDate() &&
                    calMonth === today.getMonth() &&
                    calYear === today.getFullYear();
                  const dayIsHoliday = isHoliday(day, calMonth, calYear, holidays);

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
                        day && dayIsHoliday && "bg-red-50",
                        day && !dayIsHoliday && "hover:bg-gray-50/80",
                        day && dayEvents.length > 0 && "cursor-pointer",
                        idx % 7 === 0 && "border-l-0",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      {day && (
                        <>
                          {/* Day Number */}
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-xs font-semibold",
                                isToday
                                  ? "bg-indigo-600 text-white ring-2 ring-indigo-200"
                                  : dayIsHoliday
                                    ? "text-red-600 font-bold"
                                    : "text-gray-700"
                              )}
                            >
                              {day}
                            </span>
                          </div>

                          {/* Desktop: Show pills (merged for duplicates) */}
                          <div className="hidden sm:flex flex-col gap-0.5 min-w-0 overflow-hidden">
                            {(() => {
                              const grouped = groupCalendarEvents(dayEvents);
                              return grouped.slice(0, 3).map((disp) => (
                                <div
                                  key={disp.key}
                                  className={cn(
                                    "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border min-w-0",
                                    disp.isMerged
                                      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                      : getUnitColor(disp.unitNames[0])
                                  )}
                                  title={disp.isMerged
                                    ? disp.nama_kegiatan + ' — ' + disp.unitNames.join(' • ') + ' (×' + disp.events.length + ')'
                                    : disp.nama_kegiatan + ' (' + disp.unitNames[0] + ')'
                                  }
                                >
                                  <span className="truncate">{disp.nama_kegiatan.length > 18
                                    ? disp.nama_kegiatan.slice(0, 18) + "..."
                                    : disp.nama_kegiatan}</span>
                                  {disp.isMerged && (
                                    <span className="ml-1 text-[9px] font-semibold opacity-70">
                                      {disp.unitNames.map(u => u?.slice(0, 3)).join('•')}
                                    </span>
                                  )}
                                </div>
                              ));
                            })()}
                            {(() => {
                              const grouped = groupCalendarEvents(dayEvents);
                              return grouped.length > 3 ? (
                                <span className="text-[10px] text-gray-400 pl-1 hidden sm:inline">
                                  +{grouped.length - 3} lagi
                                </span>
                              ) : null;
                            })()}
                          </div>

                          {/* Mobile: Show colored dots */}
                          <div className="sm:hidden">
                            {dayEvents.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                                {dayEvents.slice(0, 5).map((evt) => (
                                  <span
                                    key={evt.id}
                                    className={cn(
                                      "w-2.5 h-2.5 rounded-full shrink-0",
                                      getUnitDotColor(evt.unit?.name)
                                    )}
                                    title={evt.nama_kegiatan + ' (' + (evt.unit?.name || '-') + ')'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDay({ day: day!, events: dayEvents });
                                    }}
                                  />
                                ))}
                                {dayEvents.length > 5 && (
                                  <span className="text-[8px] text-gray-400 font-medium leading-none self-center">
                                    {dayEvents.length - 5}+
                                  </span>
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
                {[
                  { name: 'SD', dot: 'bg-blue-500' },
                  { name: 'SMP', dot: 'bg-purple-500' },
                  { name: 'TK', dot: 'bg-rose-500' },
                  { name: 'TBI', dot: 'bg-teal-500' },
                  { name: 'Manajemen', dot: 'bg-emerald-500' },
                  { name: 'Universal', dot: 'bg-gray-500' },
                ].map((u) => (
                  <span key={u.name} className="inline-flex items-center gap-1">
                    <span className={cn("w-2.5 h-2.5 rounded-full", u.dot)} />
                    <span className="text-[10px] text-gray-500">{u.name}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

        </div>{/* Close Center Panel */}

        {/* ── Right Detail Panel (Desktop lg+) ── */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-4 overflow-hidden">
            {selectedDay ? (
              <>
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {selectedDay.day} {CAL_MONTH_NAMES[calMonth]} {calYear}
                    </h3>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{selectedDay.events.length} kegiatan</p>
                </div>
                <div className="p-3 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {selectedDay.events.map((evt: KaldikWithUnit) => (
                    <div
                      key={evt.id}
                      onClick={() => openEditForm(evt)}
                      className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50/80 hover:border-indigo-200 transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {evt.nama_kegiatan}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border",
                            getUnitColor(evt.unit?.name)
                          )}
                        >
                          {evt.unit?.name || '-'}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {evt.kategori}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {evt.tanggal_mulai
                          ? `${formatDateDisplay(evt.tanggal_mulai)}${evt.tanggal_selesai && evt.tanggal_selesai !== evt.tanggal_mulai ? ` — ${formatDateDisplay(evt.tanggal_selesai)}` : ''}`
                          : evt.tanggal_mentah || '-'}
                      </p>
                      {evt.catatan_doa && (
                        <p className="text-[10px] text-indigo-600 mt-1 italic truncate">
                          🙏 {evt.catatan_doa}
                        </p>
                      )}
                      <div className="mt-1.5">
                        <StatusBadge status={evt.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <CalendarDays size={32} className="text-gray-300 mb-3" />
                <p className="text-xs text-gray-400 font-medium">Pilih tanggal untuk melihat detail</p>
                <p className="text-[10px] text-gray-300 mt-1">Klik hari pada kalender</p>
              </div>
            )}
          </div>
        </div>

      </div>{/* Close 3-Panel Grid */}

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

      {/* Duplicates Modal */}
      {showDuplicatesModal && (
        <Modal
          open={showDuplicatesModal}
          onClose={() => setShowDuplicatesModal(false)}
          title="Kegiatan Duplikat Terdeteksi"
          size="lg"
        >
          <div className="space-y-4">
            {duplicates.size === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Tidak ada kegiatan duplikat terdeteksi.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Ditemukan <span className="font-semibold text-amber-700">{duplicates.size}</span> grup kegiatan
                  dengan nama yang sama pada tanggal yang sama tetapi dari unit berbeda.
                </p>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {Array.from(duplicates.entries()).map(([key, items]) => {
                    const eventName = items[0].nama_kegiatan;
                    const eventDate = items[0].tanggal_mulai;
                    return (
                      <div
                        key={key}
                        className="border border-amber-200 rounded-xl p-4 bg-amber-50/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {eventName}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {eventDate ? formatDateDisplay(eventDate) : '-'}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                            x{items.length} unit
                          </span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                                    getUnitColor(item.unit?.name)
                                  )}
                                >
                                  {item.unit?.name || '-'}
                                </span>
                                <span className="text-xs text-gray-500 truncate">
                                  {item.status}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0">
                                ID: {item.kaldik_id || item.id?.slice(0, 8)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setShowDuplicatesModal(false)}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Day Detail Modal (Mobile/Tablet only - desktop uses right panel) */}
      {selectedDay && (
        <>
          {/* Tablet: centered modal */}
          <div className="hidden sm:flex lg:hidden fixed inset-0 z-[60] items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSelectedDay(null)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
                <h3 className="text-base font-semibold text-gray-900">
                  Kegiatan {selectedDay.day} {CAL_MONTH_NAMES[calMonth]} {calYear}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3">
                {selectedDay.events.map((evt: KaldikWithUnit) => (
                  <div
                    key={evt.id}
                    className="border border-gray-100 rounded-xl p-3.5 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {evt.nama_kegiatan}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                              getUnitColor(evt.unit?.name)
                            )}
                          >
                            {evt.unit?.name || '-'}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {evt.kategori}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          {evt.tanggal_mulai
                            ? `${formatDateDisplay(evt.tanggal_mulai)}${evt.tanggal_selesai && evt.tanggal_selesai !== evt.tanggal_mulai ? ` — ${formatDateDisplay(evt.tanggal_selesai)}` : ''}`
                            : evt.tanggal_mentah || '-'}
                        </p>
                        {evt.catatan_doa && (
                          <p className="text-xs text-indigo-600 mt-1.5 italic">
                            🙏 {evt.catatan_doa}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={evt.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: bottom sheet */}
          <div className="lg:hidden fixed inset-0 z-[60]">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSelectedDay(null)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto pb-20">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-2xl">
                <h3 className="text-sm font-semibold text-gray-900">
                  Kegiatan {selectedDay.day} {CAL_MONTH_NAMES[calMonth]} {calYear}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 space-y-3">
                {selectedDay.events.map((evt: KaldikWithUnit) => (
                  <div
                    key={evt.id}
                    className="border border-gray-100 rounded-xl p-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {evt.nama_kegiatan}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                          getUnitColor(evt.unit?.name)
                        )}
                      >
                        {evt.unit?.name || '-'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {evt.kategori}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {evt.tanggal_mulai
                        ? `${formatDateDisplay(evt.tanggal_mulai)}${evt.tanggal_selesai && evt.tanggal_selesai !== evt.tanggal_mulai ? ` — ${formatDateDisplay(evt.tanggal_selesai)}` : ''}`
                        : evt.tanggal_mentah || '-'}
                    </p>
                    {evt.catatan_doa && (
                      <p className="text-xs text-indigo-600 mt-1.5 italic">
                        🙏 {evt.catatan_doa}
                      </p>
                    )}
                    <div className="mt-1.5">
                      <StatusBadge status={evt.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
