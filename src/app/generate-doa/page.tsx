"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { BookHeart, Sparkles, Save, Calendar, ChevronDown, ChevronUp, Check, Loader2 } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader, EmptyState } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase/client";
import { formatDate, getDaysInMonth, getMonthName } from "@/lib/utils/date";
import { generateId } from "@/lib/utils/format";

// --- Types ---
interface HariKhususRow {
  id: string;
  hari_id: string;
  tanggal: string;
  nama_hari: string;
  jenis: string;
  masuk_pokok_doa: boolean;
}

interface KaldikRow {
  id: string;
  kaldik_id: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  nama_kegiatan: string;
  kategori: string;
  prioritas_doa: number;
  masuk_pokok_doa: boolean;
  unit_scope: string;
}

interface KaryawanRow {
  id: string;
  karyawan_id: string;
  nama: string;
  tanggal_lahir: string | null;
}

interface GeneratedDoa {
  doa_id: string;
  tanggal: string;
  bulan: number;
  tahun: number;
  unit_mode: string;
  judul: string;
  isi_doa: string;
  sumber_data: string;
  sumber_id: string;
  status_doa: string;
  locked: boolean;
}

// --- Constants ---
const UNIT_MODES = [
  { value: "Universal", label: "Universal" },
  { value: "TK", label: "TK" },
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "Gabungan Semua Unit", label: "Gabungan Semua Unit" },
];

const BULAN_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: getMonthName(i + 1),
}));

const TAHUN_OPTIONS = [2024, 2025, 2026, 2027, 2028].map((y) => ({
  value: String(y),
  label: String(y),
}));

// --- Template helpers ---
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay(); // 0=Sun, 6=Sat
}

function getDayName(dateStr: string): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[getDayOfWeek(dateStr)];
}

function formatTanggal(tanggal: string): string {
  const d = new Date(tanggal + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// --- Generation Logic ---
async function generateDoaData(
  bulan: number,
  tahun: number,
  unitMode: string
): Promise<GeneratedDoa[]> {
  const daysInMonth = getDaysInMonth(bulan, tahun);

  // Fetch all relevant data in parallel
  const startDate = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const endDate = `${tahun}-${String(bulan).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [hariKhususRes, kaldikRes, karyawanRes] = await Promise.all([
    supabase
      .from("hari_khusus")
      .select("*")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate)
      .eq("masuk_pokok_doa", true),
    supabase
      .from("kaldik")
      .select("*")
      .eq("bulan", bulan)
      .eq("tahun", tahun)
      .eq("masuk_pokok_doa", true)
      .neq("status", "Dibatalkan"),
    supabase
      .from("karyawan")
      .select("id, karyawan_id, nama, tanggal_lahir")
      .eq("status", "Aktif")
      .not("tanggal_lahir", "is", null),
  ]);

  const hariKhususList: HariKhususRow[] = hariKhususRes.data || [];
  const kaldikList: KaldikRow[] = kaldikRes.data || [];
  const karyawanList: KaryawanRow[] = karyawanRes.data || [];

  // Build lookup maps
  const hariKhususMap = new Map<string, HariKhususRow>();
  for (const hk of hariKhususList) {
    hariKhususMap.set(hk.tanggal, hk);
  }

  // Map tanggal → kaldik events (may span multiple days via tanggal_mulai/tanggal_selesai)
  function getKaldikForDate(dateStr: string): KaldikRow[] {
    return kaldikList.filter((k) => {
      if (k.tanggal_mulai && k.tanggal_selesai) {
        return dateStr >= k.tanggal_mulai && dateStr <= k.tanggal_selesai;
      }
      if (k.tanggal_mulai) {
        return k.tanggal_mulai === dateStr;
      }
      return false;
    });
  }

  // Filter karyawan with birthday in this month
  function getBirthdayKaryawan(day: number): KaryawanRow[] {
    return karyawanList.filter((k) => {
      if (!k.tanggal_lahir) return false;
      const d = new Date(k.tanggal_lahir + "T00:00:00");
      return d.getMonth() + 1 === bulan && d.getDate() === day;
    });
  }

  const results: GeneratedDoa[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${tahun}-${String(bulan).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = getDayOfWeek(dateStr);

    let judul = "";
    let isiDoa = "";
    let sumberData = "";
    let sumberId = "";

    // Priority 1: Hari Khusus
    const hk = hariKhususMap.get(dateStr);
    if (hk) {
      judul = hk.nama_hari;
      isiDoa = `Kiranya damai sejahtera ${hk.nama_hari} menyertai seluruh warga sekolah. Amin.`;
      sumberData = "Hari Khusus";
      sumberId = hk.hari_id;
    }

    // Priority 2: Kaldik events (highest priority_doa = lowest number)
    if (!judul) {
      const kaldikEvents = getKaldikForDate(dateStr);
      if (kaldikEvents.length > 0) {
        kaldikEvents.sort((a, b) => a.prioritas_doa - b.prioritas_doa);
        const topEvent = kaldikEvents[0];
        const kategori = topEvent.kategori;

        if (kategori === "Ibadah") {
          judul = topEvent.nama_kegiatan;
          isiDoa = `Tuhan memberkati kegiatan ${topEvent.nama_kegiatan} yang dilaksanakan hari ini. Amin.`;
        } else if (kategori === "Ujian" || kategori === "Asesmen") {
          judul = topEvent.nama_kegiatan;
          isiDoa = `Tuhan memberikan hikmat dan kekuatan kepada seluruh siswa dalam menghadapi ${topEvent.nama_kegiatan}. Amin.`;
        } else if (kategori === "Libur") {
          judul = topEvent.nama_kegiatan;
          isiDoa = `Selamat menikmati hari libur. Kiranya waktu ini menjadi berkat bagi keluarga. Amin.`;
        } else {
          judul = topEvent.nama_kegiatan;
          isiDoa = `Tuhan memberkati ${topEvent.nama_kegiatan} yang dilaksanakan hari ini. Amin.`;
        }
        sumberData = "Kaldik";
        sumberId = topEvent.kaldik_id;
      }
    }

    // Priority 3: Birthday
    if (!judul) {
      const birthdayKaryawan = getBirthdayKaryawan(day);
      if (birthdayKaryawan.length > 0) {
        const names = birthdayKaryawan.map((k) => k.nama).join(", ");
        judul = `Ulang Tahun: ${names}`;
        isiDoa = `Selamat ulang tahun kepada ${names}. Tuhan memberkati dengan kesehatan, kebahagiaan, dan umur panjang. Amin.`;
        sumberData = "Ulang Tahun";
        sumberId = birthdayKaryawan.map((k) => k.karyawan_id).join(",");
      }
    }

    // Priority 4: Saturday
    if (!judul && dow === 6) {
      judul = "Doa Hari Sabtu";
      isiDoa = `Di hari Sabtu ini, kami bersyukur atas berkat Tuhan sepanjang minggu ini. Amin.`;
      sumberData = "Sabtu";
      sumberId = "";
    }

    // Priority 5: Sunday
    if (!judul && dow === 0) {
      judul = "Doa Hari Minggu";
      isiDoa = `Di hari Minggu ini, kami bersyukur atas kebangkitan Kristus. Damai sejahteraNya menyertai kita. Amin.`;
      sumberData = "Minggu";
      sumberId = "";
    }

    // Priority 6: General
    if (!judul) {
      judul = "Doa Harian";
      isiDoa = `Ya Tuhan, berkatilah hari ini. Lindungi dan bimbing seluruh warga sekolah dalam setiap kegiatan. Amin.`;
      sumberData = "Umum";
      sumberId = "";
    }

    results.push({
      doa_id: generateId("DOA"),
      tanggal: dateStr,
      bulan,
      tahun,
      unit_mode: unitMode,
      judul,
      isi_doa: isiDoa,
      sumber_data: sumberData,
      sumber_id: sumberId,
      status_doa: "Auto Draft",
      locked: false,
    });
  }

  return results;
}

// --- Page Component ---
export default function GenerateDoaPage() {
  const { addToast } = useToast();

  // Form state
  const [bulan, setBulan] = useState(String(new Date().getMonth() + 1));
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [unitMode, setUnitMode] = useState("Universal");
  const [overwriteAutoDraft, setOverwriteAutoDraft] = useState(true);
  const [skipEdited, setSkipEdited] = useState(true);
  const [skipFinal, setSkipFinal] = useState(true);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDoa[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedItems(new Set(generated.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setSavedCount(null);
    setGenerated([]);

    try {
      const bulanNum = parseInt(bulan);
      const tahunNum = parseInt(tahun);

      // Fetch existing pokok_doa for this month to check overlaps
      const { data: existingDoa } = await supabase
        .from("pokok_doa")
        .select("tanggal, status_doa, locked")
        .eq("bulan", bulanNum)
        .eq("tahun", tahunNum)
        .eq("unit_mode", unitMode);

      const existingMap = new Map<string, { status_doa: string; locked: boolean }>();
      if (existingDoa) {
        for (const row of existingDoa) {
          existingMap.set(row.tanggal, { status_doa: row.status_doa, locked: row.locked });
        }
      }

      const allGenerated = await generateDoaData(bulanNum, tahunNum, unitMode);

      // Filter based on options
      const filtered = allGenerated.filter((item) => {
        const existing = existingMap.get(item.tanggal);
        if (!existing) return true; // No existing record, include

        if (existing.locked) return false; // Never overwrite locked

        if (existing.status_doa === "Auto Draft" && overwriteAutoDraft) return true;
        if (existing.status_doa === "Edited Manual" && !skipEdited) return true;
        if (existing.status_doa === "Final" && !skipFinal) return true;

        // If skipEdited and skipFinal are true, skip those
        if (existing.status_doa === "Edited Manual" && skipEdited) return false;
        if (existing.status_doa === "Final" && skipFinal) return false;

        return false;
      });

      if (filtered.length === 0) {
        addToast("warning", "Tidak ada doa yang perlu di-generate. Semua tanggal sudah terisi atau di-skip.");
        setGenerating(false);
        return;
      }

      setGenerated(filtered);
      setPreviewOpen(true);
      addToast("success", `${filtered.length} pokok doa berhasil di-generate. Silakan review dan simpan.`);
    } catch (err) {
      console.error("Generate error:", err);
      addToast("error", "Gagal generate pokok doa. Silakan coba lagi.");
    } finally {
      setGenerating(false);
    }
  }, [bulan, tahun, unitMode, overwriteAutoDraft, skipEdited, skipFinal, addToast]);

  const handleSave = useCallback(async () => {
    if (generated.length === 0) return;
    setSaving(true);

    try {
      const bulanNum = parseInt(bulan);
      const tahunNum = parseInt(tahun);

      // If overwriteAutoDraft, delete existing Auto Draft records for this month/unit
      if (overwriteAutoDraft) {
        await supabase
          .from("pokok_doa")
          .delete()
          .eq("bulan", bulanNum)
          .eq("tahun", tahunNum)
          .eq("unit_mode", unitMode)
          .eq("status_doa", "Auto Draft")
          .eq("locked", false);
      }

      // If not skipping edited, delete edited manual records too
      if (!skipEdited) {
        await supabase
          .from("pokok_doa")
          .delete()
          .eq("bulan", bulanNum)
          .eq("tahun", tahunNum)
          .eq("unit_mode", unitMode)
          .eq("status_doa", "Edited Manual")
          .eq("locked", false);
      }

      // If not skipping final, delete final records
      if (!skipFinal) {
        await supabase
          .from("pokok_doa")
          .delete()
          .eq("bulan", bulanNum)
          .eq("tahun", tahunNum)
          .eq("unit_mode", unitMode)
          .eq("status_doa", "Final")
          .eq("locked", false);
      }

      // Insert new records in batches of 50
      const batchSize = 50;
      let insertedCount = 0;
      for (let i = 0; i < generated.length; i += batchSize) {
        const batch = generated.slice(i, i + batchSize);
        const { error } = await supabase.from("pokok_doa").insert(batch);
        if (error) throw error;
        insertedCount += batch.length;
      }

      setSavedCount(insertedCount);
      addToast("success", `${insertedCount} pokok doa berhasil disimpan!`);
      setPreviewOpen(false);
      setGenerated([]);
    } catch (err) {
      console.error("Save error:", err);
      addToast("error", "Gagal menyimpan pokok doa. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }, [generated, bulan, tahun, unitMode, overwriteAutoDraft, skipEdited, skipFinal, addToast]);

  // Group by sumber_data for stats
  const sourceStats = generated.reduce<Record<string, number>>((acc, item) => {
    acc[item.sumber_data] = (acc[item.sumber_data] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate Doa"
        description="Generate pokok doa dari data Kaldik, Hari Khusus, dan Ulang Tahun karyawan"
        action={
          generated.length > 0 && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BookHeart size={16} />
              Lihat Preview ({generated.length})
            </button>
          )
        }
      />

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <Sparkles size={16} className="text-purple-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Parameter Generate</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <Select
            label="Bulan"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            options={BULAN_OPTIONS}
          />
          <Select
            label="Tahun"
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
            options={TAHUN_OPTIONS}
          />
          <Select
            label="Unit Mode"
            value={unitMode}
            onChange={(e) => setUnitMode(e.target.value)}
            options={UNIT_MODES}
          />
        </div>

        {/* Options */}
        <div className="border-t border-slate-100 pt-4 mb-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Opsi Penimpaan Data
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={overwriteAutoDraft}
                onChange={(e) => setOverwriteAutoDraft(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">
                Timpa Auto Draft yang sudah ada
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={skipEdited}
                onChange={(e) => setSkipEdited(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">
                Lewati yang sudah di-edit manual
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={skipFinal}
                onChange={(e) => setSkipFinal(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">
                Lewati yang sudah Final
              </span>
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Menggenerate...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Pokok Doa {getMonthName(parseInt(bulan))} {tahun}
            </>
          )}
        </button>
      </div>

      {/* Success Summary */}
      {savedCount !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Generate Berhasil!</p>
              <p className="text-sm text-emerald-700">
                {savedCount} pokok doa bulan {getMonthName(parseInt(bulan))} {tahun} telah disimpan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview Pokok Doa — ${getMonthName(parseInt(bulan))} ${tahun}`}
        size="xl"
      >
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="text-xs font-medium text-slate-500">Total: {generated.length} doa</span>
            {Object.entries(sourceStats).map(([source, count]) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-white border border-slate-200 text-slate-600"
              >
                {source}: {count}
              </span>
            ))}
            <div className="flex-1" />
            <button
              onClick={expandAll}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Buka Semua
            </button>
            <button
              onClick={collapseAll}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              Tutup Semua
            </button>
          </div>

          {/* List */}
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {generated.map((item, idx) => (
              <div
                key={item.doa_id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-indigo-50 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-indigo-600 leading-none">
                      {new Date(item.tanggal + "T00:00:00").getDate()}
                    </span>
                    <span className="text-[9px] text-indigo-400 leading-none">
                      {getDayName(item.tanggal).slice(0, 3)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.judul}</p>
                    <p className="text-xs text-slate-500">
                      {formatTanggal(item.tanggal)} &middot; {item.sumber_data}
                    </p>
                  </div>
                  {expandedItems.has(idx) ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </button>
                {expandedItems.has(idx) && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700 leading-relaxed">{item.isi_doa}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <StatusBadge status={item.status_doa} />
                      <span className="text-xs text-slate-400">Sumber: {item.sumber_data}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              onClick={() => setPreviewOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Simpan {generated.length} Pokok Doa
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
