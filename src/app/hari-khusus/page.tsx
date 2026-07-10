"use client";

import { useState, useEffect, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { SearchBar, FilterBar, FilterSelect, PageHeader, EmptyState } from '@/components/ui/filter-bar';
import { Input, Select, Textarea } from '@/components/ui/form-controls';
import { useToast } from '@/components/ui/toast';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/date';
import { Star, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const JENIS_OPTIONS = [
  { value: 'Kristen', label: 'Kristen' },
  { value: 'Nasional', label: 'Nasional' },
  { value: 'Sekolah', label: 'Sekolah' },
];

const JENIS_BADGE_COLORS: Record<string, string> = {
  Kristen: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Nasional: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Sekolah: 'bg-blue-100 text-blue-700 border-blue-200',
};

interface HariKhususRow extends Record<string, unknown> {
  id: string;
  hari_id: string;
  tanggal: string;
  nama_hari: string;
  jenis: string;
  keterangan: string | null;
  masuk_pokok_doa: boolean;
}

interface HariKhususForm {
  tanggal: string;
  nama_hari: string;
  jenis: string;
  keterangan: string;
  masuk_pokok_doa: boolean;
}

const EMPTY_FORM: HariKhususForm = {
  tanggal: '',
  nama_hari: '',
  jenis: '',
  keterangan: '',
  masuk_pokok_doa: false,
};

export default function HariKhususPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<HariKhususRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HariKhususRow | null>(null);
  const [form, setForm] = useState<HariKhususForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<HariKhususRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('hari_khusus')
        .select('*')
        .order('tanggal');
      if (error) throw error;
      setData((rows || []) as unknown as HariKhususRow[]);
    } catch {
      addToast('error', 'Gagal memuat data hari khusus');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = data.filter((row) => {
    if (filterJenis && row.jenis !== filterJenis) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        row.nama_hari.toLowerCase().includes(q) ||
        (row.keterangan || '').toLowerCase().includes(q) ||
        row.jenis.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeFilterCount = [filterJenis].filter(Boolean).length;

  const clearFilters = () => {
    setFilterJenis('');
    setSearch('');
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (row: HariKhususRow) => {
    setEditing(row);
    setForm({
      tanggal: row.tanggal || '',
      nama_hari: row.nama_hari || '',
      jenis: row.jenis || '',
      keterangan: row.keterangan || '',
      masuk_pokok_doa: row.masuk_pokok_doa ?? false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nama_hari.trim()) {
      addToast('error', 'Nama hari wajib diisi');
      return;
    }
    if (!form.tanggal) {
      addToast('error', 'Tanggal wajib diisi');
      return;
    }
    if (!form.jenis) {
      addToast('error', 'Jenis wajib dipilih');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tanggal: form.tanggal,
        nama_hari: form.nama_hari.trim(),
        jenis: form.jenis,
        keterangan: form.keterangan.trim() || null,
        masuk_pokok_doa: form.masuk_pokok_doa,
      };

      if (editing) {
        const { error } = await supabase
          .from('hari_khusus')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        addToast('success', 'Hari khusus berhasil diperbarui');
      } else {
        const { error } = await supabase.from('hari_khusus').insert({
          ...payload,
          hari_id: `HK-${Date.now()}`,
        });
        if (error) throw error;
        addToast('success', 'Hari khusus baru berhasil ditambahkan');
      }
      setShowModal(false);
      fetchData();
    } catch {
      addToast('error', 'Gagal menyimpan data hari khusus');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('hari_khusus')
        .delete()
        .eq('id', deleting.id);
      if (error) throw error;
      addToast('success', `"${deleting.nama_hari}" berhasil dihapus`);
      setDeleting(null);
      fetchData();
    } catch {
      addToast('error', 'Gagal menghapus hari khusus');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'tanggal',
      header: 'Tanggal',
      render: (row: HariKhususRow) =>
        row.tanggal ? (
          <span className="text-sm text-gray-700">
            {formatDate(row.tanggal, 'dd/MM/yyyy')}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'nama_hari',
      header: 'Nama Hari',
      render: (row: HariKhususRow) => (
        <span className="font-medium text-gray-900">{row.nama_hari}</span>
      ),
    },
    {
      key: 'jenis',
      header: 'Jenis',
      render: (row: HariKhususRow) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${
            JENIS_BADGE_COLORS[row.jenis] || 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {row.jenis}
        </span>
      ),
    },
    {
      key: 'keterangan',
      header: 'Keterangan',
      render: (row: HariKhususRow) =>
        row.keterangan || <span className="text-gray-400">-</span>,
    },
    {
      key: 'masuk_pokok_doa',
      header: 'Masuk Pokok Doa',
      align: 'center' as const,
      width: '140px',
      render: (row: HariKhususRow) =>
        row.masuk_pokok_doa ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600">
            <Check size={14} />
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400">
            <X size={14} />
          </span>
        ),
    },
    {
      key: 'aksi',
      header: 'Aksi',
      width: '100px',
      align: 'center' as const,
      render: (row: HariKhususRow) => (
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
        title="Hari Khusus"
        description="Kelola hari raya Kristen, hari nasional, dan hari khusus sekolah"
        action={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Tambah Hari Khusus
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari nama hari atau keterangan..."
          className="sm:w-72"
        />
        <FilterBar activeCount={activeFilterCount} onClearAll={clearFilters}>
          <FilterSelect
            value={filterJenis}
            onChange={setFilterJenis}
            placeholder="Semua Jenis"
            options={JENIS_OPTIONS}
          />
        </FilterBar>
      </div>

      {filteredData.length === 0 && !loading ? (
        <EmptyState
          icon={<Star size={48} />}
          title="Belum ada hari khusus"
          description="Tambahkan hari raya Kristen, hari nasional, atau hari khusus sekolah"
          action={
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              <Plus size={16} />
              Tambah Hari Khusus
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
        title={editing ? 'Edit Hari Khusus' : 'Tambah Hari Khusus'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tanggal *"
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
            />
            <Select
              label="Jenis *"
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value })}
              options={JENIS_OPTIONS}
              placeholder="Pilih jenis"
            />
          </div>
          <Input
            label="Nama Hari *"
            value={form.nama_hari}
            onChange={(e) => setForm({ ...form, nama_hari: e.target.value })}
            placeholder="Contoh: Natal, Kemerdekaan RI, Hari Jadi Sekolah"
          />
          <Textarea
            label="Keterangan"
            value={form.keterangan}
            onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            placeholder="Keterangan tambahan..."
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, masuk_pokok_doa: !form.masuk_pokok_doa })
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.masuk_pokok_doa ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  form.masuk_pokok_doa ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
            <label className="text-sm font-medium text-gray-700">
              Masuk Pokok Doa
            </label>
          </div>
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
                  : 'Tambah Hari Khusus'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Hapus Hari Khusus"
        message={`Yakin ingin menghapus "${deleting?.nama_hari}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
