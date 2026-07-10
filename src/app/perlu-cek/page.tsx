"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Search } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
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
import type { PerluCek, Unit } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Tervalidasi", label: "Tervalidasi" },
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
const UNIT_OPTIONS = UNITS.map((u) => ({ value: u.id, label: u.name }));

interface ValidateFormData {
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

const EMPTY_VALIDATE_FORM: ValidateFormData = {
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

export default function PerluCekPage() {
  const { addToast } = useToast();

  // Data
  const [data, setData] = useState<PerluCek[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  // Validate modal
  const [validateTarget, setValidateTarget] = useState<PerluCek | null>(null);
  const [validateForm, setValidateForm] =
    useState<ValidateFormData>(EMPTY_VALIDATE_FORM);
  const [saving, setSaving] = useState(false);

  // Ignore confirm
  const [ignoreTarget, setIgnoreTarget] = useState<PerluCek | null>(null);
  const [ignoring, setIgnoring] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("perlu_cek")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterStatus) query = query.eq("status", filterStatus);

    const { data: result, error } = await query;
    if (error) {
      addToast("error", "Gagal memuat data perlu cek");
    } else {
      setData(result || []);
    }
    setLoading(false);
  }, [filterStatus, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = data.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.nama_kegiatan || "").toLowerCase().includes(q) ||
      (item.unit_text || "").toLowerCase().includes(q) ||
      (item.kategori || "").toLowerCase().includes(q) ||
      (item.alasan_cek || "").toLowerCase().includes(q)
    );
  });

  const activeFilterCount = filterStatus ? 1 : 0;

  // Open validate modal — pre-fill from raw data
  const openValidate = (row: PerluCek) => {
    setValidateTarget(row);
    setValidateForm({
      tahun_ajaran: row.tahun_ajaran || "",
      semester: "",
      bulan: String(row.bulan || ""),
      unit_id: "",
      nama_kegiatan: row.nama_kegiatan || "",
      kategori: row.kategori || "",
      tanggal_mulai: "",
      tanggal_selesai: "",
      catatan: row.catatan || "",
    });
  };

  const handleValidate = async () => {
    if (!validateTarget) return;
    if (
      !validateForm.tahun_ajaran ||
      !validateForm.semester ||
      !validateForm.bulan ||
      !validateForm.unit_id ||
      !validateForm.nama_kegiatan
    ) {
      addToast(
        "warning",
        "Tahun ajaran, semester, bulan, unit, dan nama kegiatan wajib diisi"
      );
      return;
    }

    setSaving(true);
    const tahun = Number(validateForm.tahun_ajaran.split("-")[0]);

    // Insert into kaldik
    const kaldik_id = `KAL-${Date.now()}`;
    const { error: kaldikError } = await supabase.from("kaldik").insert({
      kaldik_id,
      tahun_ajaran: validateForm.tahun_ajaran,
      semester: Number(validateForm.semester),
      bulan: Number(validateForm.bulan),
      tahun,
      unit_id: validateForm.unit_id,
      unit_scope: "UNIT",
      tanggal_mulai: validateForm.tanggal_mulai || null,
      tanggal_selesai: validateForm.tanggal_selesai || null,
      tanggal_mentah: validateTarget.tanggal_mentah,
      nama_kegiatan: validateForm.nama_kegiatan,
      kategori: validateForm.kategori || "Umum",
      status: "Draft",
      sumber_data: "Import",
      spreadsheet_row_id: validateTarget.spreadsheet_row_id,
    });

    if (kaldikError) {
      addToast("error", "Gagal membuat data Kaldik");
      setSaving(false);
      return;
    }

    // Mark perlu_cek as Tervalidasi
    const { error: updateError } = await supabase
      .from("perlu_cek")
      .update({ status: "Tervalidasi" })
      .eq("id", validateTarget.id);

    if (updateError) {
      addToast("warning", "Kaldik berhasil dibuat, tetapi gagal update status perlu cek");
    } else {
      addToast("success", "Data berhasil divalidasi dan dikonversi ke Kaldik");
    }

    setValidateTarget(null);
    setSaving(false);
    fetchData();
  };

  const handleIgnore = async () => {
    if (!ignoreTarget) return;
    setIgnoring(true);
    const { error } = await supabase
      .from("perlu_cek")
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
      render: (row: PerluCek) => (
        <span className="text-sm font-medium text-gray-900">
          {row.nama_kegiatan || "-"}
        </span>
      ),
    },
    {
      key: "unit_text",
      header: "Unit Text",
      width: "120px",
      render: (row: PerluCek) => (
        <span className="text-sm text-gray-600">{row.unit_text || "-"}</span>
      ),
    },
    {
      key: "tanggal_mentah",
      header: "Tanggal Mentah",
      width: "140px",
      render: (row: PerluCek) => (
        <span className="text-xs text-gray-500 font-mono">
          {row.tanggal_mentah || "-"}
        </span>
      ),
    },
    {
      key: "kategori",
      header: "Kategori",
      width: "110px",
      render: (row: PerluCek) => (
        <span className="text-sm text-gray-600">{row.kategori || "-"}</span>
      ),
    },
    {
      key: "alasan_cek",
      header: "Alasan Cek",
      render: (row: PerluCek) => (
        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
          {row.alasan_cek || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (row: PerluCek) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      render: (row: PerluCek) =>
        row.status === "Pending" ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openValidate(row);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Validasi"
            >
              <CheckCircle size={15} />
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
        title="Perlu Cek"
        description="Data ambigu dari import yang perlu diverifikasi"
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
          placeholder="Cari nama kegiatan, unit, kategori..."
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_OPTIONS.map((opt) => {
          const count = data.filter((d) => d.status === opt.value).length;
          const colors: Record<string, string> = {
            Pending: "border-amber-200 bg-amber-50 text-amber-700",
            Tervalidasi: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
          icon={<Search size={48} />}
          title="Tidak ada data perlu cek"
          description="Semua data import sudah bersih atau belum ada data yang diimport."
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

      {/* Validate Modal */}
      <Modal
        open={!!validateTarget}
        onClose={() => setValidateTarget(null)}
        title="Validasi & Konversi ke Kaldik"
        size="lg"
      >
        {validateTarget && (
          <div className="space-y-4">
            {/* Info asal data */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800 mb-1">
                Data Asal (Perlu Cek)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-amber-700">
                <div>
                  <span className="font-medium">Kegiatan:</span>{" "}
                  {validateTarget.nama_kegiatan || "-"}
                </div>
                <div>
                  <span className="font-medium">Unit Text:</span>{" "}
                  {validateTarget.unit_text || "-"}
                </div>
                <div>
                  <span className="font-medium">Tanggal Mentah:</span>{" "}
                  {validateTarget.tanggal_mentah || "-"}
                </div>
                <div>
                  <span className="font-medium">Alasan:</span>{" "}
                  {validateTarget.alasan_cek || "-"}
                </div>
              </div>
            </div>

            {/* Form to fill in proper data */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tahun Ajaran"
                value={validateForm.tahun_ajaran}
                onChange={(e) =>
                  setValidateForm((f) => ({
                    ...f,
                    tahun_ajaran: e.target.value,
                  }))
                }
                options={TAHUN_AJARAN_OPTIONS}
                placeholder="Pilih tahun ajaran"
              />
              <Select
                label="Semester"
                value={validateForm.semester}
                onChange={(e) =>
                  setValidateForm((f) => ({ ...f, semester: e.target.value }))
                }
                options={SEMESTER_OPTIONS}
                placeholder="Pilih semester"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Bulan"
                value={validateForm.bulan}
                onChange={(e) =>
                  setValidateForm((f) => ({ ...f, bulan: e.target.value }))
                }
                options={BULAN_OPTIONS}
                placeholder="Pilih bulan"
              />
              <Select
                label="Unit"
                value={validateForm.unit_id}
                onChange={(e) =>
                  setValidateForm((f) => ({ ...f, unit_id: e.target.value }))
                }
                options={UNIT_OPTIONS}
                placeholder="Pilih unit"
              />
            </div>
            <Input
              label="Nama Kegiatan"
              value={validateForm.nama_kegiatan}
              onChange={(e) =>
                setValidateForm((f) => ({
                  ...f,
                  nama_kegiatan: e.target.value,
                }))
              }
              placeholder="Nama kegiatan"
            />
            <Select
              label="Kategori"
              value={validateForm.kategori}
              onChange={(e) =>
                setValidateForm((f) => ({ ...f, kategori: e.target.value }))
              }
              options={KATEGORI_OPTIONS}
              placeholder="Pilih kategori"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tanggal Mulai"
                type="date"
                value={validateForm.tanggal_mulai}
                onChange={(e) =>
                  setValidateForm((f) => ({
                    ...f,
                    tanggal_mulai: e.target.value,
                  }))
                }
              />
              <Input
                label="Tanggal Selesai"
                type="date"
                value={validateForm.tanggal_selesai}
                onChange={(e) =>
                  setValidateForm((f) => ({
                    ...f,
                    tanggal_selesai: e.target.value,
                  }))
                }
              />
            </div>
            <Textarea
              label="Catatan"
              value={validateForm.catatan}
              onChange={(e) =>
                setValidateForm((f) => ({ ...f, catatan: e.target.value }))
              }
              placeholder="Catatan tambahan..."
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setValidateTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleValidate}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Memproses..." : "Validasi & Buat Kaldik"}
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
