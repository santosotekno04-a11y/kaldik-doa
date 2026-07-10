"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
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
import type { TemaBulanan, Unit } from "@/lib/types";

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

interface TemaFormData {
  tahun_ajaran: string;
  semester: string;
  bulan: string;
  unit_id: string;
  tema: string;
  ayat: string;
  profil: string;
  karakter: string;
  bestra: string;
  hbe: string;
  hm: string;
  catatan_tema: string;
}

const EMPTY_FORM: TemaFormData = {
  tahun_ajaran: "",
  semester: "",
  bulan: "",
  unit_id: "",
  tema: "",
  ayat: "",
  profil: "",
  karakter: "",
  bestra: "",
  hbe: "",
  hm: "",
  catatan_tema: "",
};

export default function TemaBulananPage() {
  const { addToast } = useToast();

  // Data
  const [data, setData] = useState<(TemaBulanan & { units?: Unit })[]>([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);

  // Filters
  const [filterTA, setFilterTA] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [search, setSearch] = useState("");

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemaFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TemaBulanan | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      .from("tema_bulanan")
      .select("*, units(*)")
      .order("tahun_ajaran", { ascending: false })
      .order("bulan", { ascending: true });

    if (filterTA) query = query.eq("tahun_ajaran", filterTA);
    if (filterSemester) query = query.eq("semester", Number(filterSemester));
    if (filterBulan) query = query.eq("bulan", Number(filterBulan));
    if (filterUnit) query = query.eq("unit_id", filterUnit);

    const { data: result, error } = await query;
    if (error) {
      addToast("error", "Gagal memuat data tema bulanan");
    } else {
      setData(result || []);
    }
    setLoading(false);
  }, [filterTA, filterSemester, filterBulan, filterUnit, addToast]);

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
      (item.tema || "").toLowerCase().includes(q) ||
      (item.ayat || "").toLowerCase().includes(q) ||
      (item.profil || "").toLowerCase().includes(q) ||
      (item.karakter || "").toLowerCase().includes(q) ||
      (item.units?.name || "").toLowerCase().includes(q)
    );
  });

  const activeFilterCount = [filterTA, filterSemester, filterBulan, filterUnit].filter(
    Boolean
  ).length;

  const clearFilters = () => {
    setFilterTA("");
    setFilterSemester("");
    setFilterBulan("");
    setFilterUnit("");
  };

  // Form handlers
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (row: TemaBulanan) => {
    setEditingId(row.id);
    setForm({
      tahun_ajaran: row.tahun_ajaran || "",
      semester: String(row.semester || ""),
      bulan: String(row.bulan || ""),
      unit_id: row.unit_id || "",
      tema: row.tema || "",
      ayat: row.ayat || "",
      profil: row.profil || "",
      karakter: row.karakter || "",
      bestra: row.bestra || "",
      hbe: row.hbe || "",
      hm: row.hm || "",
      catatan_tema: row.catatan_tema || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.tahun_ajaran || !form.semester || !form.bulan || !form.unit_id) {
      addToast("warning", "Tahun ajaran, semester, bulan, dan unit wajib diisi");
      return;
    }

    setSaving(true);
    const tahun = Number(form.tahun_ajaran.split("-")[0]);
    const payload = {
      tahun_ajaran: form.tahun_ajaran,
      semester: Number(form.semester),
      bulan: Number(form.bulan),
      tahun,
      unit_id: form.unit_id,
      tema: form.tema || null,
      ayat: form.ayat || null,
      profil: form.profil || null,
      karakter: form.karakter || null,
      bestra: form.bestra || null,
      hbe: form.hbe || null,
      hm: form.hm || null,
      catatan_tema: form.catatan_tema || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("tema_bulanan")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        addToast("error", "Gagal menyimpan perubahan");
      } else {
        addToast("success", "Tema bulanan berhasil diperbarui");
        setShowForm(false);
        fetchData();
      }
    } else {
      const tema_id = `TM-${Date.now()}`;
      const { error } = await supabase
        .from("tema_bulanan")
        .insert({ ...payload, tema_id });
      if (error) {
        addToast("error", "Gagal menambah tema bulanan");
      } else {
        addToast("success", "Tema bulanan berhasil ditambahkan");
        setShowForm(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("tema_bulanan")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      addToast("error", "Gagal menghapus tema bulanan");
    } else {
      addToast("success", "Tema bulanan berhasil dihapus");
      fetchData();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const columns = [
    {
      key: "bulan",
      header: "Bulan",
      width: "100px",
      render: (row: TemaBulanan) => (
        <span className="text-sm font-medium text-gray-900">
          {getMonthName(row.bulan)}
        </span>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "100px",
      render: (row: TemaBulanan & { units?: Unit }) => (
        <UnitBadge unitName={row.units?.name || "Unknown"} />
      ),
    },
    {
      key: "tema",
      header: "Tema",
      render: (row: TemaBulanan) => (
        <span className="text-sm text-gray-900">{row.tema || "-"}</span>
      ),
    },
    {
      key: "ayat",
      header: "Ayat",
      width: "160px",
      render: (row: TemaBulanan) => (
        <span className="text-xs text-gray-600 line-clamp-2">
          {row.ayat || "-"}
        </span>
      ),
    },
    {
      key: "profil",
      header: "Profil",
      width: "140px",
      render: (row: TemaBulanan) => (
        <span className="text-xs text-gray-600 line-clamp-2">
          {row.profil || "-"}
        </span>
      ),
    },
    {
      key: "karakter",
      header: "Karakter",
      width: "140px",
      render: (row: TemaBulanan) => (
        <span className="text-xs text-gray-600 line-clamp-2">
          {row.karakter || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (row: TemaBulanan) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (row: TemaBulanan) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Hapus"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tema Bulanan"
        description="Kelola tema bulanan per unit"
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Tambah Tema
          </button>
        }
      />

      {/* Filters */}
      <div className="space-y-3">
        <FilterBar activeCount={activeFilterCount} onClearAll={clearFilters}>
          <FilterSelect
            value={filterTA}
            onChange={setFilterTA}
            options={TAHUN_AJARAN_OPTIONS}
            placeholder="Tahun Ajaran"
          />
          <FilterSelect
            value={filterSemester}
            onChange={setFilterSemester}
            options={SEMESTER_OPTIONS}
            placeholder="Semester"
          />
          <FilterSelect
            value={filterBulan}
            onChange={setFilterBulan}
            options={BULAN_OPTIONS}
            placeholder="Bulan"
          />
          <FilterSelect
            value={filterUnit}
            onChange={setFilterUnit}
            options={unitOptions}
            placeholder="Unit"
          />
        </FilterBar>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari tema, ayat, profil..."
        />
      </div>

      {/* Table */}
      {filteredData.length === 0 && !loading ? (
        <EmptyState
          icon={<BookOpen size={48} />}
          title="Belum ada tema bulanan"
          description="Tambah tema bulanan baru atau ubah filter untuk melihat data."
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Tambah Tema
            </button>
          }
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

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Tema Bulanan" : "Tambah Tema Bulanan"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tahun Ajaran"
              value={form.tahun_ajaran}
              onChange={(e) =>
                setForm((f) => ({ ...f, tahun_ajaran: e.target.value }))
              }
              options={TAHUN_AJARAN_OPTIONS}
              placeholder="Pilih tahun ajaran"
            />
            <Select
              label="Semester"
              value={form.semester}
              onChange={(e) =>
                setForm((f) => ({ ...f, semester: e.target.value }))
              }
              options={SEMESTER_OPTIONS}
              placeholder="Pilih semester"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Bulan"
              value={form.bulan}
              onChange={(e) =>
                setForm((f) => ({ ...f, bulan: e.target.value }))
              }
              options={BULAN_OPTIONS}
              placeholder="Pilih bulan"
            />
            <Select
              label="Unit"
              value={form.unit_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, unit_id: e.target.value }))
              }
              options={unitOptions}
              placeholder="Pilih unit"
            />
          </div>
          <Input
            label="Tema"
            value={form.tema}
            onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
            placeholder="Masukkan tema bulanan"
          />
          <Input
            label="Ayat"
            value={form.ayat}
            onChange={(e) => setForm((f) => ({ ...f, ayat: e.target.value }))}
            placeholder="Masukkan ayat"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Profil Pelajar"
              value={form.profil}
              onChange={(e) =>
                setForm((f) => ({ ...f, profil: e.target.value }))
              }
              placeholder="Profil pelajar Pancasila"
            />
            <Input
              label="Karakter"
              value={form.karakter}
              onChange={(e) =>
                setForm((f) => ({ ...f, karakter: e.target.value }))
              }
              placeholder="Karakter"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="BESTRA"
              value={form.bestra}
              onChange={(e) =>
                setForm((f) => ({ ...f, bestra: e.target.value }))
              }
              placeholder="BESTRA"
            />
            <Input
              label="HBE"
              value={form.hbe}
              onChange={(e) =>
                setForm((f) => ({ ...f, hbe: e.target.value }))
              }
              placeholder="HBE"
            />
            <Input
              label="HM"
              value={form.hm}
              onChange={(e) =>
                setForm((f) => ({ ...f, hm: e.target.value }))
              }
              placeholder="HM"
            />
          </div>
          <Textarea
            label="Catatan Tema"
            value={form.catatan_tema}
            onChange={(e) =>
              setForm((f) => ({ ...f, catatan_tema: e.target.value }))
            }
            placeholder="Catatan tambahan..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Tema Bulanan"
        message={`Yakin ingin menghapus tema "${deleteTarget?.tema || ""}" untuk bulan ${deleteTarget ? getMonthName(deleteTarget.bulan) : ""}? Data yang dihapus tidak dapat dikembalikan.`}
        confirmText="Hapus"
        loading={deleting}
      />
    </div>
  );
}
