'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { Input, Select, Textarea } from '@/components/ui/form-controls';
import { SearchBar, FilterSelect } from '@/components/ui/filter-bar';
import { useToast } from '@/components/ui/toast';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { parseTanggalToISO, extractBulanFromTanggal } from '@/lib/utils/date';
import html2canvas from 'html2canvas-pro';
import {
  Plus, Upload, Camera, Share2, Edit2, Trash2, Copy, ChevronLeft, ChevronRight,
  Loader2, Search, FileSpreadsheet, X, Eye, Calendar, Filter, TableIcon,
  CheckSquare, Download,
} from 'lucide-react';

/* Constants */

const BULAN_OPTIONS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

const IBADAH_HEADER_MAP: Record<string, string> = {
  'bulan': 'bulan', 'bln': 'bulan',
  'tanggal': 'tanggal', 'tgl': 'tanggal', 'tangal': 'tanggal',
  'pelayan ibadah': 'pelayan_ibadah', 'pelayan_ibadah': 'pelayan_ibadah', 'pelayan': 'pelayan_ibadah',
  'pemberita firman': 'pemberita_firman', 'pemberita_firman': 'pemberita_firman', 'pemberita': 'pemberita_firman', 'pengkhotbah': 'pemberita_firman',
  'tema ibadah bulanan': 'tema_ibadah_bulanan', 'tema_ibadah': 'tema_ibadah_bulanan', 'tema': 'tema_ibadah_bulanan',
  'nas alkitab': 'nas_alkitab', 'nas_alkitab': 'nas_alkitab', 'ayat': 'nas_alkitab', 'nas': 'nas_alkitab',
};

const HM_HEADER_MAP: Record<string, string> = {
  'bulan': 'bulan', 'bln': 'bulan',
  'tanggal': 'tanggal', 'tgl': 'tanggal',
  'christian worldview': 'christian_worldview', 'christian_worldview': 'christian_worldview', 'worldview': 'christian_worldview',
  'profil': 'profil', 'bestra': 'bestra', 'karakter': 'karakter',
  'tema bulanan': 'tema_bulanan', 'tema_bulanan': 'tema_bulanan',
  'tema mingguan': 'tema_mingguan', 'tema_mingguan': 'tema_mingguan',
  'nas alkitab': 'nas_alkitab', 'nas_alkitab': 'nas_alkitab', 'ayat': 'nas_alkitab',
  'tujuan': 'tujuan',
  'pelayan holy morning': 'pelayan_holy_morning', 'pelayan_holy_morning': 'pelayan_holy_morning', 'pelayan': 'pelayan_holy_morning',
  'keterangan': 'keterangan', 'ket': 'keterangan', 'keter': 'keterangan',
};

const HM_BULK_EDIT_FIELDS = [
  { value: 'christian_worldview', label: 'Christian Worldview' },
  { value: 'profil', label: 'Profil' },
  { value: 'bestra', label: 'Bestra' },
  { value: 'karakter', label: 'Karakter' },
  { value: 'tema_bulanan', label: 'Tema Bulanan' },
  { value: 'tema_mingguan', label: 'Tema Mingguan' },
  { value: 'nas_alkitab', label: 'Nas Alkitab' },
  { value: 'tujuan', label: 'Tujuan' },
  { value: 'pelayan_holy_morning', label: 'Pelayan Holy Morning' },
  { value: 'keterangan', label: 'Keterangan' },
  { value: 'catatan', label: 'Catatan' },
];

type TabType = 'ibadah' | 'holy_morning';

interface IbadahRow {
  id: string; tahun_ajaran: string; bulan: string; tanggal: string;
  pelayan_ibadah: string; pemberita_firman: string; tema_ibadah_bulanan: string;
  nas_alkitab: string; catatan: string | null; urutan: number | null;
  tanggal_sort: string | null; created_at: string; updated_at: string;
}

interface HolyMorningRow {
  id: string; tahun_ajaran: string; bulan: string; tanggal: string;
  christian_worldview: string; profil: string; bestra: string; karakter: string;
  tema_bulanan: string; tema_mingguan: string; nas_alkitab: string; tujuan: string;
  pelayan_holy_morning: string; keterangan: string; catatan: string | null;
  urutan: number | null; tanggal_sort: string | null; created_at: string; updated_at: string;
}

interface IbadahForm {
  bulan: string; tanggal: string; pelayan_ibadah: string; pemberita_firman: string;
  tema_ibadah_bulanan: string; nas_alkitab: string; catatan: string;
}

interface HolyMorningForm {
  bulan: string; tanggal: string; christian_worldview: string; profil: string;
  bestra: string; karakter: string; tema_bulanan: string; tema_mingguan: string;
  nas_alkitab: string; tujuan: string; pelayan_holy_morning: string; keterangan: string; catatan: string;
}

const EMPTY_IBADAH_FORM: IbadahForm = {
  bulan: '', tanggal: '', pelayan_ibadah: '', pemberita_firman: '',
  tema_ibadah_bulanan: '', nas_alkitab: '', catatan: '',
};

const EMPTY_HM_FORM: HolyMorningForm = {
  bulan: '', tanggal: '', christian_worldview: '', profil: '', bestra: '',
  karakter: '', tema_bulanan: '', tema_mingguan: '', nas_alkitab: '',
  tujuan: '', pelayan_holy_morning: '', keterangan: '', catatan: '',
};

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount > semiCount && tabCount > commaCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

function parseCSV(text: string, delimiter: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let inQuotes = false;
  let field = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delimiter) { current.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(field.trim());
        if (current.some((c) => c !== '')) lines.push(current);
        current = []; field = '';
      } else { field += ch; }
    }
  }
  current.push(field.trim());
  if (current.some((c) => c !== '')) lines.push(current);
  return lines;
}

function mapHeaders(headers: string[], headerMap: Record<string, string>): Record<number, string> {
  const mapping: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim();
    if (headerMap[key]) mapping[i] = headerMap[key];
  });
  return mapping;
}
export default function JadwalPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('ibadah');
  const [ibadahData, setIbadahData] = useState<IbadahRow[]>([]);
  const [hmData, setHmData] = useState<HolyMorningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahunAjaran, setTahunAjaran] = useState('2026-2027');
  const [filterBulan, setFilterBulan] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingIbadah, setEditingIbadah] = useState<IbadahRow | null>(null);
  const [editingHM, setEditingHM] = useState<HolyMorningRow | null>(null);
  const [ibadahForm, setIbadahForm] = useState<IbadahForm>(EMPTY_IBADAH_FORM);
  const [hmForm, setHmForm] = useState<HolyMorningForm>(EMPTY_HM_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: TabType } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedCsv, setParsedCsv] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvErrors, setCsvErrors] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screenshotting, setScreenshotting] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRow, setDetailRow] = useState<IbadahRow | HolyMorningRow | null>(null);
  const [detailType, setDetailType] = useState<TabType>('ibadah');
  const detailRef = useRef<HTMLDivElement>(null);
  const [detailScreenshotting, setDetailScreenshotting] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkField, setBulkField] = useState('christian_worldview');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkScope, setBulkScope] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditing, setBulkEditing] = useState(false);
  const [showPertanyaanModal, setShowPertanyaanModal] = useState(false);
  const [pertanyaanText, setPertanyaanText] = useState('');

  const tahunAjaranOptions = [
    { value: '2024-2025', label: '2024-2025' },
    { value: '2025-2026', label: '2025-2026' },
    { value: '2026-2027', label: '2026-2027' },
    { value: '2027-2028', label: '2027-2028' },
    { value: '2028-2029', label: '2028-2029' },
  ];

  const fetchIbadah = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('jadwal_ibadah').select('*').eq('tahun_ajaran', tahunAjaran)
      .order('tanggal_sort', { ascending: true, nullsFirst: false })
      .order('urutan', { ascending: true, nullsFirst: false });
    if (error) throw error;
    setIbadahData((rows || []) as unknown as IbadahRow[]);
  }, [tahunAjaran]);

  const fetchHM = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('jadwal_holy_morning').select('*').eq('tahun_ajaran', tahunAjaran)
      .order('tanggal_sort', { ascending: true, nullsFirst: false })
      .order('urutan', { ascending: true, nullsFirst: false });
    if (error) throw error;
    setHmData((rows || []) as unknown as HolyMorningRow[]);
  }, [tahunAjaran]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([fetchIbadah(), fetchHM()]); }
    catch { addToast('error', 'Gagal memuat data jadwal'); }
    finally { setLoading(false); }
  }, [fetchIbadah, fetchHM, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function matchesSearch(row: IbadahRow | HolyMorningRow): boolean {
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(row).filter((v): v is string => typeof v === 'string').some((f) => f.toLowerCase().includes(q));
  }

  function matchesDateRange(row: IbadahRow | HolyMorningRow): boolean {
    if (!row.tanggal_sort) return true;
    const d = row.tanggal_sort;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }

  const filteredIbadah = ibadahData.filter((row) => {
    if (filterBulan && row.bulan?.toUpperCase() !== filterBulan) return false;
    if (!matchesDateRange(row)) return false;
    if (!matchesSearch(row)) return false;
    return true;
  });

  const filteredHM = hmData.filter((row) => {
    if (filterBulan && row.bulan?.toUpperCase() !== filterBulan) return false;
    if (!matchesDateRange(row)) return false;
    if (!matchesSearch(row)) return false;
    return true;
  });

  const currentData = activeTab === 'ibadah' ? filteredIbadah.map((r) => r.id) : filteredHM.map((r) => r.id);
  const allSelected = currentData.length > 0 && currentData.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentData));
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openDetail(row: IbadahRow | HolyMorningRow, type: TabType) {
    setDetailRow(row);
    setDetailType(type);
    setShowDetailModal(true);
  }

  async function handleDetailScreenshot() {
    if (!detailRef.current) return;
    setDetailScreenshotting(true);
    try {
      const canvas = await html2canvas(detailRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) { addToast('error', 'Gagal membuat screenshot'); return; }
      const bulan = detailRow?.bulan || 'jadwal';
      const fname = `jadwal-${detailType === 'ibadah' ? 'ibadah' : 'holy-morning'}-${bulan.toLowerCase()}-${tahunAjaran}.png`;
      const file = new File([blob], fname, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ title: `Jadwal ${bulan}`, files: [file] }); }
        catch { downloadFile(blob, fname); }
      } else { downloadFile(blob, fname); }
      addToast('success', 'Screenshot berhasil dibuat');
    } catch { addToast('error', 'Gagal membuat screenshot'); }
    finally { setDetailScreenshotting(false); }
  }

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function openAddModal() {
    setEditingIbadah(null); setEditingHM(null);
    setIbadahForm(EMPTY_IBADAH_FORM); setHmForm(EMPTY_HM_FORM);
    setShowFormModal(true);
  }

  function openEditModal(row: IbadahRow | HolyMorningRow, type: TabType) {
    if (type === 'ibadah') {
      const r = row as IbadahRow;
      setEditingIbadah(r); setEditingHM(null);
      setIbadahForm({ bulan: r.bulan || '', tanggal: r.tanggal || '', pelayan_ibadah: r.pelayan_ibadah || '', pemberita_firman: r.pemberita_firman || '', tema_ibadah_bulanan: r.tema_ibadah_bulanan || '', nas_alkitab: r.nas_alkitab || '', catatan: r.catatan || '' });
    } else {
      const r = row as HolyMorningRow;
      setEditingIbadah(null); setEditingHM(r);
      setHmForm({ bulan: r.bulan || '', tanggal: r.tanggal || '', christian_worldview: r.christian_worldview || '', profil: r.profil || '', bestra: r.bestra || '', karakter: r.karakter || '', tema_bulanan: r.tema_bulanan || '', tema_mingguan: r.tema_mingguan || '', nas_alkitab: r.nas_alkitab || '', tujuan: r.tujuan || '', pelayan_holy_morning: r.pelayan_holy_morning || '', keterangan: r.keterangan || '', catatan: r.catatan || '' });
    }
    setShowFormModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (activeTab === 'ibadah') {
        const tanggalSort = parseTanggalToISO(ibadahForm.tanggal || '');
        const payload = { ...ibadahForm, tahun_ajaran: tahunAjaran, tanggal_sort: tanggalSort };
        if (editingIbadah) {
          const { error } = await supabase.from('jadwal_ibadah').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingIbadah.id);
          if (error) throw error;
          addToast('success', 'Jadwal ibadah berhasil diperbarui');
        } else {
          const { error } = await supabase.from('jadwal_ibadah').insert([payload]);
          if (error) throw error;
          addToast('success', 'Jadwal ibadah berhasil ditambahkan');
        }
      } else {
        const tanggalSort = parseTanggalToISO(hmForm.tanggal || '');
        const payload = { ...hmForm, tahun_ajaran: tahunAjaran, tanggal_sort: tanggalSort };
        if (editingHM) {
          const { error } = await supabase.from('jadwal_holy_morning').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingHM.id);
          if (error) throw error;
          addToast('success', 'Jadwal Holy Morning berhasil diperbarui');
        } else {
          const { error } = await supabase.from('jadwal_holy_morning').insert([payload]);
          if (error) throw error;
          addToast('success', 'Jadwal Holy Morning berhasil ditambahkan');
        }
      }
      setShowFormModal(false); fetchData();
    } catch { addToast('error', 'Gagal menyimpan data'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const table = deleteTarget.type === 'ibadah' ? 'jadwal_ibadah' : 'jadwal_holy_morning';
      const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      addToast('success', 'Data berhasil dihapus');
      fetchData();
    } catch { addToast('error', 'Gagal menghapus data'); }
    finally { setDeleteLoading(false); setDeleteTarget(null); }
  }

  async function handleDuplicate(row: IbadahRow | HolyMorningRow, type: TabType) {
    try {
      if (type === 'ibadah') {
        const r = row as IbadahRow;
        const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = r;
        const tanggalSort = parseTanggalToISO(rest.tanggal || '');
        const { error } = await supabase.from('jadwal_ibadah').insert([{ ...rest, tahun_ajaran: tahunAjaran, tanggal_sort: tanggalSort }]);
        if (error) throw error;
      } else {
        const r = row as HolyMorningRow;
        const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = r;
        const tanggalSort = parseTanggalToISO(rest.tanggal || '');
        const { error } = await supabase.from('jadwal_holy_morning').insert([{ ...rest, tahun_ajaran: tahunAjaran, tanggal_sort: tanggalSort }]);
        if (error) throw error;
      }
      addToast('success', 'Data berhasil diduplikasi'); fetchData();
    } catch { addToast('error', 'Gagal menduplikasi data'); }
  }

  function resetImport() {
    setCsvText(''); setCsvFile(null); setParsedCsv([]); setCsvHeaders([]); setCsvErrors(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; setCsvText(text); processCsvText(text); };
    reader.readAsText(file);
  }

  function processCsvText(text: string) {
    if (!text.trim()) { setParsedCsv([]); setCsvHeaders([]); setCsvErrors(0); return; }
    const delimiter = detectDelimiter(text);
    const rows = parseCSV(text, delimiter);
    if (rows.length < 2) { setParsedCsv([]); setCsvHeaders([]); setCsvErrors(0); return; }
    const rawHeaders = rows[0];
    const headerMap = activeTab === 'ibadah' ? IBADAH_HEADER_MAP : HM_HEADER_MAP;
    const mapping = mapHeaders(rawHeaders, headerMap);
    const mappedRows: Record<string, string>[] = [];
    let errors = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, string> = {};
      Object.entries(mapping).forEach(([colIdx, fieldName]) => { record[fieldName] = row[parseInt(colIdx)] || ''; });
      if (!record['bulan']) errors++;
      mappedRows.push(record);
    }
    setCsvHeaders(Object.values(mapping));
    setParsedCsv(mappedRows);
    setCsvErrors(errors);
  }

  function handleCsvTextChange(text: string) {
    setCsvText(text); setCsvFile(null); processCsvText(text);
  }

  async function handleImport() {
    if (parsedCsv.length === 0) return;
    setImporting(true);
    try {
      const table = activeTab === 'ibadah' ? 'jadwal_ibadah' : 'jadwal_holy_morning';
      const validRows = parsedCsv.filter((r) => r.bulan);
      const payload = validRows.map((r) => ({ ...r, tahun_ajaran: tahunAjaran, tanggal_sort: parseTanggalToISO(r.tanggal || '') }));
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      addToast('success', `${payload.length} data berhasil diimpor`);
      setShowImportModal(false); resetImport(); fetchData();
    } catch { addToast('error', 'Gagal mengimpor data'); }
    finally { setImporting(false); }
  }

  async function handleBulkEdit() {
    if (!bulkField || !bulkValue.trim()) { addToast('warning', 'Pilih field dan isi nilai'); return; }
    setBulkEditing(true);
    try {
      const table = activeTab === 'ibadah' ? 'jadwal_ibadah' : 'jadwal_holy_morning';
      const updatePayload = { [bulkField]: bulkValue, updated_at: new Date().toISOString() };
      if (bulkScope === 'selected' && selectedIds.size > 0) {
        const ids = Array.from(selectedIds);
        const { error } = await supabase.from(table).update(updatePayload).in('id', ids);
        if (error) throw error;
        addToast('success', `${ids.length} data berhasil diperbarui`);
      } else {
        let query = supabase.from(table).update(updatePayload).eq('tahun_ajaran', tahunAjaran);
        if (filterBulan) query = query.eq('bulan', filterBulan);
        if (dateFrom) query = query.gte('tanggal_sort', dateFrom);
        if (dateTo) query = query.lte('tanggal_sort', dateTo);
        const { error } = await query;
        if (error) throw error;
        addToast('success', 'Semua data yang ditampilkan berhasil diperbarui');
      }
      setShowBulkEditModal(false); setBulkValue(''); fetchData();
    } catch { addToast('error', 'Gagal melakukan bulk edit'); }
    finally { setBulkEditing(false); }
  }

  function openPertanyaanModal() {
    const rows = activeTab === 'ibadah' ? filteredIbadah : filteredHM;
    const existing = rows.map((r) => {
      try { const parsed = JSON.parse(r.catatan || '{}'); return parsed.pertanyaan || ''; }
      catch { return ''; }
    }).filter(Boolean);
    setPertanyaanText(existing.join('\n'));
    setShowPertanyaanModal(true);
  }

  async function handleSavePertanyaan() {
    const rows = activeTab === 'ibadah' ? filteredIbadah : filteredHM;
    const questions = pertanyaanText.split('\n').map((q) => q.trim()).filter(Boolean);
    const table = activeTab === 'ibadah' ? 'jadwal_ibadah' : 'jadwal_holy_morning';
    try {
      for (let i = 0; i < rows.length; i++) {
        let existing: Record<string, unknown> = {};
        try { existing = JSON.parse(rows[i].catatan || '{}'); } catch { existing = {}; }
        existing.pertanyaan = questions[i % questions.length] || '';
        const { error } = await supabase.from(table).update({ catatan: JSON.stringify(existing), updated_at: new Date().toISOString() }).eq('id', rows[i].id);
        if (error) throw error;
      }
      addToast('success', 'Pertanyaan pemantik berhasil disimpan');
      setShowPertanyaanModal(false); fetchData();
    } catch { addToast('error', 'Gagal menyimpan pertanyaan pemantik'); }
  }

  async function handleScreenshot() {
    if (!screenshotRef.current) return;
    setScreenshotting(true);
    try {
      const canvas = await html2canvas(screenshotRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) { addToast('error', 'Gagal membuat screenshot'); return; }
      const fname = `jadwal-${activeTab}-${tahunAjaran}.png`;
      const file = new File([blob], fname, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ title: `Jadwal ${activeTab === 'ibadah' ? 'Ibadah' : 'Holy Morning'} — Tahun Ajar ${tahunAjaran}`, files: [file] }); }
        catch { downloadFile(blob, fname); }
      } else { downloadFile(blob, fname); }
      addToast('success', 'Screenshot berhasil dibuat');
    } catch { addToast('error', 'Gagal membuat screenshot'); }
    finally { setScreenshotting(false); }
  }

  const screenshotData = activeTab === 'ibadah' ? filteredIbadah : filteredHM;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Ibadah & Holy Morning</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola jadwal ibadah dan Holy Morning Sekolah Kristen Lentera</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { resetImport(); setShowImportModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
            <Upload size={16} /><span className="hidden sm:inline">Import CSV</span>
          </button>
          <button onClick={() => setShowBulkEditModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
            <Edit2 size={16} /><span className="hidden sm:inline">Bulk Edit</span>
          </button>
          <button onClick={openPertanyaanModal} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
            <Calendar size={16} /><span className="hidden sm:inline">Pertanyaan Pemantik</span>
          </button>
          <button onClick={handleScreenshot} disabled={screenshotting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50">
            {screenshotting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <span className="hidden sm:inline">Screenshot</span>
          </button>
          <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={16} /><span>Tambah</span>
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => { setActiveTab('ibadah'); setFilterBulan(''); setSearch(''); setSelectedIds(new Set()); }} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all', activeTab === 'ibadah' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          Jadwal Ibadah
        </button>
        <button onClick={() => { setActiveTab('holy_morning'); setFilterBulan(''); setSearch(''); setSelectedIds(new Set()); }} className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all', activeTab === 'holy_morning' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          Holy Morning
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect value={tahunAjaran} onChange={setTahunAjaran} options={tahunAjaranOptions} placeholder="Tahun Ajaran" />
        <FilterSelect value={filterBulan} onChange={setFilterBulan} options={BULAN_OPTIONS.map((b) => ({ value: b, label: b }))} placeholder="Semua Bulan" />
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">Sampai</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="mt-4 p-1.5 text-gray-400 hover:text-gray-600" title="Reset tanggal">
              <X size={14} />
            </button>
          )}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari jadwal..." className="flex-1 min-w-[200px]" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          <div ref={tableContainerRef} className="hidden md:block">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                {activeTab === 'ibadah' ? (
                  <IbadahTable data={filteredIbadah} selectedIds={selectedIds} allSelected={allSelected} onToggleSelectAll={toggleSelectAll} onToggleSelectOne={toggleSelectOne} onEdit={(row) => openEditModal(row, 'ibadah')} onDelete={(id) => setDeleteTarget({ id, type: 'ibadah' })} onDuplicate={(row) => handleDuplicate(row, 'ibadah')} onView={(row) => openDetail(row, 'ibadah')} />
                ) : (
                  <HMTable data={filteredHM} selectedIds={selectedIds} allSelected={allSelected} onToggleSelectAll={toggleSelectAll} onToggleSelectOne={toggleSelectOne} onEdit={(row) => openEditModal(row, 'holy_morning')} onDelete={(id) => setDeleteTarget({ id, type: 'holy_morning' })} onDuplicate={(row) => handleDuplicate(row, 'holy_morning')} onView={(row) => openDetail(row, 'holy_morning')} />
                )}
              </div>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {activeTab === 'ibadah' ? (
              filteredIbadah.length === 0 ? <EmptyCard /> : filteredIbadah.map((row) => (
                <IbadahCard key={row.id} row={row} selected={selectedIds.has(row.id)} onToggleSelect={() => toggleSelectOne(row.id)} onEdit={() => openEditModal(row, 'ibadah')} onDelete={() => setDeleteTarget({ id: row.id, type: 'ibadah' })} onDuplicate={() => handleDuplicate(row, 'ibadah')} onView={() => openDetail(row, 'ibadah')} />
              ))
            ) : filteredHM.length === 0 ? <EmptyCard /> : filteredHM.map((row) => (
              <HMCard key={row.id} row={row} selected={selectedIds.has(row.id)} onToggleSelect={() => toggleSelectOne(row.id)} onEdit={() => openEditModal(row, 'holy_morning')} onDelete={() => setDeleteTarget({ id: row.id, type: 'holy_morning' })} onDuplicate={() => handleDuplicate(row, 'holy_morning')} onView={() => openDetail(row, 'holy_morning')} />
            ))}
          </div>

          <div className="text-sm text-gray-500 text-center">
            {activeTab === 'ibadah' ? `${filteredIbadah.length} jadwal ibadah` : `${filteredHM.length} jadwal Holy Morning`}
            {selectedIds.size > 0 && ` · ${selectedIds.size} dipilih`}
          </div>
        </>
      )}

      <div ref={screenshotRef} style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
        <div className="bg-white p-6" style={{ width: '1200px' }}>
          <div className="p-6 rounded-t-xl mb-4" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)' }}>
            <h1 className="text-xl font-bold text-white">
              {activeTab === 'ibadah' ? `Jadwal Ibadah dan Pelayan dalam Ibadah Pegawai — Tahun Ajar ${tahunAjaran}` : `Jadwal Pelayan Firman Holy Morning — Tahun Ajar ${tahunAjaran}`}
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Sekolah Kristen Lentera</p>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-indigo-50">
                {activeTab === 'ibadah' ? (
                  <><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">NO</th><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">BULAN</th><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">TANGGAL</th><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">PELAYAN IBADAH</th><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">PEMBERITA FIRMAN</th><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">TEMA IBADAH BULANAN</th><th className="px-3 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">NAS ALKITAB</th></>
                ) : (
                  <><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">NO</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">BULAN</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">TANGGAL</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">CHRISTIAN WORLDVIEW</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">PROFIL</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">BESTRA</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">KARAKTER</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">TEMA BULANAN</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">TEMA MINGGUAN</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">NAS ALKITAB</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">TUJUAN</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">PELAYAN HOLY MORNING</th><th className="px-2 py-2 text-left font-semibold text-indigo-800 border border-indigo-200">KETERANGAN</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {activeTab === 'ibadah'
                ? (screenshotData as IbadahRow[]).map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 border border-gray-200">{i + 1}</td><td className="px-3 py-1.5 border border-gray-200 font-medium">{row.bulan}</td><td className="px-3 py-1.5 border border-gray-200">{row.tanggal}</td><td className="px-3 py-1.5 border border-gray-200">{row.pelayan_ibadah}</td><td className="px-3 py-1.5 border border-gray-200">{row.pemberita_firman}</td><td className="px-3 py-1.5 border border-gray-200">{row.tema_ibadah_bulanan}</td><td className="px-3 py-1.5 border border-gray-200">{row.nas_alkitab}</td>
                    </tr>
                  ))
                : (screenshotData as HolyMorningRow[]).map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1.5 border border-gray-200">{i + 1}</td><td className="px-2 py-1.5 border border-gray-200 font-medium">{row.bulan}</td><td className="px-2 py-1.5 border border-gray-200">{row.tanggal}</td><td className="px-2 py-1.5 border border-gray-200">{row.christian_worldview}</td><td className="px-2 py-1.5 border border-gray-200">{row.profil}</td><td className="px-2 py-1.5 border border-gray-200">{row.bestra}</td><td className="px-2 py-1.5 border border-gray-200">{row.karakter}</td><td className="px-2 py-1.5 border border-gray-200">{row.tema_bulanan}</td><td className="px-2 py-1.5 border border-gray-200">{row.tema_mingguan}</td><td className="px-2 py-1.5 border border-gray-200">{row.nas_alkitab}</td><td className="px-2 py-1.5 border border-gray-200">{row.tujuan}</td><td className="px-2 py-1.5 border border-gray-200">{row.pelayan_holy_morning}</td><td className="px-2 py-1.5 border border-gray-200">{row.keterangan}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-gray-400 text-right">Sekolah Kristen Lentera &middot; Dicetak {new Date().toLocaleDateString('id-ID')}</div>
        </div>
      </div>

      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={activeTab === 'ibadah' ? (editingIbadah ? 'Edit Jadwal Ibadah' : 'Tambah Jadwal Ibadah') : (editingHM ? 'Edit Jadwal Holy Morning' : 'Tambah Jadwal Holy Morning')} size="xl">
        {activeTab === 'ibadah' ? (
          <IbadahFormContent form={ibadahForm} onChange={setIbadahForm} onSave={handleSave} onCancel={() => setShowFormModal(false)} saving={saving} isEdit={!!editingIbadah} />
        ) : (
          <HMFormContent form={hmForm} onChange={setHmForm} onSave={handleSave} onCancel={() => setShowFormModal(false)} saving={saving} isEdit={!!editingHM} />
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus Data" message="Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan." confirmText="Hapus" loading={deleteLoading} />

      <Modal open={showImportModal} onClose={() => { setShowImportModal(false); resetImport(); }} title={`Import CSV — ${activeTab === 'ibadah' ? 'Jadwal Ibadah' : 'Holy Morning'}`} size="xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload File CSV</label>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                <FileSpreadsheet size={16} />Pilih File
              </button>
              {csvFile && <span className="text-sm text-gray-500">{csvFile.name}</span>}
            </div>
          </div>
          <Textarea label="Atau tempel CSV di sini" value={csvText} onChange={(e) => handleCsvTextChange(e.target.value)} placeholder={"BULAN,TANGGAL,PELAYAN IBADAH,...\nJULI,12 Juli 2026 HUT SKL,GKI dan SKL,..."} rows={6} />
          {parsedCsv.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Preview ({parsedCsv.length} baris)</h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600">? {parsedCsv.length - csvErrors} valid</span>
                  {csvErrors > 0 && <span className="text-red-600">? {csvErrors} tidak valid</span>}
                </div>
              </div>
              <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 sticky top-0">{csvHeaders.map((h) => (<th key={h} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">{h}</th>))}</tr></thead>
                  <tbody>{parsedCsv.slice(0, 50).map((row, i) => (<tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>{csvHeaders.map((h) => (<td key={h} className="px-3 py-1.5 border-b border-gray-100 text-gray-700">{row[h] || ''}</td>))}</tr>))}</tbody>
                </table>
                {parsedCsv.length > 50 && <div className="text-center py-2 text-xs text-gray-400">... dan {parsedCsv.length - 50} baris lagi</div>}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowImportModal(false); resetImport(); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
            <button onClick={handleImport} disabled={parsedCsv.length === 0 || csvErrors === parsedCsv.length || importing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import {parsedCsv.length > 0 && `(${parsedCsv.length - csvErrors} baris)`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="Detail Jadwal" size="xl">
        {detailRow && (
          <div>
            <div ref={detailRef} className="bg-white">
              <div className="p-6 rounded-t-xl mb-4" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)' }}>
                <h1 className="text-lg font-bold text-white">
                  {detailType === 'ibadah' ? 'Jadwal Ibadah dan Pelayan dalam Ibadah Pegawai' : 'Jadwal Pelayan Firman Holy Morning'}
                </h1>
                <p className="text-indigo-200 text-sm mt-1">Sekolah Kristen Lentera — Tahun Ajar {detailRow.tahun_ajaran}</p>
                <p className="text-indigo-200 text-xs mt-0.5">Periode: {detailRow.bulan} / {detailRow.tanggal}</p>
              </div>
              <div className="space-y-3 px-2 pb-4">
                {detailType === 'ibadah' ? (
                  <>
                    <DetailField label="BULAN" value={(detailRow as IbadahRow).bulan} />
                    <DetailField label="TANGGAL" value={(detailRow as IbadahRow).tanggal} />
                    <DetailField label="PELAYAN IBADAH" value={(detailRow as IbadahRow).pelayan_ibadah} />
                    <DetailField label="PEMBERITA FIRMAN" value={(detailRow as IbadahRow).pemberita_firman} />
                    <DetailField label="TEMA IBADAH BULANAN" value={(detailRow as IbadahRow).tema_ibadah_bulanan} />
                    <DetailField label="NAS ALKITAB" value={(detailRow as IbadahRow).nas_alkitab} />
                  </>
                ) : (
                  <>
                    <DetailField label="BULAN" value={(detailRow as HolyMorningRow).bulan} />
                    <DetailField label="TANGGAL" value={(detailRow as HolyMorningRow).tanggal} />
                    <DetailField label="CHRISTIAN WORLDVIEW" value={(detailRow as HolyMorningRow).christian_worldview} />
                    <DetailField label="PROFIL" value={(detailRow as HolyMorningRow).profil} />
                    <DetailField label="BESTRA" value={(detailRow as HolyMorningRow).bestra} />
                    <DetailField label="KARAKTER" value={(detailRow as HolyMorningRow).karakter} />
                    <DetailField label="TEMA BULANAN" value={(detailRow as HolyMorningRow).tema_bulanan} />
                    <DetailField label="TEMA MINGGUAN" value={(detailRow as HolyMorningRow).tema_mingguan} />
                    <DetailField label="NAS ALKITAB" value={(detailRow as HolyMorningRow).nas_alkitab} />
                    <DetailField label="TUJUAN" value={(detailRow as HolyMorningRow).tujuan} />
                    <DetailField label="PELAYAN HOLY MORNING" value={(detailRow as HolyMorningRow).pelayan_holy_morning} />
                    <DetailField label="KETERANGAN" value={(detailRow as HolyMorningRow).keterangan} />
                  </>
                )}
                {(() => {
                  try {
                    const parsed = JSON.parse(detailRow.catatan || '{}');
                    if (parsed.pertanyaan) {
                      return <DetailField label="PERTANYAAN PEMANTIK" value={parsed.pertanyaan} />;
                    }
                  } catch {}
                  if (detailRow.catatan) {
                    return <DetailField label="CATATAN" value={detailRow.catatan} />;
                  }
                  return null;
                })()}
              </div>
              <div className="px-4 pb-4 text-xs text-gray-400 text-right border-t border-gray-100 pt-3">
                Sekolah Kristen Lentera &middot; Dicetak {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Tutup</button>
              <button onClick={handleDetailScreenshot} disabled={detailScreenshotting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {detailScreenshotting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                Screenshot
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showBulkEditModal} onClose={() => { setShowBulkEditModal(false); setBulkValue(''); }} title="Bulk Edit Data" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Perbarui field yang sama untuk banyak data sekaligus.</p>
          <Select label="Field yang akan diedit" value={bulkField} onChange={(e) => setBulkField(e.target.value)} options={HM_BULK_EDIT_FIELDS} placeholder="Pilih field" />
          <Textarea label="Nilai baru" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Masukkan nilai baru..." rows={3} />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Cakupan</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="bulkScope" value="all" checked={bulkScope === 'all'} onChange={() => setBulkScope('all')} className="text-indigo-600" />
                <span className="text-sm text-gray-700">Semua data yang ditampilkan {filterBulan ? `(bulan ${filterBulan})` : ''} ({activeTab === 'ibadah' ? filteredIbadah.length : filteredHM.length} baris)</span>
              </label>
              <label className={cn('flex items-center gap-2 cursor-pointer', selectedIds.size === 0 && 'opacity-50')}>
                <input type="radio" name="bulkScope" value="selected" checked={bulkScope === 'selected'} onChange={() => setBulkScope('selected')} disabled={selectedIds.size === 0} className="text-indigo-600" />
                <span className="text-sm text-gray-700">Hanya yang dipilih ({selectedIds.size} baris)</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowBulkEditModal(false); setBulkValue(''); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
            <button onClick={handleBulkEdit} disabled={bulkEditing || !bulkValue.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {bulkEditing ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
              Terapkan
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showPertanyaanModal} onClose={() => setShowPertanyaanModal(false)} title="Kelola Pertanyaan Pemantik" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Masukkan pertanyaan pemantik (satu per baris). Pertanyaan akan didistribusikan ke setiap entri secara berurutan.</p>
          <Textarea label="Pertanyaan Pemantik" value={pertanyaanText} onChange={(e) => setPertanyaanText(e.target.value)} placeholder={"Apa makna dari tema minggu ini?\nBagaimana penerapannya dalam kehidupan sehari-hari?\nSiapa tokoh Alkitab yang relevan?"} rows={8} />
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-indigo-700">Info: Pertanyaan akan disimpan di field catatan setiap entri dalam format JSON. Pertanyaan akan didistribusikan secara round-robin ke {activeTab === 'ibadah' ? filteredIbadah.length : filteredHM.length} entri yang ditampilkan.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowPertanyaanModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
            <button onClick={handleSavePertanyaan} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <CheckSquare size={16} />Simpan Pertanyaan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3 border-b border-gray-100 pb-2">
      <span className="text-xs font-semibold text-gray-500 min-w-[180px] shrink-0 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  );
}

function IbadahTable({ data, selectedIds, allSelected, onToggleSelectAll, onToggleSelectOne, onEdit, onDelete, onDuplicate, onView }: {
  data: IbadahRow[]; selectedIds: Set<string>; allSelected: boolean;
  onToggleSelectAll: () => void; onToggleSelectOne: (id: string) => void;
  onEdit: (row: IbadahRow) => void; onDelete: (id: string) => void;
  onDuplicate: (row: IbadahRow) => void; onView: (row: IbadahRow) => void;
}) {
  if (data.length === 0) return (<div className="py-16 text-center text-gray-400"><FileSpreadsheet size={40} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Belum ada data jadwal ibadah</p></div>);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-indigo-50/80">
          <th className="px-2 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="rounded border-gray-300 text-indigo-600" /></th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">No</th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Bulan</th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Tanggal</th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Pelayan Ibadah</th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Pemberita Firman</th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Tema Ibadah Bulanan</th>
          <th className="px-4 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Nas Alkitab</th>
          <th className="px-4 py-3 text-right font-semibold text-indigo-800 text-xs uppercase tracking-wider w-28">Aksi</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.map((row, i) => (
          <tr key={row.id} className={cn('hover:bg-indigo-50/50 transition-colors', i % 2 === 1 && 'bg-gray-50/50', selectedIds.has(row.id) && 'bg-indigo-50/30')}>
            <td className="px-2 py-3"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelectOne(row.id)} className="rounded border-gray-300 text-indigo-600" /></td>
            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
            <td className="px-4 py-3 font-medium text-gray-900">{row.bulan}</td>
            <td className="px-4 py-3 text-gray-700">{row.tanggal}</td>
            <td className="px-4 py-3 text-gray-700">{row.pelayan_ibadah}</td>
            <td className="px-4 py-3 text-gray-700">{row.pemberita_firman}</td>
            <td className="px-4 py-3 text-gray-700">{row.tema_ibadah_bulanan}</td>
            <td className="px-4 py-3 text-gray-700">{row.nas_alkitab}</td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => onView(row)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Lihat Detail"><Eye size={14} /></button>
                <button onClick={() => onEdit(row)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit2 size={14} /></button>
                <button onClick={() => onDuplicate(row)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duplikasi"><Copy size={14} /></button>
                <button onClick={() => onDelete(row.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HMTable({ data, selectedIds, allSelected, onToggleSelectAll, onToggleSelectOne, onEdit, onDelete, onDuplicate, onView }: {
  data: HolyMorningRow[]; selectedIds: Set<string>; allSelected: boolean;
  onToggleSelectAll: () => void; onToggleSelectOne: (id: string) => void;
  onEdit: (row: HolyMorningRow) => void; onDelete: (id: string) => void;
  onDuplicate: (row: HolyMorningRow) => void; onView: (row: HolyMorningRow) => void;
}) {
  if (data.length === 0) return (<div className="py-16 text-center text-gray-400"><FileSpreadsheet size={40} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Belum ada data jadwal Holy Morning</p></div>);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-indigo-50/80">
          <th className="px-2 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="rounded border-gray-300 text-indigo-600" /></th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">No</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Bulan</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Tanggal</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Christian Worldview</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Profil</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Bestra</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Karakter</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Tema Bulanan</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Tema Mingguan</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Nas Alkitab</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Tujuan</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Pelayan HM</th>
          <th className="px-3 py-3 text-left font-semibold text-indigo-800 text-xs uppercase tracking-wider">Keterangan</th>
          <th className="px-3 py-3 text-right font-semibold text-indigo-800 text-xs uppercase tracking-wider w-28">Aksi</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {data.map((row, i) => (
          <tr key={row.id} className={cn('hover:bg-indigo-50/50 transition-colors', i % 2 === 1 && 'bg-gray-50/50', selectedIds.has(row.id) && 'bg-indigo-50/30')}>
            <td className="px-2 py-3"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => onToggleSelectOne(row.id)} className="rounded border-gray-300 text-indigo-600" /></td>
            <td className="px-3 py-3 text-gray-500">{i + 1}</td>
            <td className="px-3 py-3 font-medium text-gray-900">{row.bulan}</td>
            <td className="px-3 py-3 text-gray-700">{row.tanggal}</td>
            <td className="px-3 py-3 text-gray-700">{row.christian_worldview}</td>
            <td className="px-3 py-3 text-gray-700">{row.profil}</td>
            <td className="px-3 py-3 text-gray-700">{row.bestra}</td>
            <td className="px-3 py-3 text-gray-700">{row.karakter}</td>
            <td className="px-3 py-3 text-gray-700">{row.tema_bulanan}</td>
            <td className="px-3 py-3 text-gray-700">{row.tema_mingguan}</td>
            <td className="px-3 py-3 text-gray-700">{row.nas_alkitab}</td>
            <td className="px-3 py-3 text-gray-700">{row.tujuan}</td>
            <td className="px-3 py-3 text-gray-700">{row.pelayan_holy_morning}</td>
            <td className="px-3 py-3 text-gray-700">{row.keterangan}</td>
            <td className="px-3 py-3">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => onView(row)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Lihat Detail"><Eye size={14} /></button>
                <button onClick={() => onEdit(row)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit2 size={14} /></button>
                <button onClick={() => onDuplicate(row)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duplikasi"><Copy size={14} /></button>
                <button onClick={() => onDelete(row.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IbadahCard({ row, selected, onToggleSelect, onEdit, onDelete, onDuplicate, onView }: {
  row: IbadahRow; selected: boolean; onToggleSelect: () => void;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void; onView: () => void;
}) {
  return (
    <div className={cn('bg-white rounded-xl border p-4 space-y-2', selected ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200')}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-gray-300 text-indigo-600" />
          <span className="inline-block px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">{row.bulan}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onView} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye size={14} /></button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={14} /></button>
          <button onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Copy size={14} /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
        </div>
      </div>
      <CardField label="Tanggal" value={row.tanggal} />
      <CardField label="Pelayan Ibadah" value={row.pelayan_ibadah} />
      <CardField label="Pemberita Firman" value={row.pemberita_firman} />
      <CardField label="Tema Ibadah Bulanan" value={row.tema_ibadah_bulanan} />
      <CardField label="Nas Alkitab" value={row.nas_alkitab} />
    </div>
  );
}

function HMCard({ row, selected, onToggleSelect, onEdit, onDelete, onDuplicate, onView }: {
  row: HolyMorningRow; selected: boolean; onToggleSelect: () => void;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void; onView: () => void;
}) {
  return (
    <div className={cn('bg-white rounded-xl border p-4 space-y-2', selected ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200')}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-gray-300 text-indigo-600" />
          <span className="inline-block px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">{row.bulan}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onView} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye size={14} /></button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={14} /></button>
          <button onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Copy size={14} /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
        </div>
      </div>
      <CardField label="Tanggal" value={row.tanggal} />
      <CardField label="Christian Worldview" value={row.christian_worldview} />
      <CardField label="Profil" value={row.profil} />
      <CardField label="Bestra" value={row.bestra} />
      <CardField label="Karakter" value={row.karakter} />
      <CardField label="Tema Bulanan" value={row.tema_bulanan} />
      <CardField label="Tema Mingguan" value={row.tema_mingguan} />
      <CardField label="Nas Alkitab" value={row.nas_alkitab} />
      <CardField label="Tujuan" value={row.tujuan} />
      <CardField label="Pelayan Holy Morning" value={row.pelayan_holy_morning} />
      <CardField label="Keterangan" value={row.keterangan} />
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-gray-400 min-w-[120px] shrink-0">{label}</span>
      <span className="text-sm text-gray-700">{value || '—'}</span>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="py-12 text-center text-gray-400">
      <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-40" />
      <p className="text-sm">Belum ada data</p>
    </div>
  );
}

function IbadahFormContent({ form, onChange, onSave, onCancel, saving, isEdit }: {
  form: IbadahForm; onChange: (f: IbadahForm) => void; onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean;
}) {
  const update = (field: keyof IbadahForm, value: string) => onChange({ ...form, [field]: value });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Bulan" value={form.bulan} onChange={(e) => update('bulan', e.target.value)} options={BULAN_OPTIONS.map((b) => ({ value: b, label: b }))} placeholder="Pilih bulan" />
        <Input label="Tanggal" value={form.tanggal} onChange={(e) => update('tanggal', e.target.value)} placeholder="contoh: 12 Juli 2026 HUT SKL" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Pelayan Ibadah" value={form.pelayan_ibadah} onChange={(e) => update('pelayan_ibadah', e.target.value)} placeholder="contoh: GKI dan SKL" />
        <Input label="Pemberita Firman" value={form.pemberita_firman} onChange={(e) => update('pemberita_firman', e.target.value)} placeholder="contoh: Ev. Ratnajani Muljadi S.Th" />
      </div>
      <Input label="Tema Ibadah Bulanan" value={form.tema_ibadah_bulanan} onChange={(e) => update('tema_ibadah_bulanan', e.target.value)} placeholder="contoh: HOLY THOUGHT FOR GOD" />
      <Input label="Nas Alkitab" value={form.nas_alkitab} onChange={(e) => update('nas_alkitab', e.target.value)} placeholder="contoh: PHIL. 4:8" />
      <Textarea label="Catatan" value={form.catatan} onChange={(e) => update('catatan', e.target.value)} placeholder="Catatan tambahan (opsional)" rows={2} />
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {isEdit ? 'Simpan Perubahan' : 'Tambah'}
        </button>
      </div>
    </div>
  );
}

function HMFormContent({ form, onChange, onSave, onCancel, saving, isEdit }: {
  form: HolyMorningForm; onChange: (f: HolyMorningForm) => void; onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean;
}) {
  const update = (field: keyof HolyMorningForm, value: string) => onChange({ ...form, [field]: value });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Bulan" value={form.bulan} onChange={(e) => update('bulan', e.target.value)} options={BULAN_OPTIONS.map((b) => ({ value: b, label: b }))} placeholder="Pilih bulan" />
        <Input label="Tanggal" value={form.tanggal} onChange={(e) => update('tanggal', e.target.value)} placeholder="contoh: Senin, 6 Juli 2026" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Christian Worldview" value={form.christian_worldview} onChange={(e) => update('christian_worldview', e.target.value)} placeholder="Christian Worldview" />
        <Input label="Profil" value={form.profil} onChange={(e) => update('profil', e.target.value)} placeholder="Profil" />
        <Input label="Bestra" value={form.bestra} onChange={(e) => update('bestra', e.target.value)} placeholder="Bestra" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Karakter" value={form.karakter} onChange={(e) => update('karakter', e.target.value)} placeholder="Karakter" />
        <Input label="Tema Bulanan" value={form.tema_bulanan} onChange={(e) => update('tema_bulanan', e.target.value)} placeholder="Tema Bulanan" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Tema Mingguan" value={form.tema_mingguan} onChange={(e) => update('tema_mingguan', e.target.value)} placeholder="Tema Mingguan" />
        <Input label="Nas Alkitab" value={form.nas_alkitab} onChange={(e) => update('nas_alkitab', e.target.value)} placeholder="contoh: PHIL. 4:8" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Tujuan" value={form.tujuan} onChange={(e) => update('tujuan', e.target.value)} placeholder="Tujuan" />
        <Input label="Pelayan Holy Morning" value={form.pelayan_holy_morning} onChange={(e) => update('pelayan_holy_morning', e.target.value)} placeholder="Pelayan Holy Morning" />
      </div>
      <Input label="Keterangan" value={form.keterangan} onChange={(e) => update('keterangan', e.target.value)} placeholder="Keterangan" />
      <Textarea label="Catatan" value={form.catatan} onChange={(e) => update('catatan', e.target.value)} placeholder="Catatan tambahan (opsional)" rows={2} />
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {isEdit ? 'Simpan Perubahan' : 'Tambah'}
        </button>
      </div>
    </div>
  );
}
