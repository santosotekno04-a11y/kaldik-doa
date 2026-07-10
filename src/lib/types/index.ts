// ============================================================
// TypeScript Types — Kaldik & Doa
// ============================================================

export interface Unit {
  id: string;
  code: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Kaldik {
  id: string;
  kaldik_id: string;
  tahun_ajaran: string;
  semester: 1 | 2;
  bulan: number;
  tahun: number;
  unit_id: string;
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
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  unit_name?: string;
  unit_color?: string;
}

export interface TemaBulanan {
  id: string;
  tema_id: string;
  tahun_ajaran: string;
  semester: 1 | 2;
  bulan: number;
  tahun: number;
  unit_id: string;
  tema: string | null;
  ayat: string | null;
  profil: string | null;
  karakter: string | null;
  bestra: string | null;
  hbe: string | null;
  hm: string | null;
  catatan_tema: string | null;
  status: string;
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
  unit_name?: string;
}

export interface PerluCek {
  id: string;
  check_id: string;
  source_table: string;
  tahun_ajaran: string | null;
  bulan: number | null;
  tahun: number | null;
  unit_text: string | null;
  tanggal_mentah: string | null;
  nama_kegiatan: string | null;
  kategori: string | null;
  alasan_cek: string | null;
  raw_payload: Record<string, unknown> | null;
  status: string;
  catatan: string | null;
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TanpaTanggal {
  id: string;
  note_id: string;
  tahun_ajaran: string | null;
  bulan: number | null;
  tahun: number | null;
  unit_id: string | null;
  nama_kegiatan: string | null;
  tanggal_mentah: string | null;
  catatan: string | null;
  status: string;
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
  unit_name?: string;
}

export interface Karyawan {
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
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
  unit_name?: string;
}

export interface HariKhusus {
  id: string;
  hari_id: string;
  tanggal: string;
  nama_hari: string;
  jenis: string;
  keterangan: string | null;
  masuk_pokok_doa: boolean;
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PokokDoa {
  id: string;
  doa_id: string;
  tanggal: string;
  bulan: number;
  tahun: number;
  unit_mode: string;
  judul: string | null;
  isi_doa: string | null;
  sumber_data: string | null;
  sumber_id: string | null;
  status_doa: string;
  locked: boolean;
  spreadsheet_row_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
}

export interface ImportLog {
  id: string;
  import_type: string;
  source: string;
  total_rows: number;
  valid_rows: number;
  perlu_cek_rows: number;
  tanpa_tanggal_rows: number;
  rejected_rows: number;
  status: string;
  message: string | null;
  created_at: string;
}

export interface ChangeLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: string;
  trigger_source: string;
  source_name: string;
  target_name: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  skipped_rows: number;
  conflict_rows: number;
  error_rows: number;
  status: string;
  message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface SyncConflict {
  id: string;
  table_name: string;
  source_id: string;
  spreadsheet_data: Record<string, unknown> | null;
  supabase_data: Record<string, unknown> | null;
  reason: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

// Filter types
export interface KaldikFilters {
  tahun_ajaran?: string;
  semester?: number;
  bulan?: number;
  tahun?: number;
  unit_id?: string;
  status?: string;
  kategori?: string;
  search?: string;
}

export interface DashboardSummary {
  totalAgendaBulanIni: number;
  perluCek: number;
  tanpaTanggal: number;
  karyawanAktif: number;
  hariKhususBulanIni: number;
  pokokDoaBulanIni: number;
  agendaTerdekat: Kaldik[];
  lastSync: SyncLog | null;
}
