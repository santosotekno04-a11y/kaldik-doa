"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileDown,
  Printer,
  Eye,
  Loader2,
  BookHeart,
  Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/form-controls";
import { formatDateDisplay, getMonthName } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

// ---------- types ----------
interface KaldikRow {
  id: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  nama_kegiatan: string;
  kategori: string;
  status: string;
  unit_scope: string;
  unit: { name: string; color: string } | null;
}

interface PokokDoaRow {
  id: string;
  tanggal: string;
  judul: string | null;
  isi_doa: string | null;
  sumber_data: string | null;
  unit_mode: string;
  status_doa: string;
}

// ---------- helpers ----------
const BULAN_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: getMonthName(i + 1),
}));

const TAHUN_OPTIONS = [
  { value: "2025", label: "2025" },
  { value: "2026", label: "2026" },
  { value: "2027", label: "2027" },
  { value: "2028", label: "2028" },
];

const UNIT_OPTIONS = [
  { value: "", label: "Semua Unit" },
  { value: "Universal", label: "Universal" },
  { value: "TK", label: "TK" },
  { value: "SD", label: "SD" },
  { value: "SMP", label: "SMP" },
  { value: "Manajemen", label: "Manajemen" },
];

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "-";
  const startStr = formatDateDisplay(start);
  if (!end || start === end) return startStr;
  const endStr = formatDateDisplay(end);
  return `${startStr} — ${endStr}`;
}

function generateKaldikHTML(data: KaldikRow[], bulan: number, tahun: number): string {
  const bulanName = getMonthName(bulan);

  const rows = data
    .sort((a, b) => {
      if (!a.tanggal_mulai && !b.tanggal_mulai) return 0;
      if (!a.tanggal_mulai) return 1;
      if (!b.tanggal_mulai) return -1;
      return a.tanggal_mulai.localeCompare(b.tanggal_mulai);
    })
    .map(
      (k) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;">${formatDateRange(k.tanggal_mulai, k.tanggal_selesai)}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;font-weight:500;">${k.nama_kegiatan}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;text-align:center;">${k.kategori}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;text-align:center;">${k.unit?.name || k.unit_scope || "-"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;text-align:center;">${k.status}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Kaldik — ${bulanName} ${tahun}</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { margin: 1.5cm; }
    }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; text-align: left; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Kalender Pendidikan</h1>
  <p class="subtitle">${bulanName} ${tahun}</p>
  <table>
    <thead>
      <tr>
        <th>Tanggal</th>
        <th>Kegiatan</th>
        <th>Kategori</th>
        <th>Unit</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="footer">Dicetak dari Kaldik & Doa — ${new Date().toLocaleDateString("id-ID")}</p>
</body>
</html>`;
}

function generatePokokDoaHTML(data: PokokDoaRow[], bulan: number, tahun: number): string {
  const bulanName = getMonthName(bulan);

  const items = data
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map(
      (d) => `
      <div class="doa-item">
        <div class="doa-date">${formatDateDisplay(d.tanggal)}</div>
        ${d.judul ? `<div class="doa-title">${d.judul}</div>` : ""}
        <div class="doa-content">${d.isi_doa || "<em>Belum ada isi doa</em>"}</div>
        <div class="doa-meta">${d.sumber_data || ""}${d.unit_mode ? ` — ${d.unit_mode}` : ""}</div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Pokok Doa — ${bulanName} ${tahun}</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { margin: 1.5cm; }
    }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    .doa-item { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    .doa-item:last-child { border-bottom: none; }
    .doa-date { font-size: 12px; color: #6366f1; font-weight: 600; margin-bottom: 2px; }
    .doa-title { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
    .doa-content { font-size: 13px; color: #334155; white-space: pre-wrap; }
    .doa-meta { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Pokok Doa</h1>
  <p class="subtitle">${bulanName} ${tahun}</p>
  ${items}
  <p class="footer">Dicetak dari Kaldik & Doa — ${new Date().toLocaleDateString("id-ID")}</p>
</body>
</html>`;
}

// ---------- component ----------
export default function ExportPage() {
  const { addToast } = useToast();

  const [exportType, setExportType] = useState<"kaldik" | "pokok_doa">("kaldik");
  const [bulan, setBulan] = useState(String(new Date().getMonth() + 1));
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [unit, setUnit] = useState("");

  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  // unit_id map
  const [unitIdMap, setUnitIdMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadUnits = async () => {
      const { data } = await supabase.from("units").select("id, name");
      if (data) {
        const map = new Map<string, string>();
        data.forEach((u) => map.set(u.name, u.id));
        setUnitIdMap(map);
      }
    };
    loadUnits();
  }, []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setHasGenerated(false);

    try {
      const bulanNum = parseInt(bulan);
      const tahunNum = parseInt(tahun);

      if (exportType === "kaldik") {
        let query = supabase
          .from("kaldik")
          .select("id, tanggal_mulai, tanggal_selesai, nama_kegiatan, kategori, status, unit_scope, unit:units(name, color)")
          .eq("bulan", bulanNum)
          .eq("tahun", tahunNum)
          .neq("status", "Dibatalkan")
          .order("tanggal_mulai", { ascending: true });

        if (unit) {
          const unitId = unitIdMap.get(unit);
          if (unitId) query = query.eq("unit_id", unitId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const html = generateKaldikHTML((data || []) as unknown as KaldikRow[], bulanNum, tahunNum);
        setPreviewHtml(html);
      } else {
        let query = supabase
          .from("pokok_doa")
          .select("id, tanggal, judul, isi_doa, sumber_data, unit_mode, status_doa")
          .eq("bulan", bulanNum)
          .eq("tahun", tahunNum)
          .order("tanggal", { ascending: true });

        if (unit) {
          query = query.eq("unit_mode", unit);
        }

        const { data, error } = await query;
        if (error) throw error;

        const html = generatePokokDoaHTML((data || []) as PokokDoaRow[], bulanNum, tahunNum);
        setPreviewHtml(html);
      }

      setHasGenerated(true);
      addToast("success", "Preview berhasil dibuat");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal generate preview";
      addToast("error", msg);
    } finally {
      setLoading(false);
    }
  }, [exportType, bulan, tahun, unit, unitIdMap, addToast]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = exportType === "kaldik" ? "kaldik" : "pokok-doa";
    a.download = `${suffix}-${getMonthName(parseInt(bulan))}-${tahun}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export data Kaldik dan Pokok Doa ke HTML untuk dicetak
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Export Type */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Tipe Export</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setExportType("kaldik"); setHasGenerated(false); }}
                className={cn(
                  "flex items-center gap-2 flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                  exportType === "kaldik"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "bg-white border-slate-300 text-slate-600 hover:border-indigo-200"
                )}
              >
                <Calendar size={16} />
                Kaldik
              </button>
              <button
                onClick={() => { setExportType("pokok_doa"); setHasGenerated(false); }}
                className={cn(
                  "flex items-center gap-2 flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                  exportType === "pokok_doa"
                    ? "bg-purple-50 border-purple-300 text-purple-700"
                    : "bg-white border-slate-300 text-slate-600 hover:border-purple-200"
                )}
              >
                <BookHeart size={16} />
                Pokok Doa
              </button>
            </div>
          </div>

          {/* Bulan */}
          <Select
            label="Bulan"
            value={bulan}
            onChange={(e) => { setBulan(e.target.value); setHasGenerated(false); }}
            options={BULAN_OPTIONS}
          />

          {/* Tahun */}
          <Select
            label="Tahun"
            value={tahun}
            onChange={(e) => { setTahun(e.target.value); setHasGenerated(false); }}
            options={TAHUN_OPTIONS}
          />

          {/* Unit */}
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => { setUnit(e.target.value); setHasGenerated(false); }}
            options={UNIT_OPTIONS}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors",
              loading
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Memuat...
              </>
            ) : (
              <>
                <Eye size={16} />
                Generate Preview
              </>
            )}
          </button>

          {hasGenerated && (
            <>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Printer size={16} />
                Print
              </button>
              <button
                onClick={handleDownloadHtml}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FileDown size={16} />
                Download HTML
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      {hasGenerated && previewHtml && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Preview Export</h2>
            </div>
            <span className="text-xs text-slate-500">
              {exportType === "kaldik" ? "Kaldik" : "Pokok Doa"} — {getMonthName(parseInt(bulan))} {tahun}
              {unit ? ` — ${unit}` : ""}
            </span>
          </div>
          <div
            className="p-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml.replace(/<!DOCTYPE[^>]*>|<html[^>]*>|<\/html>|<head[\s\S]*?<\/head>|<body[^>]*>|<\/body>/g, "") }}
          />
        </div>
      )}

      {/* Empty state */}
      {!hasGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <FileDown size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Belum Ada Preview</h3>
          <p className="text-sm text-slate-500">
            Pilih tipe, bulan, dan tahun, lalu klik &quot;Generate Preview&quot;
          </p>
        </div>
      )}
    </div>
  );
}
