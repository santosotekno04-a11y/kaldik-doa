"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardPaste,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Loader2,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils/date";
import { generateId } from "@/lib/utils/format";
import { mapUnitTextToCode, mapStatus, parseSpreadsheetDate, parseBoolean, parseIntSafe } from "@/lib/sync/mappers";
import { cn } from "@/lib/utils/cn";

// ---------- types ----------
interface ParsedRow {
  [key: string]: string;
}

interface MappedRow {
  kaldik_id: string;
  tahun_ajaran: string;
  semester: number;
  bulan: number;
  tahun: number;
  unit_id: string | null;
  unit_scope: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  tanggal_mentah: string | null;
  nama_kegiatan: string;
  kategori: string;
  prioritas_doa: number;
  masuk_pokok_doa: boolean;
  catatan_doa: string | null;
  status: string;
  sumber_data: string;
}

type RowStatus = "valid" | "perlu_cek" | "tanpa_tanggal" | "rejected";

interface ValidatedRow {
  index: number;
  raw: ParsedRow;
  mapped: MappedRow | null;
  status: RowStatus;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  total: number;
  valid: number;
  perlu_cek: number;
  tanpa_tanggal: number;
  rejected: number;
  imported: number;
  message: string;
}

// ---------- helpers ----------
const COLUMN_ALIASES: Record<string, string> = {
  // kaldik_id
  kaldikid: "KaldikID",
  "kaldik_id": "KaldikID",
  id: "KaldikID",
  // tahun_ajaran
  tahunajaran: "TahunAjaran",
  "tahun_ajaran": "TahunAjaran",
  "tahun ajaran": "TahunAjaran",
  ta: "TahunAjaran",
  // semester
  semester: "Semester",
  smt: "Semester",
  // bulan
  bulan: "Bulan",
  month: "Bulan",
  // tahun
  tahun: "Tahun",
  year: "Tahun",
  // unit
  unit: "Unit",
  unitid: "Unit",
  "unit_id": "Unit",
  unitscope: "UnitScope",
  "unit_scope": "UnitScope",
  // tanggal
  tanggalmulai: "TanggalMulai",
  "tanggal_mulai": "TanggalMulai",
  "tgl mulai": "TanggalMulai",
  "tanggal awal": "TanggalMulai",
  tanggalselesai: "TanggalSelesai",
  "tanggal_selesai": "TanggalSelesai",
  "tgl selesai": "TanggalSelesai",
  "tanggal akhir": "TanggalSelesai",
  tanggal: "TanggalMulai",
  tanggalmentah: "TanggalMentah",
  "tanggal_mentah": "TanggalMentah",
  // nama kegiatan
  namakegiatan: "NamaKegiatan",
  "nama_kegiatan": "NamaKegiatan",
  "nama kegiatan": "NamaKegiatan",
  kegiatan: "NamaKegiatan",
  nama: "NamaKegiatan",
  // kategori
  kategori: "Kategori",
  category: "Kategori",
  kat: "Kategori",
  // prioritas doa
  prioritasdoa: "PrioritasDoa",
  "prioritas_doa": "PrioritasDoa",
  prioritas: "PrioritasDoa",
  // masuk pokok doa
  masukpokokdoa: "MasukPokokDoa",
  "masuk_pokok_doa": "MasukPokokDoa",
  pokokdoa: "MasukPokokDoa",
  // catatan doa
  catatandoa: "CatatanDoa",
  "catatan_doa": "CatatanDoa",
  catatan: "CatatanDoa",
  // status
  status: "Status",
  // sumber data
  sumberdata: "SumberData",
  "sumber_data": "SumberData",
  sumber: "SumberData",
};

const EXPECTED_HEADERS = [
  "KaldikID",
  "TahunAjaran",
  "Semester",
  "Bulan",
  "Tahun",
  "Unit",
  "UnitScope",
  "TanggalMulai",
  "TanggalSelesai",
  "TanggalMentah",
  "NamaKegiatan",
  "Kategori",
  "PrioritasDoa",
  "MasukPokokDoa",
  "CatatanDoa",
  "Status",
  "SumberData",
];

function normalizeHeader(header: string): string {
  const clean = header.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return COLUMN_ALIASES[clean] || COLUMN_ALIASES[header.trim().toLowerCase()] || header.trim();
}

function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const cleanText = text.replace(/\r/g, "");
  const lines = cleanText.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(cleanText);

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

function mapRow(row: ParsedRow, unitsMap: Map<string, string>): MappedRow {
  const unitCode = mapUnitTextToCode(row.Unit || "");
  const unitId = unitsMap.get(unitCode) || null;

  return {
    kaldik_id: row.KaldikID || generateId("KAL"),
    tahun_ajaran: row.TahunAjaran || "",
    semester: parseIntSafe(row.Semester, 1),
    bulan: parseIntSafe(row.Bulan, 0),
    tahun: parseIntSafe(row.Tahun, 0),
    unit_id: unitId,
    unit_scope: row.UnitScope || "UNIT",
    tanggal_mulai: parseSpreadsheetDate(row.TanggalMulai || ""),
    tanggal_selesai: parseSpreadsheetDate(row.TanggalSelesai || ""),
    tanggal_mentah: row.TanggalMentah || row.TanggalMulai || null,
    nama_kegiatan: row.NamaKegiatan || "",
    kategori: row.Kategori || "Umum",
    prioritas_doa: parseIntSafe(row.PrioritasDoa, 3),
    masuk_pokok_doa: parseBoolean(row.MasukPokokDoa || "true"),
    catatan_doa: row.CatatanDoa || null,
    status: mapStatus(row.Status || "Draft"),
    sumber_data: row.SumberData || "Import CSV",
  };
}

function validateRow(mapped: MappedRow): { status: RowStatus; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mapped.nama_kegiatan) errors.push("NamaKegiatan wajib diisi");
  if (!mapped.tahun_ajaran) errors.push("TahunAjaran wajib diisi");
  if (mapped.bulan < 1 || mapped.bulan > 12) errors.push("Bulan harus 1-12");
  if (mapped.tahun < 2020) errors.push("Tahun tidak valid");

  if (!mapped.tanggal_mulai) {
    warnings.push("Tanpa tanggal");
  }

  if (!mapped.unit_id) {
    warnings.push("Unit tidak dikenali");
  }

  if (errors.length > 0) return { status: "rejected", errors, warnings };

  if (!mapped.tanggal_mulai) return { status: "tanpa_tanggal", errors, warnings };
  if (!mapped.unit_id) return { status: "perlu_cek", errors, warnings };

  return { status: "valid", errors, warnings };
}

// ---------- component ----------
export default function ImportDataPage() {
  const { addToast } = useToast();

  // tab
  const [activeTab, setActiveTab] = useState<"paste" | "upload">("paste");

  // input
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");

  // parsed data
  const [headers, setHeaders] = useState<string[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // units map
  const [unitsMap, setUnitsMap] = useState<Map<string, string>>(new Map());

  // import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // import logs
  const [importLogs, setImportLogs] = useState<
    { id: string; import_type: string; source: string; total_rows: number; valid_rows: number; perlu_cek_rows: number; tanpa_tanggal_rows: number; rejected_rows: number; status: string; message: string | null; created_at: string }[]
  >([]);

  // active filter for preview table
  const [statusFilter, setStatusFilter] = useState<"all" | RowStatus>("all");

  // load units & logs
  useEffect(() => {
    loadUnits();
    loadImportLogs();
  }, []);

  const loadUnits = async () => {
    const { data } = await supabase.from("units").select("id, code, name");
    if (data) {
      const map = new Map<string, string>();
      data.forEach((u) => {
        map.set(u.code, u.id);
        map.set(u.name.toLowerCase(), u.id);
      });
      setUnitsMap(map);
    }
  };

  const loadImportLogs = async () => {
    const { data } = await supabase
      .from("import_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setImportLogs(data);
  };

  // parse & validate
  const handleParse = useCallback(() => {
    const text = activeTab === "paste" ? csvText : csvText;
    if (!text.trim()) {
      addToast("warning", "Tidak ada data CSV untuk diparsing");
      return;
    }

    const { headers: h, rows } = parseCSV(text);
    if (h.length === 0 || rows.length === 0) {
      addToast("error", "Format CSV tidak valid atau kosong");
      return;
    }

    setHeaders(h);

    const validated: ValidatedRow[] = rows.map((row, idx) => {
      const mapped = mapRow(row, unitsMap);
      const { status, errors, warnings } = validateRow(mapped);
      return { index: idx + 1, raw: row, mapped, status, errors, warnings };
    });

    setValidatedRows(validated);
    setShowPreview(true);
    setImportResult(null);
    setStatusFilter("all");

    const validCount = validated.filter((r) => r.status === "valid").length;
    addToast("info", `${validated.length} baris diparsed: ${validCount} valid`);
  }, [csvText, activeTab, unitsMap, addToast]);

  // file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  // import to Supabase
  const handleImport = async () => {
    const validRows = validatedRows.filter((r) => r.status !== "rejected" && r.mapped);
    if (validRows.length === 0) {
      addToast("warning", "Tidak ada data valid untuk diimport");
      return;
    }

    setImporting(true);
    let importedCount = 0;
    let perluCekCount = 0;
    let tanpaTanggalCount = 0;
    const rejectedCount = validatedRows.filter((r) => r.status === "rejected").length;

    try {
      // insert valid rows into kaldik
      for (const row of validRows) {
        if (!row.mapped) continue;

        if (row.status === "tanpa_tanggal") {
          // insert into tanpa_tanggal table
          await supabase.from("tanpa_tanggal").insert({
            note_id: generateId("NT"),
            tahun_ajaran: row.mapped.tahun_ajaran,
            bulan: row.mapped.bulan,
            tahun: row.mapped.tahun,
            unit_id: row.mapped.unit_id,
            nama_kegiatan: row.mapped.nama_kegiatan,
            tanggal_mentah: row.mapped.tanggal_mentah,
            catatan: row.mapped.catatan_doa,
            status: "Pending",
          });
          tanpaTanggalCount++;
        } else if (row.status === "perlu_cek") {
          // insert into perlu_cek table
          await supabase.from("perlu_cek").insert({
            check_id: generateId("CHK"),
            source_table: "kaldik",
            tahun_ajaran: row.mapped.tahun_ajaran,
            bulan: row.mapped.bulan,
            tahun: row.mapped.tahun,
            unit_text: row.raw.Unit || null,
            tanggal_mentah: row.mapped.tanggal_mentah,
            nama_kegiatan: row.mapped.nama_kegiatan,
            kategori: row.mapped.kategori,
            alasan_cek: "Unit tidak dikenali",
            raw_payload: row.raw,
            status: "Pending",
          });
          perluCekCount++;
        } else {
          // valid — insert into kaldik
          const { error } = await supabase.from("kaldik").insert({
            ...row.mapped,
            sumber_data: "Import CSV",
          });
          if (!error) importedCount++;
        }
      }

      // log import
      const logEntry = {
        import_type: "kaldik",
        source: activeTab === "paste" ? "csv_paste" : "file_upload",
        total_rows: validatedRows.length,
        valid_rows: importedCount,
        perlu_cek_rows: perluCekCount,
        tanpa_tanggal_rows: tanpaTanggalCount,
        rejected_rows: rejectedCount,
        status: "success",
        message: `Import berhasil: ${importedCount} kaldik, ${perluCekCount} perlu cek, ${tanpaTanggalCount} tanpa tanggal`,
      };
      await supabase.from("import_logs").insert(logEntry);

      const result: ImportResult = {
        total: validatedRows.length,
        valid: importedCount,
        perlu_cek: perluCekCount,
        tanpa_tanggal: tanpaTanggalCount,
        rejected: rejectedCount,
        imported: importedCount + perluCekCount + tanpaTanggalCount,
        message: `Import selesai! ${importedCount} agenda, ${perluCekCount} perlu cek, ${tanpaTanggalCount} tanpa tanggal`,
      };
      setImportResult(result);
      addToast("success", result.message);
      loadImportLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal import data";
      addToast("error", msg);
      await supabase.from("import_logs").insert({
        import_type: "kaldik",
        source: activeTab === "paste" ? "csv_paste" : "file_upload",
        total_rows: validatedRows.length,
        valid_rows: 0,
        perlu_cek_rows: 0,
        tanpa_tanggal_rows: 0,
        rejected_rows: 0,
        status: "error",
        message: msg,
      });
    } finally {
      setImporting(false);
    }
  };

  // stats
  const stats = {
    total: validatedRows.length,
    valid: validatedRows.filter((r) => r.status === "valid").length,
    perlu_cek: validatedRows.filter((r) => r.status === "perlu_cek").length,
    tanpa_tanggal: validatedRows.filter((r) => r.status === "tanpa_tanggal").length,
    rejected: validatedRows.filter((r) => r.status === "rejected").length,
  };

  const filteredRows =
    statusFilter === "all"
      ? validatedRows
      : validatedRows.filter((r) => r.status === statusFilter);

  const statusColorMap: Record<RowStatus, string> = {
    valid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    perlu_cek: "bg-amber-100 text-amber-700 border-amber-200",
    tanpa_tanggal: "bg-blue-100 text-blue-700 border-blue-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const statusLabelMap: Record<RowStatus, string> = {
    valid: "Valid",
    perlu_cek: "Perlu Cek",
    tanpa_tanggal: "Tanpa Tanggal",
    rejected: "Ditolak",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import data Kaldik dari file CSV atau paste langsung
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("paste")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "paste"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <ClipboardPaste size={16} />
            Paste CSV
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "upload"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Upload size={16} />
            Upload File
          </button>
        </div>

        <div className="p-5 space-y-4">
          {activeTab === "paste" ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tempel data CSV di sini
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`KaldikID,TahunAjaran,Semester,Bulan,Tahun,Unit,TanggalMulai,TanggalSelesai,NamaKegiatan,Kategori,Status
KAL-001,2026-2027,1,7,2026,SD,14/07/2026,14/07/2026,MPLS SD,MPLS,Draft
KAL-002,2026-2027,1,7,2026,TK,14/07/2026,14/07/2026,MPLS TK,MPLS,Draft`}
                rows={8}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono resize-y"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pilih file CSV (.csv)
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors text-sm font-medium">
                  <Upload size={16} />
                  Pilih File
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {fileName && (
                  <span className="text-sm text-slate-600 flex items-center gap-1.5">
                    <FileSpreadsheet size={14} className="text-emerald-500" />
                    {fileName}
                  </span>
                )}
              </div>
              {csvText && (
                <textarea
                  value={csvText}
                  readOnly
                  rows={6}
                  className="mt-3 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono resize-y"
                />
              )}
            </div>
          )}

          <button
            onClick={handleParse}
            disabled={!csvText.trim()}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors",
              csvText.trim()
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-slate-300 cursor-not-allowed"
            )}
          >
            <Eye size={16} />
            Preview & Validasi
          </button>
        </div>
      </div>

      {/* Validation Summary */}
      {showPreview && validatedRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Total Baris</p>
          </div>
          <button
            onClick={() => setStatusFilter(statusFilter === "valid" ? "all" : "valid")}
            className={cn(
              "bg-white rounded-xl border p-4 text-center transition-colors",
              statusFilter === "valid" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <p className="text-2xl font-bold text-emerald-700">{stats.valid}</p>
            </div>
            <p className="text-xs text-slate-500">Valid</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "perlu_cek" ? "all" : "perlu_cek")}
            className={cn(
              "bg-white rounded-xl border p-4 text-center transition-colors",
              statusFilter === "perlu_cek" ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-amber-300"
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              <AlertCircle size={16} className="text-amber-500" />
              <p className="text-2xl font-bold text-amber-700">{stats.perlu_cek}</p>
            </div>
            <p className="text-xs text-slate-500">Perlu Cek</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "tanpa_tanggal" ? "all" : "tanpa_tanggal")}
            className={cn(
              "bg-white rounded-xl border p-4 text-center transition-colors",
              statusFilter === "tanpa_tanggal" ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              <AlertTriangle size={16} className="text-blue-500" />
              <p className="text-2xl font-bold text-blue-700">{stats.tanpa_tanggal}</p>
            </div>
            <p className="text-xs text-slate-500">Tanpa Tanggal</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")}
            className={cn(
              "bg-white rounded-xl border p-4 text-center transition-colors",
              statusFilter === "rejected" ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-red-300"
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              <XCircle size={16} className="text-red-500" />
              <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
            </div>
            <p className="text-xs text-slate-500">Ditolak</p>
          </button>
        </div>
      )}

      {/* Preview Table */}
      {showPreview && validatedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Preview Data
                {statusFilter !== "all" && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    — filter: {statusLabelMap[statusFilter]}
                  </span>
                )}
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {filteredRows.length} baris
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Kegiatan</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Bulan</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Kategori</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.slice(0, 100).map((row) => (
                  <tr
                    key={row.index}
                    className={cn(
                      "transition-colors",
                      row.status === "rejected" && "bg-red-50/40"
                    )}
                  >
                    <td className="px-3 py-2.5 text-sm text-slate-500">{row.index}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border",
                          statusColorMap[row.status]
                        )}
                      >
                        {statusLabelMap[row.status]}
                      </span>
                      {(row.errors.length > 0 || row.warnings.length > 0) && (
                        <div className="mt-1 space-y-0.5">
                          {row.errors.map((e, i) => (
                            <p key={`e-${i}`} className="text-[10px] text-red-500">{e}</p>
                          ))}
                          {row.warnings.map((w, i) => (
                            <p key={`w-${i}`} className="text-[10px] text-amber-500">{w}</p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-800 max-w-[200px] truncate">
                      {row.mapped?.nama_kegiatan || row.raw.NamaKegiatan || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">
                      {row.mapped?.tanggal_mulai || row.raw.TanggalMulai || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">
                      {row.raw.Unit || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">
                      {row.mapped?.bulan || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">
                      {row.mapped?.kategori || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-500 max-w-[150px] truncate">
                      {row.errors.length > 0
                        ? row.errors.join("; ")
                        : row.warnings.length > 0
                          ? row.warnings.join("; ")
                          : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 100 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center">
              Menampilkan 100 dari {filteredRows.length} baris. Filter untuk melihat data spesifik.
            </div>
          )}
        </div>
      )}

      {/* Import Button */}
      {showPreview && validatedRows.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleImport}
            disabled={importing || stats.valid + stats.perlu_cek + stats.tanpa_tanggal === 0}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors",
              importing || stats.valid + stats.perlu_cek + stats.tanpa_tanggal === 0
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {importing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Mengimport...
              </>
            ) : (
              <>
                <Download size={16} />
                Import {stats.valid + stats.perlu_cek + stats.tanpa_tanggal} Baris ke Database
              </>
            )}
          </button>

          {stats.rejected > 0 && (
            <span className="text-xs text-slate-500">
              {stats.rejected} baris ditolak (tidak akan diimport)
            </span>
          )}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-800">Import Berhasil</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-emerald-600">Total diproses:</span>{" "}
              <span className="font-semibold text-emerald-800">{importResult.imported}</span>
            </div>
            <div>
              <span className="text-emerald-600">Kaldik valid:</span>{" "}
              <span className="font-semibold text-emerald-800">{importResult.valid}</span>
            </div>
            <div>
              <span className="text-amber-600">Perlu cek:</span>{" "}
              <span className="font-semibold text-amber-800">{importResult.perlu_cek}</span>
            </div>
            <div>
              <span className="text-blue-600">Tanpa tanggal:</span>{" "}
              <span className="font-semibold text-blue-800">{importResult.tanpa_tanggal}</span>
            </div>
          </div>
        </div>
      )}

      {/* Import Logs */}
      {importLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <FileSpreadsheet size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Riwayat Import</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Tipe</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Sumber</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Total</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Valid</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Perlu Cek</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Tanpa Tgl</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm text-slate-600">
                      {formatDate(log.created_at, "d MMM yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 capitalize">
                      {log.import_type}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">
                      {log.source === "csv_paste" ? "Paste CSV" : log.source === "file_upload" ? "Upload File" : log.source}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-center">
                      {log.total_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-emerald-600 text-center font-medium">
                      {log.valid_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-amber-600 text-center">
                      {log.perlu_cek_rows}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-blue-600 text-center">
                      {log.tanpa_tanggal_rows}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
                          log.status === "success"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        )}
                      >
                        {log.status === "success" ? "Berhasil" : "Gagal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
