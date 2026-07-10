'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowLeft,
  Camera,
  Share2,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
} from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { UnitBadge } from '@/components/ui/unit-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input, Select, Textarea } from '@/components/ui/form-controls';
import { SearchBar, PageHeader, EmptyState } from '@/components/ui/filter-bar';
import { useToast } from '@/components/ui/toast';
import { supabase } from '@/lib/supabase/client';
import html2canvas from 'html2canvas-pro';
import { cn } from '@/lib/utils/cn';
import { generateId } from '@/lib/utils/format';
import { getCurrentTahunAjaran } from '@/lib/utils/date';
import type { Jadwal, JadwalItem, Unit } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────
type JadwalWithUnit = Jadwal & {
  unit: { id: string; code: string; name: string; color: string } | null;
};

type ViewMode = 'list' | 'detail' | 'form';

interface SlotData {
  jam_mulai: string;
  jam_selesai: string;
  nama_slot: string;
}

interface CellKey {
  slotIndex: number;
  hari: string;
}

// ── Constants ──────────────────────────────────────────────────
const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const DEFAULT_SLOTS: SlotData[] = [
  { jam_mulai: '07:00', jam_selesai: '10:00', nama_slot: 'Pagi' },
  { jam_mulai: '10:00', jam_selesai: '10:15', nama_slot: 'Istirahat' },
  { jam_mulai: '10:15', jam_selesai: '12:00', nama_slot: 'Pagi 2' },
  { jam_mulai: '13:00', jam_selesai: '15:00', nama_slot: 'Siang' },
];

const SEMESTER_OPTIONS = [
  { value: '1', label: 'Semester 1' },
  { value: '2', label: 'Semester 2' },
];

const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Aktif', label: 'Aktif' },
  { value: 'Nonaktif', label: 'Nonaktif' },
];

function generateTahunAjaranOptions() {
  const currentYear = new Date().getFullYear();
  const options = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    options.push({ value: `${y}-${y + 1}`, label: `${y}-${y + 1}` });
  }
  return options;
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions();

const HARI_BG_COLORS: Record<string, string> = {
  Senin: 'bg-indigo-600',
  Selasa: 'bg-blue-600',
  Rabu: 'bg-emerald-600',
  Kamis: 'bg-amber-600',
  Jumat: 'bg-rose-600',
  Sabtu: 'bg-purple-600',
};

const HARI_HEADER_TEXT: Record<string, string> = {
  Senin: 'Senin',
  Selasa: 'Selasa',
  Rabu: 'Rabu',
  Kamis: 'Kamis',
  Jumat: 'Jumat',
  Sabtu: 'Sabtu',
};

// ── Helpers ────────────────────────────────────────────────────
function getCellKey(slotIndex: number, hari: string): string {
  return `${slotIndex}-${hari}`;
}

function isIstirahat(slot: SlotData): boolean {
  return slot.nama_slot.toLowerCase().includes('istirahat');
}

// ── Component ──────────────────────────────────────────────────
export default function JadwalPage() {
  const { addToast } = useToast();

  // ── Data State ─────────────────────────────────────────────
  const [jadwalList, setJadwalList] = useState<JadwalWithUnit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // ── View State ─────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>('list');
  const [selectedJadwal, setSelectedJadwal] = useState<JadwalWithUnit | null>(null);
  const [jadwalItems, setJadwalItems] = useState<JadwalItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Search State ───────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ── Form State ─────────────────────────────────────────────
  const [editingJadwal, setEditingJadwal] = useState<JadwalWithUnit | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nama_jadwal: '',
    unit_id: '',
    tahun_ajaran: getCurrentTahunAjaran(),
    semester: '1',
    keterangan: '',
    catatan: '',
    status: 'Draft',
  });
  const [slots, setSlots] = useState<SlotData[]>(DEFAULT_SLOTS);
  const [cellValues, setCellValues] = useState<Record<string, { mata_pelajaran: string; pengajar: string }>>({});
  const [activeDays, setActiveDays] = useState<string[]>(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);

  // ── Mobile Accordion State ─────────────────────────────────
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(HARI_OPTIONS));

  // ── Confirm Dialog State ───────────────────────────────────
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as 'danger' | 'primary',
    loading: false,
  });

  // ── Refs ───────────────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));

  const filteredList = jadwalList.filter((j) => {
    if (search && !j.nama_jadwal.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Data Fetching ──────────────────────────────────────────
  const fetchUnits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      setUnits(data || []);
    } catch (err) {
      console.error('Gagal memuat unit:', err);
    }
  }, []);

  const fetchJadwal = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jadwal')
        .select('*, unit:units(id, code, name, color)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJadwalList((data || []) as JadwalWithUnit[]);
    } catch (err) {
      console.error('Gagal memuat jadwal:', err);
      addToast('error', 'Gagal memuat data jadwal');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchJadwalItems = useCallback(
    async (jadwalId: string) => {
      setLoadingDetail(true);
      try {
        const { data, error } = await supabase
          .from('jadwal_items')
          .select('*')
          .eq('jadwal_id', jadwalId)
          .order('urutan');
        if (error) throw error;
        setJadwalItems(data || []);
      } catch (err) {
        console.error('Gagal memuat item jadwal:', err);
        addToast('error', 'Gagal memuat detail jadwal');
      } finally {
        setLoadingDetail(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    fetchJadwal();
  }, [fetchJadwal]);

  // ── View Transitions ───────────────────────────────────────
  const goToList = useCallback(() => {
    setView('list');
    setSelectedJadwal(null);
    setJadwalItems([]);
    fetchJadwal();
  }, [fetchJadwal]);

  const goToDetail = useCallback(
    async (jadwal: JadwalWithUnit) => {
      setSelectedJadwal(jadwal);
      setView('detail');
      await fetchJadwalItems(jadwal.id);
    },
    [fetchJadwalItems]
  );

  const goToCreateForm = useCallback(() => {
    setEditingJadwal(null);
    setFormData({
      nama_jadwal: '',
      unit_id: '',
      tahun_ajaran: getCurrentTahunAjaran(),
      semester: '1',
      keterangan: '',
      catatan: '',
      status: 'Draft',
    });
    setSlots([...DEFAULT_SLOTS]);
    setCellValues({});
    setActiveDays(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);
    setView('form');
  }, []);

  const goToEditForm = useCallback(
    (jadwal: JadwalWithUnit, items: JadwalItem[]) => {
      setEditingJadwal(jadwal);
      setFormData({
        nama_jadwal: jadwal.nama_jadwal,
        unit_id: jadwal.unit_id,
        tahun_ajaran: jadwal.tahun_ajaran,
        semester: String(jadwal.semester),
        keterangan: jadwal.keterangan || '',
        catatan: jadwal.catatan || '',
        status: jadwal.status || 'Draft',
      });

      // Reconstruct slots and cell values from items
      const slotMap = new Map<string, SlotData>();
      const cells: Record<string, { mata_pelajaran: string; pengajar: string }> = {};
      const daysSet = new Set<string>();

      items.forEach((item) => {
        const slotKey = `${item.jam_mulai}-${item.jam_selesai}-${item.nama_slot}`;
        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, {
            jam_mulai: item.jam_mulai,
            jam_selesai: item.jam_selesai,
            nama_slot: item.nama_slot,
          });
        }
        daysSet.add(item.hari);
      });

      const reconstructedSlots = Array.from(slotMap.values());
      setSlots(reconstructedSlots.length > 0 ? reconstructedSlots : [...DEFAULT_SLOTS]);

      items.forEach((item) => {
        const slotIdx = reconstructedSlots.findIndex(
          (s) => s.jam_mulai === item.jam_mulai && s.jam_selesai === item.jam_selesai && s.nama_slot === item.nama_slot
        );
        if (slotIdx >= 0) {
          cells[getCellKey(slotIdx, item.hari)] = {
            mata_pelajaran: item.mata_pelajaran || '',
            pengajar: item.pengajar || '',
          };
        }
      });
      setCellValues(cells);
      setActiveDays(Array.from(daysSet).length > 0 ? Array.from(daysSet) : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);
      setView('form');
    },
    []
  );

  // ── Form Helpers ───────────────────────────────────────────
  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateCell = useCallback(
    (slotIndex: number, hari: string, field: 'mata_pelajaran' | 'pengajar', value: string) => {
      const key = getCellKey(slotIndex, hari);
      setCellValues((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || { mata_pelajaran: '', pengajar: '' }),
          [field]: value,
        },
      }));
    },
    []
  );

  const addSlot = useCallback(() => {
    setSlots((prev) => [...prev, { jam_mulai: '', jam_selesai: '', nama_slot: '' }]);
  }, []);

  const removeSlot = useCallback(
    (index: number) => {
      setSlots((prev) => prev.filter((_, i) => i !== index));
      // Clean up cell values for removed slot
      setCellValues((prev) => {
        const next: typeof prev = {};
        Object.entries(prev).forEach(([key, val]) => {
          const slotIdx = parseInt(key.split('-')[0], 10);
          if (slotIdx !== index) {
            const newIdx = slotIdx > index ? slotIdx - 1 : slotIdx;
            const hari = key.split('-').slice(1).join('-');
            next[getCellKey(newIdx, hari)] = val;
          }
        });
        return next;
      });
    },
    []
  );

  const updateSlot = useCallback((index: number, field: keyof SlotData, value: string) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  const toggleDay = useCallback((hari: string) => {
    setActiveDays((prev) => {
      if (prev.includes(hari)) {
        return prev.filter((d) => d !== hari);
      }
      return [...prev, hari].sort((a, b) => HARI_OPTIONS.indexOf(a) - HARI_OPTIONS.indexOf(b));
    });
  }, []);

  // ── CRUD Handlers ──────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!formData.nama_jadwal.trim()) {
      addToast('warning', 'Nama jadwal wajib diisi');
      return;
    }
    if (!formData.unit_id) {
      addToast('warning', 'Unit wajib dipilih');
      return;
    }

    // Validate slots
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.nama_slot.trim()) {
        addToast('warning', `Slot #${i + 1}: Nama slot wajib diisi`);
        return;
      }
      if (!slot.jam_mulai || !slot.jam_selesai) {
        addToast('warning', `Slot "${slot.nama_slot}": Jam mulai dan selesai wajib diisi`);
        return;
      }
    }

    setSaving(true);
    try {
      const jadwalPayload = {
        nama_jadwal: formData.nama_jadwal.trim(),
        unit_id: formData.unit_id,
        tahun_ajaran: formData.tahun_ajaran,
        semester: Number(formData.semester),
        keterangan: formData.keterangan || '',
        catatan: formData.catatan || '',
        status: formData.status,
      };

      let jadwalId: string;

      if (editingJadwal) {
        const { error } = await supabase
          .from('jadwal')
          .update(jadwalPayload)
          .eq('id', editingJadwal.id);
        if (error) throw error;
        jadwalId = editingJadwal.id;

        // Delete old items
        const { error: delError } = await supabase
          .from('jadwal_items')
          .delete()
          .eq('jadwal_id', jadwalId);
        if (delError) throw delError;
      } else {
        const { data: newJadwal, error } = await supabase
          .from('jadwal')
          .insert({ ...jadwalPayload, jadwal_id: generateId('JWL') })
          .select()
          .single();
        if (error) throw error;
        jadwalId = newJadwal.id;
      }

      // Build items from slots × activeDays
      const itemsToInsert: Record<string, unknown>[] = [];
      let urutan = 1;
      slots.forEach((slot, slotIdx) => {
        activeDays.forEach((hari) => {
          const key = getCellKey(slotIdx, hari);
          const cell = cellValues[key];
          const mataPelajaran = cell?.mata_pelajaran?.trim() || '';
          const pengajar = cell?.pengajar?.trim() || '';

          itemsToInsert.push({
            jadwal_id: jadwalId,
            hari,
            jam_mulai: slot.jam_mulai,
            jam_selesai: slot.jam_selesai,
            nama_slot: slot.nama_slot,
            mata_pelajaran: mataPelajaran,
            pengajar: pengajar,
            ruangan: '',
            warna: isIstirahat(slot) ? 'gray' : 'indigo',
            urutan: urutan++,
          });
        });
      });

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('jadwal_items')
          .insert(itemsToInsert);
        if (insertError) throw insertError;
      }

      addToast('success', editingJadwal ? 'Jadwal berhasil diperbarui' : 'Jadwal berhasil ditambahkan');
      goToList();
    } catch (err) {
      console.error('Gagal menyimpan jadwal:', err);
      addToast('error', editingJadwal ? 'Gagal memperbarui jadwal' : 'Gagal menambahkan jadwal');
    } finally {
      setSaving(false);
    }
  }, [formData, editingJadwal, slots, cellValues, activeDays, addToast, goToList]);

  const handleDelete = useCallback(
    (jadwal: JadwalWithUnit) => {
      setConfirmState({
        open: true,
        title: 'Hapus Jadwal',
        message: `Yakin ingin menghapus "${jadwal.nama_jadwal}" secara permanen? Semua data slot juga akan dihapus.`,
        variant: 'danger',
        loading: false,
        onConfirm: async () => {
          setConfirmState((prev) => ({ ...prev, loading: true }));
          try {
            const { error: delItemsErr } = await supabase
              .from('jadwal_items')
              .delete()
              .eq('jadwal_id', jadwal.id);
            if (delItemsErr) throw delItemsErr;

            const { error } = await supabase
              .from('jadwal')
              .delete()
              .eq('id', jadwal.id);
            if (error) throw error;

            addToast('success', 'Jadwal berhasil dihapus');
            goToList();
            setConfirmState((prev) => ({ ...prev, open: false, loading: false }));
          } catch (err) {
            console.error('Gagal menghapus jadwal:', err);
            addToast('error', 'Gagal menghapus jadwal');
            setConfirmState((prev) => ({ ...prev, loading: false }));
          }
        },
      });
    },
    [addToast, goToList]
  );

  // ── Screenshot ─────────────────────────────────────────────
  const handleScreenshot = useCallback(async () => {
    if (!screenshotRef.current || !selectedJadwal) return;

    try {
      addToast('info', 'Membuat gambar jadwal...');

      const canvas = await html2canvas(screenshotRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const fileName = `Jadwal_${selectedJadwal.nama_jadwal.replace(/\s+/g, '_')}.png`;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');

      addToast('success', 'Gambar jadwal berhasil dibuat');
    } catch (err) {
      console.error('Gagal membuat screenshot:', err);
      addToast('error', 'Gagal membuat gambar jadwal');
    }
  }, [selectedJadwal, addToast]);

  const handleShare = useCallback(async () => {
    if (!screenshotRef.current || !selectedJadwal) return;

    try {
      const canvas = await html2canvas(screenshotRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const fileName = `Jadwal_${selectedJadwal.nama_jadwal.replace(/\s+/g, '_')}.png`;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Gagal membagikan jadwal:', err);
      addToast('error', 'Gagal membagikan jadwal');
    }
  }, [selectedJadwal, addToast]);

  // ── Toggle accordion ───────────────────────────────────────
  const toggleDayAccordion = useCallback((hari: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(hari)) {
        next.delete(hari);
      } else {
        next.add(hari);
      }
      return next;
    });
  }, []);

  // ── Build grid data for detail view ────────────────────────
  const buildGridFromItems = useCallback(
    (items: JadwalItem[]) => {
      // Extract unique slots in order
      const slotMap = new Map<string, SlotData>();
      const slotOrder: string[] = [];
      items.forEach((item) => {
        const key = `${item.jam_mulai}|${item.jam_selesai}|${item.nama_slot}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, {
            jam_mulai: item.jam_mulai,
            jam_selesai: item.jam_selesai,
            nama_slot: item.nama_slot,
          });
          slotOrder.push(key);
        }
      });

      const gridSlots = slotOrder.map((k) => slotMap.get(k)!);

      // Build cells
      const gridCells: Record<string, { mata_pelajaran: string; pengajar: string }> = {};
      items.forEach((item) => {
        const slotKey = `${item.jam_mulai}|${item.jam_selesai}|${item.nama_slot}`;
        const slotIdx = slotOrder.indexOf(slotKey);
        if (slotIdx >= 0) {
          gridCells[getCellKey(slotIdx, item.hari)] = {
            mata_pelajaran: item.mata_pelajaran || '',
            pengajar: item.pengajar || '',
          };
        }
      });

      // Determine active days
      const days = Array.from(new Set(items.map((i) => i.hari)));
      days.sort((a, b) => HARI_OPTIONS.indexOf(a) - HARI_OPTIONS.indexOf(b));

      return { gridSlots, gridCells, days };
    },
    []
  );

  // ── LIST VIEW ──────────────────────────────────────────────
  const renderListView = () => (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Pelajaran"
        description="Kelola jadwal pelajaran kelas dan mata pelajaran"
        action={
          <button
            onClick={goToCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Tambah Jadwal Baru
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari nama jadwal..."
          className="sm:w-72"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} />}
          title="Belum ada jadwal"
          description="Buat jadwal pelajaran baru untuk mengatur jadwal kelas"
          action={
            <button
              onClick={goToCreateForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Tambah Jadwal Baru
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredList.map((jadwal) => (
            <div
              key={jadwal.id}
              onClick={() => goToDetail(jadwal)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                    {jadwal.nama_jadwal}
                  </h3>
                </div>
                <StatusBadge status={jadwal.status || 'Draft'} />
              </div>

              <div className="flex items-center gap-2 mb-3">
                {jadwal.unit ? (
                  <UnitBadge unitName={jadwal.unit.name} />
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {jadwal.tahun_ajaran}
                </span>
                <span>Semester {jadwal.semester}</span>
              </div>

              {jadwal.keterangan && (
                <p className="mt-2 text-xs text-gray-400 truncate">{jadwal.keterangan}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────
  const renderDetailView = () => {
    if (!selectedJadwal) return null;

    const { gridSlots, gridCells, days } =
      jadwalItems.length > 0
        ? buildGridFromItems(jadwalItems)
        : { gridSlots: [], gridCells: {}, days: [] };

    const activeDaysForGrid = days.length > 0 ? days : activeDays;
    const slotsForGrid = gridSlots.length > 0 ? gridSlots : slots;

    return (
      <div className="space-y-6">
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goToList}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Kembali"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                Jadwal {selectedJadwal.nama_jadwal}
                {selectedJadwal.unit && <UnitBadge unitName={selectedJadwal.unit.name} />}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {selectedJadwal.tahun_ajaran} &middot; Semester {selectedJadwal.semester}
                {selectedJadwal.keterangan && ` · ${selectedJadwal.keterangan}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScreenshot}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Screenshot"
            >
              <Camera size={16} />
              <span className="hidden sm:inline">Screenshot</span>
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Bagikan"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Bagikan</span>
            </button>
            <button
              onClick={() => goToEditForm(selectedJadwal, jadwalItems)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Edit2 size={16} />
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedJadwal)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 size={16} />
              Hapus
            </button>
          </div>
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : jadwalItems.length === 0 ? (
          <EmptyState
            icon={<Clock size={48} />}
            title="Jadwal kosong"
            description="Belum ada slot jadwal. Edit jadwal ini untuk menambahkan slot."
            action={
              <button
                onClick={() => goToEditForm(selectedJadwal, jadwalItems)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Edit2 size={16} />
                Edit Jadwal
              </button>
            }
          />
        ) : (
          <>
            {/* Desktop: Full Grid Table */}
            <div className="hidden md:block">
              <div ref={screenshotRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Screenshot Header (visible only in capture) */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                  <div className="text-center">
                    <p className="text-xs font-medium opacity-80 tracking-wider uppercase">Jadwal Pelajaran</p>
                    <h2 className="text-lg font-bold mt-1">{selectedJadwal.nama_jadwal}</h2>
                    <p className="text-xs opacity-80 mt-1">
                      {selectedJadwal.tahun_ajaran} &middot; Semester {selectedJadwal.semester}
                      {selectedJadwal.unit && ` · ${selectedJadwal.unit.name}`}
                    </p>
                  </div>
                </div>

                <div ref={gridRef} className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-3 text-xs font-semibold text-gray-600 min-w-[140px]">
                          Waktu
                        </th>
                        {activeDaysForGrid.map((hari) => (
                          <th
                            key={hari}
                            className={cn(
                              'border-b border-r border-gray-200 px-3 py-3 text-sm font-semibold text-white text-center min-w-[140px] last:border-r-0',
                              HARI_BG_COLORS[hari] || 'bg-indigo-600'
                            )}
                          >
                            {HARI_HEADER_TEXT[hari] || hari}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slotsForGrid.map((slot, slotIdx) => {
                        const isBreak = isIstirahat(slot);
                        return (
                          <tr key={slotIdx} className={cn(isBreak && 'bg-gray-50')}>
                            <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-3 py-2.5">
                              <div className={cn('text-xs', isBreak ? 'text-gray-400 italic' : 'font-medium text-gray-700')}>
                                {slot.nama_slot}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {slot.jam_mulai} - {slot.jam_selesai}
                              </div>
                            </td>
                            {activeDaysForGrid.map((hari) => {
                              const key = getCellKey(slotIdx, hari);
                              const cell = gridCells[key];
                              const hasContent = cell?.mata_pelajaran;

                              if (isBreak) {
                                return (
                                  <td
                                    key={hari}
                                    className="border-b border-r border-gray-200 px-3 py-2.5 text-center last:border-r-0"
                                  >
                                    <span className="text-xs text-gray-300 italic">Istirahat</span>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={hari}
                                  className="border-b border-r border-gray-200 px-3 py-2.5 last:border-r-0"
                                >
                                  {hasContent ? (
                                    <div className="bg-indigo-50 rounded-lg p-2 min-h-[48px]">
                                      <p className="text-sm font-semibold text-indigo-800 leading-tight">
                                        {cell.mata_pelajaran}
                                      </p>
                                      {cell.pengajar && (
                                        <p className="text-xs text-indigo-500 mt-0.5">{cell.pengajar}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="min-h-[48px]" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedJadwal.catatan && (
                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Catatan:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedJadwal.catatan}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Day Accordion */}
            <div className="md:hidden space-y-3">
              {/* Screenshot capture div (off-screen for mobile) */}
              <div className="absolute -left-[9999px] top-0" style={{ width: '900px' }}>
                <div ref={screenshotRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                    <div className="text-center">
                      <p className="text-xs font-medium opacity-80 tracking-wider uppercase">Jadwal Pelajaran</p>
                      <h2 className="text-lg font-bold mt-1">{selectedJadwal.nama_jadwal}</h2>
                      <p className="text-xs opacity-80 mt-1">
                        {selectedJadwal.tahun_ajaran} &middot; Semester {selectedJadwal.semester}
                        {selectedJadwal.unit && ` · ${selectedJadwal.unit.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="bg-gray-50 border-b border-r border-gray-200 px-3 py-3 text-xs font-semibold text-gray-600 min-w-[140px]">
                            Waktu
                          </th>
                          {activeDaysForGrid.map((hari) => (
                            <th
                              key={hari}
                              className={cn(
                                'border-b border-r border-gray-200 px-3 py-3 text-sm font-semibold text-white text-center min-w-[140px] last:border-r-0',
                                HARI_BG_COLORS[hari] || 'bg-indigo-600'
                              )}
                            >
                              {hari}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slotsForGrid.map((slot, slotIdx) => {
                          const isBreak = isIstirahat(slot);
                          return (
                            <tr key={slotIdx} className={cn(isBreak && 'bg-gray-50')}>
                              <td className="bg-white border-b border-r border-gray-200 px-3 py-2.5">
                                <div className={cn('text-xs', isBreak ? 'text-gray-400 italic' : 'font-medium text-gray-700')}>
                                  {slot.nama_slot}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {slot.jam_mulai} - {slot.jam_selesai}
                                </div>
                              </td>
                              {activeDaysForGrid.map((hari) => {
                                const key = getCellKey(slotIdx, hari);
                                const cell = gridCells[key];
                                const hasContent = cell?.mata_pelajaran;
                                if (isBreak) {
                                  return (
                                    <td key={hari} className="border-b border-r border-gray-200 px-3 py-2.5 text-center last:border-r-0">
                                      <span className="text-xs text-gray-300 italic">Istirahat</span>
                                    </td>
                                  );
                                }
                                return (
                                  <td key={hari} className="border-b border-r border-gray-200 px-3 py-2.5 last:border-r-0">
                                    {hasContent ? (
                                      <div className="bg-indigo-50 rounded-lg p-2 min-h-[48px]">
                                        <p className="text-sm font-semibold text-indigo-800">{cell.mata_pelajaran}</p>
                                        {cell.pengajar && <p className="text-xs text-indigo-500 mt-0.5">{cell.pengajar}</p>}
                                      </div>
                                    ) : (
                                      <div className="min-h-[48px]" />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {activeDaysForGrid.map((hari) => (
                <div key={hari} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleDayAccordion(hari)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white transition-colors',
                      HARI_BG_COLORS[hari] || 'bg-indigo-600'
                    )}
                  >
                    <span>{hari}</span>
                    {expandedDays.has(hari) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expandedDays.has(hari) && (
                    <div className="divide-y divide-gray-100">
                      {slotsForGrid.map((slot, slotIdx) => {
                        const key = getCellKey(slotIdx, hari);
                        const cell = gridCells[key];
                        const isBreak = isIstirahat(slot);

                        if (isBreak) {
                          return (
                            <div key={slotIdx} className="px-4 py-2 bg-gray-50">
                              <span className="text-xs text-gray-400 italic">{slot.nama_slot}</span>
                              <span className="text-xs text-gray-300 ml-2">
                                {slot.jam_mulai} - {slot.jam_selesai}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div key={slotIdx} className="px-4 py-3">
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-xs font-medium text-gray-500">{slot.nama_slot}</span>
                              <span className="text-xs text-gray-400">
                                {slot.jam_mulai} - {slot.jam_selesai}
                              </span>
                            </div>
                            {cell?.mata_pelajaran ? (
                              <div className="bg-indigo-50 rounded-lg p-2.5">
                                <p className="text-sm font-semibold text-indigo-800">{cell.mata_pelajaran}</p>
                                {cell.pengajar && <p className="text-xs text-indigo-500 mt-0.5">{cell.pengajar}</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-300 italic">-</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {selectedJadwal.catatan && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Catatan:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedJadwal.catatan}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // ── FORM VIEW ──────────────────────────────────────────────
  const renderFormView = () => (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goToList}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Kembali"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {editingJadwal ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}
        </h1>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Informasi Jadwal</h2>

        <Input
          label="Nama Jadwal *"
          value={formData.nama_jadwal}
          onChange={(e) => handleFormChange('nama_jadwal', e.target.value)}
          placeholder="Contoh: Jadwal Kelas 3A Semester 1"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Unit *"
            value={formData.unit_id}
            onChange={(e) => handleFormChange('unit_id', e.target.value)}
            options={unitOptions}
            placeholder="Pilih unit..."
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => handleFormChange('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tahun Ajaran *"
            value={formData.tahun_ajaran}
            onChange={(e) => handleFormChange('tahun_ajaran', e.target.value)}
            options={TAHUN_AJARAN_OPTIONS}
          />
          <Select
            label="Semester *"
            value={formData.semester}
            onChange={(e) => handleFormChange('semester', e.target.value)}
            options={SEMESTER_OPTIONS}
          />
        </div>

        <Input
          label="Keterangan"
          value={formData.keterangan}
          onChange={(e) => handleFormChange('keterangan', e.target.value)}
          placeholder="Deskripsi singkat jadwal"
        />

        <Textarea
          label="Catatan"
          value={formData.catatan}
          onChange={(e) => handleFormChange('catatan', e.target.value)}
          placeholder="Catatan tambahan..."
          rows={2}
        />
      </div>

      {/* Day Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Hari Aktif</h2>
        <div className="flex flex-wrap gap-2">
          {HARI_OPTIONS.map((hari) => {
            const isActive = activeDays.includes(hari);
            return (
              <button
                key={hari}
                onClick={() => toggleDay(hari)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                  isActive
                    ? cn('text-white', HARI_BG_COLORS[hari] || 'bg-indigo-600', 'border-transparent')
                    : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50'
                )}
              >
                {hari}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Slot Waktu</h2>
          <button
            onClick={addSlot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus size={14} />
            Tambah Slot
          </button>
        </div>

        <div className="space-y-3">
          {slots.map((slot, idx) => {
            const isBreak = isIstirahat(slot);
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  isBreak ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                )}
              >
                <div className="text-gray-300">
                  <GripVertical size={16} />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={slot.nama_slot}
                    onChange={(e) => updateSlot(idx, 'nama_slot', e.target.value)}
                    placeholder="Nama slot"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <input
                    type="time"
                    value={slot.jam_mulai}
                    onChange={(e) => updateSlot(idx, 'jam_mulai', e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <input
                    type="time"
                    value={slot.jam_selesai}
                    onChange={(e) => updateSlot(idx, 'jam_selesai', e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => removeSlot(idx)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Hapus slot"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Grid Editor */}
      {activeDays.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Isi Jadwal</h2>
          <p className="text-sm text-gray-500">Isi mata pelajaran dan pengajar untuk setiap slot waktu.</p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-600 text-left min-w-[120px] sticky left-0 z-10">
                    Slot
                  </th>
                  {activeDays.map((hari) => (
                    <th
                      key={hari}
                      className={cn(
                        'border border-gray-200 px-2 py-2.5 text-xs font-semibold text-white text-center min-w-[140px]',
                        HARI_BG_COLORS[hari] || 'bg-indigo-600'
                      )}
                    >
                      {hari}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, slotIdx) => {
                  const isBreak = isIstirahat(slot);
                  return (
                    <tr key={slotIdx} className={cn(isBreak && 'bg-gray-50')}>
                      <td className="sticky left-0 z-10 bg-white border border-gray-200 px-3 py-2">
                        <div className={cn('text-xs font-medium', isBreak ? 'text-gray-400 italic' : 'text-gray-700')}>
                          {slot.nama_slot || `Slot ${slotIdx + 1}`}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {slot.jam_mulai} - {slot.jam_selesai}
                        </div>
                      </td>
                      {activeDays.map((hari) => {
                        const key = getCellKey(slotIdx, hari);
                        const cell = cellValues[key];

                        if (isBreak) {
                          return (
                            <td
                              key={hari}
                              className="border border-gray-200 px-2 py-2 text-center"
                            >
                              <span className="text-xs text-gray-300 italic">Istirahat</span>
                            </td>
                          );
                        }

                        return (
                          <td key={hari} className="border border-gray-200 px-1.5 py-1.5 align-top">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={cell?.mata_pelajaran || ''}
                                onChange={(e) => updateCell(slotIdx, hari, 'mata_pelajaran', e.target.value)}
                                placeholder="Mapel"
                                className="w-full px-2 py-1.5 text-xs border-0 bg-indigo-50 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-indigo-300"
                              />
                              <input
                                type="text"
                                value={cell?.pengajar || ''}
                                onChange={(e) => updateCell(slotIdx, hari, 'pengajar', e.target.value)}
                                placeholder="Pengajar"
                                className="w-full px-2 py-1 text-xs border-0 bg-gray-50 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-300"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-2 pb-6">
        <button
          onClick={goToList}
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
          {saving ? 'Menyimpan...' : editingJadwal ? 'Simpan Perubahan' : 'Simpan Jadwal'}
        </button>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() => setConfirmState((prev) => ({ ...prev, open: false, loading: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        loading={confirmState.loading}
        confirmText={confirmState.loading ? 'Memproses...' : 'Ya, Hapus'}
        cancelText="Batal"
      />
    </div>
  );

  // ── Main Render ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {view === 'list' && renderListView()}
      {view === 'detail' && renderDetailView()}
      {view === 'form' && renderFormView()}

      {/* Confirm Dialog (for list/detail views) */}
      {view !== 'form' && (
        <ConfirmDialog
          open={confirmState.open}
          onClose={() => setConfirmState((prev) => ({ ...prev, open: false, loading: false }))}
          onConfirm={confirmState.onConfirm}
          title={confirmState.title}
          message={confirmState.message}
          variant={confirmState.variant}
          loading={confirmState.loading}
          confirmText={confirmState.loading ? 'Memproses...' : 'Ya, Lanjutkan'}
          cancelText="Batal"
        />
      )}
    </div>
  );
}
