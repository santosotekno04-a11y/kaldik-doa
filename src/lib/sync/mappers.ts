// Spreadsheet → Supabase column mappers

/**
 * Parse date from DD/MM/YYYY to YYYY-MM-DD
 */
export function parseSpreadsheetDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const trimmed = dateStr.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  // DD/MM/YYYY format
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try parsing as Date object
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Parse boolean from string
 */
export function parseBoolean(value: string): boolean {
  const v = value.toLowerCase().trim();
  return v === "true" || v === "1" || v === "yes" || v === "ya";
}

/**
 * Parse integer from string
 */
export function parseIntSafe(value: string, fallback: number = 0): number {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

/**
 * Map unit code from spreadsheet to Supabase unit_id
 * Spreadsheet uses codes like U001, U002, etc.
 */
export const UNIT_CODE_TO_ID: Record<string, string> = {
  U001: "U001",
  U002: "U002",
  U003: "U003",
  U004: "U004",
  U005: "U005",
};

/**
 * Map unit text to code (for fuzzy matching)
 */
export function mapUnitTextToCode(text: string): string {
  const v = text.toLowerCase().trim();
  const map: Record<string, string> = {
    universal: "U001",
    uni: "U001",
    tk: "U002",
    toddler: "U002",
    kb: "U002",
    sd: "U003",
    smp: "U004",
    manajemen: "U005",
    mng: "U005",
    management: "U005",
    u001: "U001",
    u002: "U002",
    u003: "U003",
    u004: "U004",
    u005: "U005",
  };
  return map[v] || text;
}

/**
 * Map status from spreadsheet
 */
export function mapStatus(value: string): string {
  const v = value.toLowerCase().trim();
  const map: Record<string, string> = {
    draft: "Draft",
    valid: "Valid",
    "perlu cek": "Perlu Cek",
    perlucek: "Perlu Cek",
    final: "Final",
    revisi: "Revisi",
    dibatalkan: "Dibatalkan",
    cancel: "Dibatalkan",
    diarsipkan: "Diarsipkan",
    archive: "Diarsipkan",
    aktif: "Aktif",
    nonaktif: "Nonaktif",
    pending: "Pending",
    tervalidasi: "Tervalidasi",
    diabaikan: "Diabaikan",
    dikonversi: "Dikonversi",
  };
  return map[v] || value;
}

/**
 * Map KALDIK row from spreadsheet to Supabase insert/update
 */
export function mapKaldikRow(
  row: Record<string, string>,
  units: Map<string, string>
): Record<string, unknown> {
  const unitCode = mapUnitTextToCode(row.Unit || "");
  const unitId = units.get(unitCode) || null;

  return {
    kaldik_id: row.KaldikID || "",
    tahun_ajaran: row.TahunAjaran || "",
    semester: parseIntSafe(row.Semester, 1),
    bulan: parseIntSafe(row.Bulan, 0),
    tahun: parseIntSafe(row.Tahun, 0),
    unit_id: unitId,
    unit_scope: row.UnitScope || "UNIT",
    tanggal_mulai: parseSpreadsheetDate(row.TanggalMulai || ""),
    tanggal_selesai: parseSpreadsheetDate(row.TanggalSelesai || ""),
    tanggal_mentah: row.TanggalMentah || null,
    nama_kegiatan: row.NamaKegiatan || "",
    kategori: row.Kategori || "Umum",
    prioritas_doa: parseIntSafe(row.PrioritasDoa, 3),
    masuk_pokok_doa: parseBoolean(row.MasukPokokDoa || "false"),
    catatan_doa: row.CatatanDoa || null,
    status: mapStatus(row.Status || "Draft"),
    sumber_data: row.SumberData || "Sync",
    spreadsheet_row_id: null,
  };
}

/**
 * Map TEMA_BULANAN row from spreadsheet to Supabase
 */
export function mapTemaRow(
  row: Record<string, string>,
  units: Map<string, string>
): Record<string, unknown> {
  const unitCode = mapUnitTextToCode(row.Unit || "");
  const unitId = units.get(unitCode) || null;

  return {
    tema_id: row.TemaID || "",
    tahun_ajaran: row.TahunAjaran || "",
    semester: parseIntSafe(row.Semester, 1),
    bulan: parseIntSafe(row.Bulan, 0),
    tahun: parseIntSafe(row.Tahun, 0),
    unit_id: unitId,
    tema: row.Tema || null,
    ayat: row.Ayat || null,
    profil: row.Profil || null,
    karakter: row.Karakter || null,
    bestra: row.BESTRA || null,
    hbe: row.HBE || null,
    hm: row.HM || null,
    catatan_tema: row.CatatanTema || null,
    status: mapStatus(row.Status || "Draft"),
  };
}

/**
 * Map KARYAWAN row from spreadsheet to Supabase
 */
export function mapKaryawanRow(
  row: Record<string, string>,
  units: Map<string, string>
): Record<string, unknown> {
  const unitCode = mapUnitTextToCode(row.Unit || "");
  const unitId = units.get(unitCode) || null;

  return {
    karyawan_id: row.KaryawanID || "",
    nama: row.NamaPanggilan || row.NamaLengkap || "",
    unit_id: unitId,
    jabatan: row.Jabatan || null,
    tanggal_lahir: parseSpreadsheetDate(row.TanggalLahir || ""),
    tanggal_masuk: null,
    status: mapStatus(row.StatusAktif || "Aktif"),
    catatan: row.Catatan || null,
  };
}

/**
 * Map HARI_KHUSUS row from spreadsheet to Supabase
 */
export function mapHariKhususRow(row: Record<string, string>): Record<string, unknown> {
  return {
    hari_id: row.HariID || "",
    tanggal: parseSpreadsheetDate(row.Tanggal || ""),
    nama_hari: row.NamaHari || "",
    jenis: row.Jenis || "Kristen",
    keterangan: row.TemplateDoa || null,
    masuk_pokok_doa: parseBoolean(row.MasukPokokDoa || "true"),
  };
}

/**
 * Map POKOK_DOA row from spreadsheet to Supabase
 */
export function mapPokokDoaRow(row: Record<string, string>): Record<string, unknown> {
  return {
    doa_id: row.DoaID || "",
    tanggal: parseSpreadsheetDate(row.Tanggal || ""),
    bulan: parseIntSafe(row.Bulan, 0),
    tahun: parseIntSafe(row.Tahun, 0),
    unit_mode: row.UnitMode || "Gabungan Semua Unit",
    judul: row.Judul || null,
    isi_doa: row.IsiDoa || null,
    sumber_data: row.SumberData || null,
    sumber_id: row.SumberID || null,
    status_doa: mapStatus(row.StatusDoa || "Auto Draft"),
    locked: parseBoolean(row.Locked || "false"),
  };
}

/**
 * Map SETTING row from spreadsheet to Supabase
 */
export function mapSettingRow(row: Record<string, string>): Record<string, unknown> {
  return {
    key: row.Key || "",
    value: row.Value || null,
    description: row.Description || null,
  };
}
