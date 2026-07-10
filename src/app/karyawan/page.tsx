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
import { Users, Plus, Cake, Pencil, Trash2, Upload, Copy, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as any).message);
  }
  return String(err);
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Remove BOM and normalize line endings
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
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

function parseImportDate(text: string): string | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/\u00A0/g, ' ');
  if (!cleaned) return null;
  // YYYY-MM-DD (with optional time part)
  const matchISO = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchISO) {
    const [, y, m, d] = matchISO;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const matchDMY = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchDMY) {
    const [, d, m, y] = matchDMY;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
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
  const [importResult, setImportResult] = useState<{ success: number; rejected: number; rejectedReasons: string[] } | null>(null);
  const [rowValidationErrors, setRowValidationErrors] = useState<(string | null)[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditField, setBulkEditField] = useState('unit_id');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [birthdayExpanded, setBirthdayExpanded] = useState(true);

  // Re-validate rows when headerMapping changes (e.g. user changes dropdown)
  useEffect(() => {
    if (csvRows.length === 0 || csvHeaders.length === 0) return;
    if (Object.keys(headerMapping).length === 0) return;

    const errors: (string | null)[] = csvRows.map(row => {
      const fieldValues: Record<string, string> = {};
      csvHeaders.forEach((header, idx) => {
        const field = headerMapping[header];
        if (field && idx < row.length) {
          fieldValues[field] = row[idx]?.trim() || '';
        }
      });
      const issues: string[] = [];
      if (!fieldValues['karyawan_id']) issues.push('ID Karyawan kosong');
      if (!fieldValues['nama']) issues.push('Nama kosong');
      if (!fieldValues['tanggal_lahir']) {
        issues.push('Tanggal lahir kosong');
      } else if (!parseImportDate(fieldValues['tanggal_lahir'])) {
        issues.push('Tanggal lahir tidak valid');
      }
      return issues.length > 0 ? issues.join(', ') : null;
    });
    setRowValidationErrors(errors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerMapping]);

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

  const birthdayKaryawan = data
    .filter((row) => {
      if (!row.bulan_lahir) return false;
      return row.bulan_lahir === selectedMonth;
    })
    .sort((a, b) => {
      const dayA = a.tanggal_lahir ? new Date(a.tanggal_lahir + 'T00:00:00').getDate() : 0;
      const dayB = b.tanggal_lahir ? new Date(b.tanggal_lahir + 'T00:00:00').getDate() : 0;
      return dayA - dayB;
    });

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

  const KARYAWAN_IMPORT_MAP: Record<string, string> = {
    'id karyawan': 'karyawan_id',
    'id': 'karyawan_id',
    'karyawan_id': 'karyawan_id',
    'karyawan id': 'karyawan_id',
    'karyawanid': 'karyawan_id',
    'karyawan-id': 'karyawan_id',
    'nama lengkap': 'nama',
    'nama': 'nama',
    'name': 'nama',
    'full name': 'nama',
    'fullname': 'nama',
    'namalengkap': 'nama',
    'nama-lengkap': 'nama',
    'nama_panggilan': 'nama_panggilan',
    'nama panggilan': 'nama_panggilan',
    'namapanggilan': 'nama_panggilan',
    'nama-panggilan': 'nama_panggilan',
    'panggilan': 'nama_panggilan',
    'nickname': 'nama_panggilan',
    'tanggal_lahir': 'tanggal_lahir',
    'tanggal lahir': 'tanggal_lahir',
    'tanggallahir': 'tanggal_lahir',
    'tanggal-lahir': 'tanggal_lahir',
    'tgl_lahir': 'tanggal_lahir',
    'tgl lahir': 'tanggal_lahir',
    'tgllahir': 'tanggal_lahir',
    'tgl-lahir': 'tanggal_lahir',
    'date of birth': 'tanggal_lahir',
    'dateofbirth': 'tanggal_lahir',
    'dob': 'tanggal_lahir',
    'lahir': 'tanggal_lahir',
    'birth date': 'tanggal_lahir',
    'birthdate': 'tanggal_lahir',
  };

  const openImportModal = () => {
    setCsvText('');
    setCsvHeaders([]);
    setCsvRows([]);
    setHeaderMapping({});
    setImportResult(null);
    setRowValidationErrors([]);
    setShowImportModal(true);
  };

  const handleCsvParse = (text: string) => {
    setCsvText(text);
    setImportResult(null);
    if (!text.trim()) {
      setCsvHeaders([]);
      setCsvRows([]);
      setHeaderMapping({});
      setRowValidationErrors([]);
      return;
    }
    const { headers, rows } = parseCSV(text);
    setCsvHeaders(headers);
    setCsvRows(rows);
    // Auto-detect mapping using strict KARYAWAN_IMPORT_MAP
    // Normalize headers: lowercase, trim, replace non-breaking spaces, split camelCase
    const normalizeHeader = (h: string) => {
      return h
        .trim()
        .replace(/\u00A0/g, ' ')
        // Split camelCase/PascalCase: "KaryawanID" → "Karyawan ID"
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[\s\-_]+/g, ' ')
        .trim();
    };
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const normalized = normalizeHeader(h);
      // Try exact match first, then try with spaces replaced
      if (KARYAWAN_IMPORT_MAP[normalized]) {
        mapping[h] = KARYAWAN_IMPORT_MAP[normalized];
      } else {
        // Try without spaces: "karyawan id" → "karyawanid"
        const noSpace = normalized.replace(/\s/g, '');
        if (KARYAWAN_IMPORT_MAP[noSpace]) {
          mapping[h] = KARYAWAN_IMPORT_MAP[noSpace];
        }
      }
    });
    setHeaderMapping(mapping);

    // Validate each row
    const errors: (string | null)[] = rows.map(row => {
      const fieldValues: Record<string, string> = {};
      headers.forEach((header, idx) => {
        const field = mapping[header];
        if (field && idx < row.length) {
          fieldValues[field] = row[idx]?.trim() || '';
        }
      });
      const issues: string[] = [];
      if (!fieldValues['karyawan_id']) issues.push('ID Karyawan kosong');
      if (!fieldValues['nama']) issues.push('Nama kosong');
      if (!fieldValues['tanggal_lahir']) {
        issues.push('Tanggal lahir kosong');
      } else if (!parseImportDate(fieldValues['tanggal_lahir'])) {
        issues.push('Tanggal lahir tidak valid');
      }
      return issues.length > 0 ? issues.join(', ') : null;
    });
    setRowValidationErrors(errors);
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
    let rejected = 0;
    const rejectedReasons: string[] = [];

    for (let i = 0; i < csvRows.length; i++) {
      // Skip rows that failed validation
      if (rowValidationErrors[i]) {
        rejected++;
        rejectedReasons.push(`Baris ${i + 2}: ${rowValidationErrors[i]}`);
        continue;
      }

      const row = csvRows[i];
      try {
        const fieldValues: Record<string, string> = {};
        csvHeaders.forEach((header, idx) => {
          const field = headerMapping[header];
          if (field && idx < row.length) {
            fieldValues[field] = row[idx]?.trim() || '';
          }
        });

        const tanggal_lahir = parseImportDate(fieldValues['tanggal_lahir']);

        // Base payload - do NOT include bulan_lahir (GENERATED ALWAYS AS column)
        const basePayload: Record<string, unknown> = {
          karyawan_id: fieldValues['karyawan_id'] || `KRY-${Date.now()}-${success}`,
          nama: fieldValues['nama'],
          tanggal_lahir,
          status: 'Aktif',
        };

        // Try insert with full payload first, fallback to base if columns missing
        let insertError: { message: string } | null = null;
        try {
          const fullPayload = {
            ...basePayload,
            nama_panggilan: fieldValues['nama_panggilan'] || null,
            sumber_data: 'Import',
          };
          const { error } = await supabase.from('karyawan').insert(fullPayload);
          if (error) throw error;
        } catch (fullErr: unknown) {
          const errMsg = getErrorMessage(fullErr);
          // If error is about missing column, retry with base payload
          if (errMsg.includes('column') || errMsg.includes('schema') || errMsg.includes('Could not find')) {
            const { error: baseErr } = await supabase.from('karyawan').insert(basePayload);
            if (baseErr) {
              insertError = baseErr;
            }
          } else {
            insertError = { message: errMsg };
          }
        }

        if (insertError) throw insertError;
        success++;
      } catch (err: unknown) {
        rejected++;
        const errMsg = getErrorMessage(err);
        rejectedReasons.push(`Baris ${i + 2}: ${errMsg || 'Gagal menyimpan ke database'}`);
      }
    }
    setImportResult({ success, rejected, rejectedReasons });
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

  const mobileColumns = [
    {
      key: 'karyawan_id',
      header: 'ID',
      className: 'hidden sm:table-cell',
      render: (row: KaryawanRow) => (
        <span className="text-xs text-gray-500 font-mono">{row.karyawan_id}</span>
      ),
    },
    ...columns
      .filter((c) => c.key !== 'bulan_lahir')
      .map((c) => ({
        ...c,
        className:
          c.key === 'unit' || c.key === 'jabatan' || c.key === 'tanggal_masuk' || c.key === 'status'
            ? 'hidden sm:table-cell'
            : undefined,
      })),
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

      {/* Month Filter Header - Always visible */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Cake size={18} className="text-pink-500" />
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Bulan Lahir:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {BULAN_NAMES.slice(1).map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>
        </div>
        {birthdayKaryawan.length > 0 && (
          <span className="text-sm text-pink-600 font-medium">
            {birthdayKaryawan.length} karyawan berulang tahun di bulan {BULAN_NAMES[selectedMonth]}
          </span>
        )}
      </div>

      {/* Desktop: 3-column layout */}
      <div className="hidden md:grid md:grid-cols-[260px_1fr_300px] gap-6 items-start">
        {/* Left: Filters */}
        <div className="space-y-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, jabatan, atau unit..."
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

        {/* Center: Data Table */}
        <div className="min-w-0">
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
                <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg mb-3">
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
        </div>

        {/* Right: Birthday Panel */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
            <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Cake size={16} className="text-pink-500" />
                Ulang Tahun {BULAN_NAMES[selectedMonth]}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{birthdayKaryawan.length} karyawan</p>
            </div>
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
              {birthdayKaryawan.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  Tidak ada ulang tahun di bulan ini
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {birthdayKaryawan.map((k) => (
                    <div key={k.id} className="px-4 py-3 hover:bg-pink-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center">
                          <Cake size={14} className="text-pink-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{k.nama}</p>
                          <p className="text-xs text-gray-500">
                            {k.tanggal_lahir ? formatDate(k.tanggal_lahir, 'dd MMMM yyyy') : '-'}
                          </p>
                          {k.unit && (
                            <div className="mt-1">
                              <UnitBadge unitName={k.unit.name} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Vertical stack */}
      <div className="md:hidden space-y-4">
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

        {/* Birthday cards on mobile */}
        {birthdayKaryawan.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setBirthdayExpanded(!birthdayExpanded)}
              className="w-full px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-gray-100 flex items-center gap-2"
            >
              <Cake size={16} className="text-pink-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-800">Ulang Tahun {BULAN_NAMES[selectedMonth]}</span>
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-pink-100 text-pink-700">
                {birthdayKaryawan.length}
              </span>
              <span className="ml-auto text-gray-400">
                {birthdayExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>
            {birthdayExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {birthdayKaryawan.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-pink-50/50 border border-pink-100">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                      <Cake size={13} className="text-pink-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{k.nama}</p>
                      <p className="text-xs text-gray-500">
                        {k.tanggal_lahir ? formatDate(k.tanggal_lahir, 'dd MMM') : '-'}
                      </p>
                    </div>
                    {k.unit && (
                      <div className="flex-shrink-0 hidden sm:block">
                        <UnitBadge unitName={k.unit.name} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              columns={mobileColumns}
              data={filteredData}
              loading={loading}
              emptyMessage="Tidak ada data ditemukan"
              compact
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </>
        )}
      </div>

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
        title="Import Data Karyawan"
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">
              Format CSV: ID Karyawan, Nama Lengkap, Nama Panggilan (opsional), Tanggal Lahir (DD/MM/YYYY)
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tempel konten CSV atau upload file
            </label>
            <textarea
              value={csvText}
              onChange={(e) => handleCsvParse(e.target.value)}
              placeholder={`KRY-001,John Doe,John,15/03/1990\nKRY-002,Jane Smith,Jane,22/07/1985`}
              className="w-full h-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono"
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
                        <option value="karyawan_id">ID Karyawan</option>
                        <option value="nama">Nama Lengkap</option>
                        <option value="nama_panggilan">Nama Panggilan</option>
                        <option value="tanggal_lahir">Tanggal Lahir</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Preview ({csvRows.length} baris, {rowValidationErrors.filter(e => !e).length} valid, {rowValidationErrors.filter(e => e).length} ditolak)
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500 w-8">#</th>
                        {csvHeaders.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500">
                            {h}
                            {headerMapping[h] && (
                              <span className="text-indigo-500 ml-1">→ {headerMapping[h]}</span>
                            )}
                          </th>
                        ))}
                        <th className="px-2 py-1.5 text-left font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {csvRows.slice(0, 10).map((row, i) => {
                        const error = rowValidationErrors[i];
                        return (
                          <tr key={i} className={error ? 'bg-red-50' : 'bg-emerald-50'}>
                            <td className="px-2 py-1 text-gray-400">{i + 2}</td>
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 py-1 text-gray-600 max-w-[120px] truncate">
                                {cell}
                              </td>
                            ))}
                            <td className="px-2 py-1">
                              {error ? (
                                <span className="text-red-600 font-medium">{error}</span>
                              ) : (
                                <span className="text-emerald-600 font-medium">Valid</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {csvRows.length > 10 && (
                        <tr>
                          <td colSpan={csvHeaders.length + 2} className="px-2 py-1 text-center text-gray-400">
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
            <div className="space-y-2">
              <div className={`p-3 rounded-lg text-sm ${importResult.rejected > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {importResult.success} baris berhasil diimport, {importResult.rejected} baris ditolak
              </div>
              {importResult.rejectedReasons.length > 0 && (
                <div className="p-3 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200 max-h-32 overflow-y-auto">
                  <p className="font-medium mb-1">Alasan ditolak:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {importResult.rejectedReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
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
                disabled={importing || rowValidationErrors.every(e => e !== null)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? 'Mengimpor...' : `Import ${rowValidationErrors.filter(e => !e).length} Baris Valid`}
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
