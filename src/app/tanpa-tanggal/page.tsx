"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { CalendarPlus, XCircle, CalendarOff } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { UnitBadge } from "@/components/ui/unit-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SearchBar,
  FilterBar,
  FilterSelect,
  PageHeader,
  EmptyState,
} from "@/components/ui/filter-bar";
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase/client";
import { getMonthName } from "@/lib/utils/date";
import { UNITS } from "@/lib/constants/units";
import { KATEGORI_LIST } from "@/lib/constants/status";
import type { TanpaTanggal, Unit } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Dikonversi", label: "Dikonversi" },
  { value: "Diabaikan", label: "Diabaikan" },
];

const BULAN_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: getMonthName(i + 1),
}));

const SEMESTER_OPTIONS = [
  { value: "1", label: "Semester 1 (Ganjil)" },
  { value: "2", label: "Semester 2 (Genap)" },
];

function generateTahunAjaranOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { value: string; label: string }[] = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    options.push({ value: `${y}-${y + 1}`, label: `${y}-${y + 1}` });
  }
  return options;
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions();
const KATEGORI_OPTIONS = KATEGORI_LIST.map((k) => ({ value: k, label: k }));

interface ConvertFormData {
  tahun_ajaran: string;
  semester: string;
  bulan: string;
  unit_id: string;
  nama_kegiatan: string;
  kategori: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  catatan: string;
}

const EMPTY_CONVERT_FORM: ConvertFormData = {
  tahun_ajaran: "",
  semester: "",
  bulan: "",
  unit_id: "",
  nama_kegiatan: "",
  kategori: "",
  tanggal_mulai: "",
  tanggal_selesai: "",
  catatan: "",
};

export default function TanpaTanggalPage() {
  const { addToast } = useToast();

  // Data
  const [data, setData] = useState<(TanpaTanggal & { units?: Unit })[]>([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  // Convert modal
  const [convertTarget, setConvertTarget] = useState<TanpaTanggal | null>(null);
  const [convertForm, setConvertForm] =
    useState<ConvertFormData>(EMPTY_CONVERT_FORM);
  const [saving, setSaving] = useState(false);

  // Ignore confirm
  const [ignoreTarget, setIgnoreTarget] = useState<TanpaTanggal | null>(null);
  const [ignoring, setIgnoring] = useState(false);

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));

  const fetchUnits = useCallback(async () => {
    const { data: unitsData } = await supabase
      .from("units")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (unitsData) setUnits(unitsData);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("tanpa_tanggal")
      .select("*, units(*)")
      .order("created_at", { ascending: false });

    if (filterStatus) query = query.eq("status", filterStatus);

    const { data: result, error } = await query;
    if (error) {
      addToast("error", "Gagal memuat data tanpa tanggal");
    } else {
      setData(result || []);
    }
    setLoading(false);
  }, [filterStatus, addToast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = data.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.nama_kegiatan || "").toLowerCase().includes(q) ||
      (item.units?.name || "").toLowerCase().includes(q) ||
      (item.tanggal_mentah || "").toLowerCase().includes(q) ||
      (item.catatan || "").toLowerCase().includes(q)
    );
  });

  const activeFilterCount = filterStatus ? 1 : 0;

  // Open convert modal — pre-fill from raw data
  const openConvert = (row: TanpaTanggal) => {
    setConvertTarget(row);
    setConvertForm({
      tahun_ajaran: row.tahun_ajaran || "",
      semester: "",
      bulan: String(row.bulan || ""),
      unit_id: row.unit_id || "",
      nama_kegiatan: row.nama_kegiatan || "",
      kategori: "",
      tanggal_mulai: "",
      tanggal_selesai: "",
      catatan: row.catatan || "",
    });
  };

  const handleConvert = async () => {
    if (!convertTarget) return;
    if (
      !convertForm.tahun_ajaran ||
      !convertForm.semester ||
      !convertForm.bulan ||
      !convertForm.unit_id ||
      !convertForm.nama_kegiatan ||
      !convertForm.tanggal_mulai
    ) {
      addToast(
        "warning",
        "Tahun ajaran, semester, bulan, unit, nama kegiatan, dan tanggal mulai wajib diisi"
      );
      return;
    }

    setSaving(true);
    const tahun = Number(convertForm.tahun_ajaran.split("-")[0]);

    // Insert into kaldik
    const kaldik_id = `KAL-${Date.now()}`;
    const { error: kaldikError } = await supabase.from("kaldik").insert({
      kaldik_id,
      tahun_ajaran: convertForm.tahun_ajaran,
      semester: Number(convertForm.semester),
      bulan: Number(convertForm.bulan),
      tahun,
      unit_id: convertForm.unit_id,
      unit_scope: "UNIT",
      tanggal_mulai: convertForm.tanggal_mulai || null,
      tanggal_selesai: convertForm.tanggal_selesai || null,
      tanggal_mentah: convertTarget.tanggal_mentah,
      nama_kegiatan: convertForm.nama_kegiatan,
      kategori: convertForm.kategori || "Umum",
      status: "Draft",
      sumber_data: "Import",
      spreadsheet_row_id: convertTarget.spreadsheet_row_id,
    });

    if (kaldikError) {
      addToast("error", "Gagal membuat data Kaldik");
      setSaving(false);
      return;
    }

    // Mark tanpa_tanggal as Dikonversi
    const { error: updateError } = await supabase
      .from("tanpa_tanggal")
      .update({ status: "Dikonversi" })
      .eq("id", convertTarget.id);

    if (updateError) {
      addToast("warning", "Kaldik berhasil dibuat, tetapi gagal update status data");
    } else {
      addToast("success", "Data berhasil dikonversi ke Kaldik");
    }

    setConvertTarget(null);
    setSaving(false);
    fetchData();
  };

  const handleIgnore = async () => {
    if (!ignoreTarget) return;
    setIgnoring(true);
    const { error } = await supabase
      .from("tanpa_tanggal")
      .update({ status: "Diabaikan" })
      .eq("id", ignoreTarget.id);
    if (error) {
      addToast("error", "Gagal mengabaikan data");
    } else {
      addToast("success", "Data berhasil diabaikan");
      fetchData();
    }
    setIgnoring(false);
    setIgnoreTarget(null);
  };

  const columns = [
    {
      key: "nama_kegiatan",
      header: "Nama Kegiatan",
      render: (row: TanpaTanggal) => (
        <span className="text-sm font-medium text-gray-900">
          {row.nama_kegiatan || "-"}
        </span>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "100px",
      render: (row: TanpaTanggal & { units?: Unit }) =>
        row.units?.name ? (
          <UnitBadge unitName={row.units.name} />
        ) : (
          <span className="text-xs text-gray-400">-</span>
        ),
    },
    {
      key: "tanggal_mentah",
      header: "Tanggal Mentah",
      width: "160px",
      render: (row: TanpaTanggal) => (
        <span className="text-xs text-gray-500 font-mono">
          {row.tanggal_mentah || (
            <span className="text-gray-300 italic">kosong</span>
          )}
        </span>
      ),
    },
    {
      key: "catatan",
      header: "Catatan",
      render: (row: TanpaTanggal) => (
        <span className="text-xs text-gray-600 line-clamp-2">
          {row.catatan || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (row: TanpaTanggal) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      render: (row: TanpaTanggal) =>
        row.status === "Pending" ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openConvert(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Konversi ke Kaldik"
            >
              <CalendarPlus size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIgnoreTarget(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Abaikan"
            >
              <XCircle size={15} />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tanpa Tanggal"
        description="Data tanpa tanggal dari import yang perlu dikonversi"
      />

      {/* Filters */}
      <div className="space-y-3">
        <FilterBar activeCount={activeFilterCount} onClearAll={() => setFilterStatus("")}>
          <FilterSelect
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_OPTIONS}
            placeholder="Semua Status"
          />
        </FilterBar>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari nama kegiatan, unit, catatan..."
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_OPTIONS.map((opt) => {
          const count = data.filter((d) => d.status === opt.value).length;
          const colors: Record<string, string> = {
            Pending: "border-blue-200 bg-blue-50 text-blue-700",
            Dikonversi: "border-emerald-200 bg-emerald-50 text-emerald-700",
            Diabaikan: "border-gray-200 bg-gray-50 text-gray-500",
          };
          return (
            <button
              key={opt.value}
              onClick={() =>
                setFilterStatus(filterStatus === opt.value ? "" : opt.value)
              }
              className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-colors ${
                colors[opt.value]
              } ${filterStatus === opt.value ? "ring-2 ring-indigo-400" : ""}`}
            >
              <span>{opt.label}</span>
              <span className="text-lg font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filteredData.length === 0 && !loading ? (
        <EmptyState
          icon={<CalendarOff size={48} />}
          title="Tidak ada data tanpa tanggal"
          description="Semua data import sudah memiliki tanggal atau belum ada data yang diimport."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredData as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="Tidak ada data ditemukan"
          idField="id"
          pageSize={20}
        />
      )}

      {/* Convert Modal */}
      <Modal
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        title="Konversi ke Kaldik"
        size="lg"
      >
        {convertTarget && (
          <div className="space-y-4">
            {/* Info asal data */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-800 mb-1">
                Data Asal (Tanpa Tanggal)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                <div>
                  <span className="font-medium">Kegiatan:</span>{" "}
                  {convertTarget.nama_kegiatan || "-"}
                </div>
                <div>
                  <span className="font-medium">Unit:</span>{" "}
                  {(convertTarget as unknown as Record<string, unknown>).unit ? ((convertTarget as unknown as Record<string, unknown>).unit as Record<string, string>).name : "-"}
                </div>
                <div>
                  <span className="font-medium">Tanggal Mentah:</span>{" "}
                  {convertTarget.tanggal_mentah || (
                    <span className="italic text-blue-400">kosong</span>
                  )}
                </div>
                <div>
                  <span className="font-medium">Catatan:</span>{" "}
                  {convertTarget.catatan || "-"}
                </div>
              </div>
            </div>

            {/* Form to fill in proper data */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tahun Ajaran"
                value={convertForm.tahun_ajaran}
                onChange={(e) =>
                  setConvertForm((f) => ({
                    ...f,
                    tahun_ajaran: e.target.value,
                  }))
                }
                options={TAHUN_AJARAN_OPTIONS}
                placeholder="Pilih tahun ajaran"
              />
              <Select
                label="Semester"
                value={convertForm.semester}
                onChange={(e) =>
                  setConvertForm((f) => ({ ...f, semester: e.target.value }))
                }
                options={SEMESTER_OPTIONS}
                placeholder="Pilih semester"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Bulan"
                value={convertForm.bulan}
                onChange={(e) =>
                  setConvertForm((f) => ({ ...f, bulan: e.target.value }))
                }
                options={BULAN_OPTIONS}
                placeholder="Pilih bulan"
              />
              <Select
                label="Unit"
                value={convertForm.unit_id}
                onChange={(e) =>
                  setConvertForm((f) => ({ ...f, unit_id: e.target.value }))
                }
                options={unitOptions}
                placeholder="Pilih unit"
              />
            </div>
            <Input
              label="Nama Kegiatan"
              value={convertForm.nama_kegiatan}
              onChange={(e) =>
                setConvertForm((f) => ({
                  ...f,
                  nama_kegiatan: e.target.value,
                }))
              }
              placeholder="Nama kegiatan"
            />
            <Select
              label="Kategori"
              value={convertForm.kategori}
              onChange={(e) =>
                setConvertForm((f) => ({ ...f, kategori: e.target.value }))
              }
              options={KATEGORI_OPTIONS}
              placeholder="Pilih kategori"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tanggal Mulai"
                type="date"
                value={convertForm.tanggal_mulai}
                onChange={(e) =>
                  setConvertForm((f) => ({
                    ...f,
                    tanggal_mulai: e.target.value,
                  }))
                }
              />
              <Input
                label="Tanggal Selesai"
                type="date"
                value={convertForm.tanggal_selesai}
                onChange={(e) =>
                  setConvertForm((f) => ({
                    ...f,
                    tanggal_selesai: e.target.value,
                  }))
                }
              />
            </div>
            <Textarea
              label="Catatan"
              value={convertForm.catatan}
              onChange={(e) =>
                setConvertForm((f) => ({ ...f, catatan: e.target.value }))
              }
              placeholder="Catatan tambahan..."
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConvertTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleConvert}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Memproses..." : "Konversi ke Kaldik"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ignore Confirm */}
      <ConfirmDialog
        open={!!ignoreTarget}
        onClose={() => setIgnoreTarget(null)}
        onConfirm={handleIgnore}
        title="Abaikan Data"
        message={`Yakin ingin mengabaikan data "${ignoreTarget?.nama_kegiatan || ""}"? Data ini tidak akan diproses lebih lanjut.`}
        confirmText="Abaikan"
        variant="danger"
        loading={ignoring}
      />
    </div>
  );
}
