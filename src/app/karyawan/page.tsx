"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { UnitBadge } from '@/components/ui/unit-badge';
import { SearchBar, FilterBar, FilterSelect, PageHeader, EmptyState } from '@/components/ui/filter-bar';
import { Input, Select, Textarea } from '@/components/ui/form-controls';
import { useToast } from '@/components/ui/toast';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/date';
import { Users, Plus, Cake, Pencil, Trash2, Upload, Copy, CheckSquare } from 'lucide-react';

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) };
}

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; error: number } | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditField, setBulkEditField] = useState('unit_id');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const handleDuplicate = async (row: KaryawanRow) => {
    try {
      const { error } = await supabase.from('karyawan').insert({
        karyawan_id: `KRY-${Date.now()}`,
        nama: `${row.nama} (Copy)`,
        unit_id: row.unit_id,
        jabatan: row.jabatan,
        tanggal_lahir: row.tanggal_lahir,
        bulan_lahir: row.bulan_lahir,
        tanggal_masuk: row.tanggal_masuk,
        status: row.status,
        catatan: row.catatan,
      });
      if (error) throw error;
      addToast('success', `Karyawan "${row.nama}" berhasil diduplikasi`);
      fetchData();
    } catch {
      addToast('error', 'Gagal menduplikasi karyawan');
    }
  };

  const FIELD_MAP: Record<string, string> = {
    'nama': 'nama', 'name': 'nama',
    'unit': 'unit_id', 'unit_id': 'unit_id',
    'jabatan': 'jabatan', 'position': 'jabatan',
    'tanggal_lahir': 'tanggal_lahir', 'tgl lahir': 'tanggal_lahir', 'tanggal lahir': 'tanggal_lahir',
    'tanggal_masuk': 'tanggal_masuk', 'tgl masuk': 'tanggal_masuk', 'tanggal masuk': 'tanggal_masuk',
    'status': 'status',
    'catatan': 'catatan', 'notes': 'catatan',
  };

  const openImportModal = () => {
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setHeaderMapping({});
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleCsvParse = (text: string) => {
    setCsvText(text);
    if (!text.trim()) {
      setCsvHeaders([]);
      setCsvRows([]);
      setHeaderMapping({});
      return;
    }
    const { headers, rows } = parseCSV(text);
    setCsvHeaders(headers);
    setCsvRows(rows);
    // Auto-detect mapping
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      if (FIELD_MAP[lower]) mapping[h] = FIELD_MAP[lower];
    });
    setHeaderMapping(mapping);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleCsvParse(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (csvRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let errorCount = 0;
    const unitNameMap = new Map(units.map(u => [u.name.toLowerCase(), u.id]));

    for (const row of csvRows) {
      try {
        const payload: Record<string, unknown> = { karyawan_id: `KRY-${Date.now()}-${success}` };
        csvHeaders.forEach((header, idx) => {
          const field = headerMapping[header];
          if (!field || idx >= row.length) return;
          const val = row[idx];
          if (field === 'unit_id') {
            payload.unit_id = unitNameMap.get(val.toLowerCase()) || null;
          } else {
            payload[field] = val || null;
          }
        });
        if (!payload.nama) { errorCount++; continue; }
        if (!payload.status) payload.status = 'Aktif';
        if (payload.tanggal_lahir) {
          payload.bulan_lahir = new Date(payload.tanggal_lahir + 'T00:00:00').getMonth() + 1;
        }
        const { error } = await supabase.from('karyawan').insert(payload);
        if (error) throw error;
        success++;
      } catch {
        errorCount++;
      }
    }
    setImportResult({ success, error: errorCount });
    setImporting(false);
    if (success > 0) fetchData();
  };

  const handleBulkEdit = async () => {
    if (selectedIds.length === 0) return;
    setBulkEditLoading(true);
    try {
      const updatePayload: Record<string, unknown> = {};
      if (bulkEditField === 'unit_id') {
        updatePayload.unit_id = bulkEditValue || null;
      } else if (bulkEditField === 'status') {
        updatePayload.status = bulkEditValue;
      } else {
        updatePayload[bulkEditField] = bulkEditValue.trim() || null;
      }
      const { error } = await supabase
        .from('karyawan')
        .update(updatePayload)
        .in('id', selectedIds);
      if (error) throw error;
      addToast('success', `${selectedIds.length} karyawan berhasil diperbarui`);
      setShowBulkEditModal(false);
      setSelectedIds([]);
      fetchData();
    } catch {
      addToast('error', 'Gagal memperbarui data karyawan');
    } finally {
      setBulkEditLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from('karyawan')
        .delete()
        .in('id', selectedIds);
      if (error) throw error;
      addToast('success', `${selectedIds.length} karyawan berhasil dihapus`);
      setSelectedIds([]);
      fetchData();
    } catch {
      addToast('error', 'Gagal menghapus karyawan');
    } finally {
      setBulkDeleting(false);
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
              handleDuplicate(row);
            }}
            className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
            title="Duplikasi"
          >
            <Copy size={15} />
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
          <div className="flex items-center gap-2">
            <button
              onClick={openImportModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Upload size={16} />
              Import CSV
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Tambah Karyawan
            </button>
          </div>
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
        <>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
              <span className="text-sm font-medium text-indigo-700">
                {selectedIds.length} karyawan dipilih
              </span>
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <CheckSquare size={14} />
                Bulk Edit
              </button>
              <button
                onClick={() => setBulkDeleting(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Hapus Terpilih
              </button>
            </div>
          )}
          <DataTable
            columns={columns}
            data={filteredData}
            loading={loading}
            emptyMessage="Tidak ada data ditemukan"
            compact
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </>
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

      {/* CSV Import Modal */}
      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import CSV"
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tempel konten CSV atau upload file
            </label>
            <textarea
              value={csvText}
              onChange={(e) => handleCsvParse(e.target.value)}
              placeholder="Tempel data CSV di sini..."
              className="w-full h-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
            <div className="mt-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
                <Upload size={14} />
                Upload File .csv
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {csvHeaders.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Mapping Kolom</h4>
                <div className="grid grid-cols-2 gap-2">
                  {csvHeaders.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-24 truncate" title={h}>{h}</span>
                      <span className="text-gray-400">→</span>
                      <select
                        value={headerMapping[h] || ''}
                        onChange={(e) => setHeaderMapping({ ...headerMapping, [h]: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md"
                      >
                        <option value="">-- Abaikan --</option>
                        <option value="nama">Nama</option>
                        <option value="unit_id">Unit</option>
                        <option value="jabatan">Jabatan</option>
                        <option value="tanggal_lahir">Tanggal Lahir</option>
                        <option value="tanggal_masuk">Tanggal Masuk</option>
                        <option value="status">Status</option>
                        <option value="catatan">Catatan</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Preview ({csvRows.length} baris)
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {csvHeaders.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500">
                            {h}
                            {headerMapping[h] && (
                              <span className="text-indigo-500 ml-1">→ {headerMapping[h]}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {csvRows.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 text-gray-600 max-w-[120px] truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {csvRows.length > 10 && (
                        <tr>
                          <td colSpan={csvHeaders.length} className="px-2 py-1 text-center text-gray-400">
                            ... dan {csvRows.length - 10} baris lainnya
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {importResult && (
            <div className={`p-3 rounded-lg text-sm ${importResult.error > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              Import selesai: {importResult.success} berhasil, {importResult.error} gagal
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowImportModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Tutup
            </button>
            {csvRows.length > 0 && !importResult && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? 'Mengimpor...' : `Import ${csvRows.length} Baris`}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Bulk Edit Modal */}
      <Modal
        open={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        title={`Bulk Edit (${selectedIds.length} karyawan)`}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Field"
            value={bulkEditField}
            onChange={(e) => { setBulkEditField(e.target.value); setBulkEditValue(''); }}
            options={[
              { value: 'unit_id', label: 'Unit' },
              { value: 'jabatan', label: 'Jabatan' },
              { value: 'status', label: 'Status' },
              { value: 'catatan', label: 'Catatan' },
            ]}
          />
          {bulkEditField === 'unit_id' ? (
            <Select
              label="Nilai"
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              options={units.map(u => ({ value: u.id, label: u.name }))}
              placeholder="Pilih unit"
            />
          ) : bulkEditField === 'status' ? (
            <Select
              label="Nilai"
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              options={[
                { value: 'Aktif', label: 'Aktif' },
                { value: 'Nonaktif', label: 'Nonaktif' },
              ]}
              placeholder="Pilih status"
            />
          ) : (
            <Input
              label="Nilai"
              value={bulkEditValue}
              onChange={(e) => setBulkEditValue(e.target.value)}
              placeholder={`Masukkan ${bulkEditField}`}
            />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowBulkEditModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              onClick={handleBulkEdit}
              disabled={bulkEditLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {bulkEditLoading ? 'Menyimpan...' : `Update ${selectedIds.length} Karyawan`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        open={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        onConfirm={handleBulkDelete}
        title="Hapus Karyawan Terpilih"
        message={`Yakin ingin menghapus ${selectedIds.length} karyawan yang dipilih? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={`Hapus ${selectedIds.length} Karyawan`}
        variant="danger"
      />
    </div>
  );
}
