"use client";

import { useState, useEffect, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { UnitBadge } from '@/components/ui/unit-badge';
import { SearchBar, FilterBar, FilterSelect, PageHeader, EmptyState } from '@/components/ui/filter-bar';
import { Input, Select, Textarea } from '@/components/ui/form-controls';
import { useToast } from '@/components/ui/toast';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/date';
import { Users, Plus, Cake, Pencil, Trash2 } from 'lucide-react';

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface Unit {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface KaryawanRow extends Record<string, unknown> {
  id: string;
  karyawan_id: string;
  nama: string;
  unit_id: string | null;
  jabatan: string | null;
  tanggal_lahir: string | null;
  bulan_lahir: number | null;
  tanggal_masuk: string | null;
  status: string;
  catatan: string | null;
  unit: Unit | null;
}

interface KaryawanForm {
  nama: string;
  unit_id: string;
  jabatan: string;
  tanggal_lahir: string;
  tanggal_masuk: string;
  status: string;
  catatan: string;
}

const EMPTY_FORM: KaryawanForm = {
  nama: '',
  unit_id: '',
  jabatan: '',
  tanggal_lahir: '',
  tanggal_masuk: '',
  status: 'Aktif',
  catatan: '',
};

export default function KaryawanPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<KaryawanRow[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<KaryawanRow | null>(null);
  const [form, setForm] = useState<KaryawanForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<KaryawanRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [karyawanRes, unitsRes] = await Promise.all([
        supabase
          .from('karyawan')
          .select('*, unit:units(id, code, name, color)')
          .order('nama'),
        supabase
          .from('units')
          .select('id, code, name, color')
          .eq('is_active', true)
          .order('name'),
      ]);
      if (karyawanRes.error) throw karyawanRes.error;
      if (unitsRes.error) throw unitsRes.error;
      setData((karyawanRes.data || []) as unknown as KaryawanRow[]);
      setUnits((unitsRes.data || []) as Unit[]);
    } catch {
      addToast('error', 'Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = data.filter((row) => {
    if (filterUnit && row.unit_id !== filterUnit) return false;
    if (filterStatus && row.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        row.nama.toLowerCase().includes(q) ||
        (row.jabatan || '').toLowerCase().includes(q) ||
        (row.unit?.name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeFilterCount = [filterUnit, filterStatus].filter(Boolean).length;

  const clearFilters = () => {
    setFilterUnit('');
    setFilterStatus('');
    setSearch('');
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (row: KaryawanRow) => {
    setEditing(row);
    setForm({
      nama: row.nama,
      unit_id: row.unit_id || '',
      jabatan: row.jabatan || '',
      tanggal_lahir: row.tanggal_lahir || '',
      tanggal_masuk: row.tanggal_masuk || '',
      status: row.status || 'Aktif',
      catatan: row.catatan || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) {
      addToast('error', 'Nama karyawan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const tanggal_lahir = form.tanggal_lahir || null;
      const bulan_lahir = tanggal_lahir
        ? new Date(tanggal_lahir + 'T00:00:00').getMonth() + 1
        : null;
      const payload = {
        nama: form.nama.trim(),
        unit_id: form.unit_id || null,
        jabatan: form.jabatan.trim() || null,
        tanggal_lahir,
        bulan_lahir,
        tanggal_masuk: form.tanggal_masuk || null,
        status: form.status,
        catatan: form.catatan.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from('karyawan')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        addToast('success', 'Data karyawan berhasil diperbarui');
      } else {
        const { error } = await supabase.from('karyawan').insert({
          ...payload,
          karyawan_id: `KRY-${Date.now()}`,
        });
        if (error) throw error;
        addToast('success', 'Karyawan baru berhasil ditambahkan');
      }
      setShowModal(false);
      fetchData();
    } catch {
      addToast('error', 'Gagal menyimpan data karyawan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('karyawan')
        .delete()
        .eq('id', deleting.id);
      if (error) throw error;
      addToast('success', `Karyawan "${deleting.nama}" berhasil dihapus`);
      setDeleting(null);
      fetchData();
    } catch {
      addToast('error', 'Gagal menghapus karyawan');
    } finally {
      setDeleteLoading(false);
    }
  };

  const currentMonth = new Date().getMonth() + 1;

  const columns = [
    {
      key: 'nama',
      header: 'Nama',
      render: (row: KaryawanRow) => (
        <div className="flex items-center gap-2">
          {row.bulan_lahir === currentMonth && (
            <span title="Ulang tahun bulan ini">
              <Cake size={16} className="text-pink-500" />
            </span>
          )}
          <span className="font-medium text-gray-900">{row.nama}</span>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (row: KaryawanRow) =>
        row.unit ? (
          <UnitBadge unitName={row.unit.name} />
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'jabatan',
      header: 'Jabatan',
      render: (row: KaryawanRow) =>
        row.jabatan || <span className="text-gray-400">-</span>,
    },
    {
      key: 'tanggal_lahir',
      header: 'Tgl Lahir',
      render: (row: KaryawanRow) =>
        row.tanggal_lahir ? (
          formatDate(row.tanggal_lahir, 'dd/MM/yyyy')
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'bulan_lahir',
      header: 'Bulan Lahir',
      render: (row: KaryawanRow) =>
        row.bulan_lahir ? (
          BULAN_NAMES[row.bulan_lahir]
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'tanggal_masuk',
      header: 'Tgl Masuk',
      render: (row: KaryawanRow) =>
        row.tanggal_masuk ? (
          formatDate(row.tanggal_masuk, 'dd/MM/yyyy')
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: KaryawanRow) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${
            row.status === 'Aktif'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'aksi',
      header: 'Aksi',
      width: '100px',
      align: 'center' as const,
      render: (row: KaryawanRow) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(row);
            }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
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
        title="Karyawan"
        description="Kelola data karyawan"
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Tambah Karyawan
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari nama, jabatan, atau unit..."
          className="sm:w-72"
        />
        <FilterBar activeCount={activeFilterCount} onClearAll={clearFilters}>
          <FilterSelect
            value={filterUnit}
            onChange={setFilterUnit}
            placeholder="Semua Unit"
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
          <FilterSelect
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="Semua Status"
            options={[
              { value: 'Aktif', label: 'Aktif' },
              { value: 'Nonaktif', label: 'Nonaktif' },
            ]}
          />
        </FilterBar>
      </div>

      {filteredData.length === 0 && !loading ? (
        <EmptyState
          icon={<Users size={48} />}
          title="Belum ada data karyawan"
          description="Tambahkan karyawan baru atau import dari spreadsheet"
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              <Plus size={16} />
              Tambah Karyawan
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          emptyMessage="Tidak ada data ditemukan"
          compact
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Karyawan' : 'Tambah Karyawan'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nama *"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="Nama lengkap karyawan"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Unit"
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Pilih unit"
            />
            <Input
              label="Jabatan"
              value={form.jabatan}
              onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
              placeholder="Jabatan"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal Lahir"
              type="date"
              value={form.tanggal_lahir}
              onChange={(e) =>
                setForm({ ...form, tanggal_lahir: e.target.value })
              }
            />
            <Input
              label="Tanggal Masuk"
              type="date"
              value={form.tanggal_masuk}
              onChange={(e) =>
                setForm({ ...form, tanggal_masuk: e.target.value })
              }
            />
          </div>
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'Aktif', label: 'Aktif' },
              { value: 'Nonaktif', label: 'Nonaktif' },
            ]}
          />
          <Textarea
            label="Catatan"
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan tambahan..."
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving
                ? 'Menyimpan...'
                : editing
                  ? 'Simpan Perubahan'
                  : 'Tambah Karyawan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Hapus Karyawan"
        message={`Yakin ingin menghapus karyawan "${deleting?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
