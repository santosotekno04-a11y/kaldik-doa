-- ============================================================
-- KALDIK & DOA — Supabase Database Schema
-- ============================================================
-- Jalankan script ini di Supabase SQL Editor
-- Pastikan urutan eksekusi sesuai (tabel induk duluan)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. UNITS — Master Unit
-- ============================================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,        -- 'U001', 'U002', dst
  name TEXT UNIQUE NOT NULL,        -- 'Universal', 'TK', 'SD', 'SMP', 'Manajemen'
  color TEXT DEFAULT 'gray',        -- badge color: gray, rose, blue, purple, green
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default units
INSERT INTO units (code, name, color) VALUES
  ('U001', 'Universal', 'gray'),
  ('U002', 'TK', 'rose'),
  ('U003', 'SD', 'blue'),
  ('U004', 'SMP', 'purple'),
  ('U005', 'Manajemen', 'green');

-- ============================================================
-- 2. KALDIK — Kalender Pendidikan / Agenda Kegiatan
-- ============================================================
CREATE TABLE kaldik (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kaldik_id TEXT UNIQUE NOT NULL,           -- ID bisnis: 'KAL-xxx'
  tahun_ajaran TEXT NOT NULL,               -- '2026-2027'
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id),
  unit_scope TEXT DEFAULT 'UNIT',           -- 'UNIT' atau 'ALL'
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  tanggal_mentah TEXT,                      -- tanggal asli dari spreadsheet
  nama_kegiatan TEXT NOT NULL,
  kategori TEXT DEFAULT 'Umum',             -- Ibadah, Ujian, Libur, Umum, dst
  prioritas_doa INTEGER DEFAULT 3,          -- 1-11 (prioritas generate doa)
  masuk_pokok_doa BOOLEAN DEFAULT true,
  catatan_doa TEXT,
  status TEXT DEFAULT 'Draft',              -- Draft, Valid, Perlu Cek, Final, Dibatalkan, Diarsipkan
  sumber_data TEXT DEFAULT 'Manual',        -- Manual, Import, Sync
  spreadsheet_row_id INTEGER,               -- nomor baris di spreadsheet (untuk trace)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kaldik_bulan_tahun ON kaldik(bulan, tahun);
CREATE INDEX idx_kaldik_unit ON kaldik(unit_id);
CREATE INDEX idx_kaldik_status ON kaldik(status);
CREATE INDEX idx_kaldik_tanggal ON kaldik(tanggal_mulai, tanggal_selesai);

-- ============================================================
-- 3. TEMA_BULANAN — Tema per Unit per Bulan
-- ============================================================
CREATE TABLE tema_bulanan (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tema_id TEXT UNIQUE NOT NULL,             -- ID bisnis: 'TM-xxx'
  tahun_ajaran TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id),
  tema TEXT,
  ayat TEXT,
  profil TEXT,
  karakter TEXT,
  bestra TEXT,                              -- BESTRA (pola asuh)
  hbe TEXT,                                 -- HBE (hakikat belajar)
  hm TEXT,                                  -- HM (habitat mutu)
  catatan_tema TEXT,
  status TEXT DEFAULT 'Draft',
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tema_bulan_tahun ON tema_bulanan(bulan, tahun);
CREATE INDEX idx_tema_unit ON tema_bulanan(unit_id);

-- ============================================================
-- 4. PERLU_CEK — Data Ambigu dari Import
-- ============================================================
CREATE TABLE perlu_cek (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_id TEXT UNIQUE NOT NULL,            -- ID bisnis: 'CHK-xxx'
  source_table TEXT DEFAULT 'kaldik',       -- sumber data asal
  tahun_ajaran TEXT,
  bulan INTEGER,
  tahun INTEGER,
  unit_text TEXT,                           -- teks unit asli (belum dinormalisasi)
  tanggal_mentah TEXT,                      -- tanggal asli dari spreadsheet
  nama_kegiatan TEXT,
  kategori TEXT,
  alasan_cek TEXT,                          -- alasan perlu dicek
  raw_payload JSONB,                        -- data mentah asli
  status TEXT DEFAULT 'Pending',            -- Pending, Tervalidasi, Diabaikan
  catatan TEXT,
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. TANPA_TANGGAL — Data Tanpa Tanggal dari Import
-- ============================================================
CREATE TABLE tanpa_tanggal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id TEXT UNIQUE NOT NULL,             -- ID bisnis: 'NT-xxx'
  tahun_ajaran TEXT,
  bulan INTEGER,
  tahun INTEGER,
  unit_id UUID REFERENCES units(id),
  nama_kegiatan TEXT,
  tanggal_mentah TEXT,
  catatan TEXT,
  status TEXT DEFAULT 'Pending',            -- Pending, Dikonversi, Diabaikan
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. KARYAWAN — Data Karyawan
-- ============================================================
CREATE TABLE karyawan (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  karyawan_id TEXT UNIQUE NOT NULL,         -- ID bisnis: 'KRY-xxx'
  nama TEXT NOT NULL,                       -- nama lengkap / panggilan
  unit_id UUID REFERENCES units(id),
  jabatan TEXT,
  tanggal_lahir DATE,
  bulan_lahir INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM tanggal_lahir)) STORED,
  tanggal_masuk DATE,
  status TEXT DEFAULT 'Aktif',              -- Aktif, Nonaktif
  catatan TEXT,
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_karyawan_unit ON karyawan(unit_id);
CREATE INDEX idx_karyawan_lahir ON karyawan(bulan_lahir);

-- ============================================================
-- 7. HARI_KHUSUS — Hari Raya Kristen, Libur Nasional
-- ============================================================
CREATE TABLE hari_khusus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hari_id TEXT UNIQUE NOT NULL,             -- ID bisnis: 'HK-xxx'
  tanggal DATE NOT NULL,
  nama_hari TEXT NOT NULL,
  jenis TEXT DEFAULT 'Kristen',             -- Kristen, Nasional, Sekolah
  keterangan TEXT,
  masuk_pokok_doa BOOLEAN DEFAULT true,
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hari_khusus_tanggal ON hari_khusus(tanggal);

-- ============================================================
-- 8. POKOK_DOA — Hasil Generate Pokok Doa
-- ============================================================
CREATE TABLE pokok_doa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doa_id TEXT UNIQUE NOT NULL,              -- ID bisnis: 'DOA-xxx'
  tanggal DATE NOT NULL,
  bulan INTEGER NOT NULL,
  tahun INTEGER NOT NULL,
  unit_mode TEXT NOT NULL,                  -- 'Universal', 'TK', 'SD', 'SMP', 'Gabungan Semua Unit'
  judul TEXT,
  isi_doa TEXT,
  sumber_data TEXT,                         -- 'Kaldik', 'Hari Khusus', 'Ulang Tahun', 'Sabtu', 'Minggu', 'Umum'
  sumber_id TEXT,                           -- ID sumber (KaldikID, HariID, KaryawanID)
  status_doa TEXT DEFAULT 'Auto Draft',     -- Auto Draft, Edited Manual, Final
  locked BOOLEAN DEFAULT false,
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doa_bulan_tahun ON pokok_doa(bulan, tahun);
CREATE INDEX idx_doa_unit_mode ON pokok_doa(unit_mode);
CREATE INDEX idx_doa_tanggal ON pokok_doa(tanggal);

-- ============================================================
-- 9. SETTINGS — Konfigurasi Aplikasi (Key-Value)
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO settings (key, value, description) VALUES
  ('APP_NAME', 'Kaldik & Pokok Doa Terpadu', 'Nama aplikasi'),
  ('APP_PIN', '1234', 'PIN login admin'),
  ('TA_AKTIF', '2026-2027', 'Tahun ajaran aktif'),
  ('SEMESTER_AKTIF', '1', 'Semester aktif (1 atau 2)'),
  ('GOOGLE_SHEET_ID', '', 'ID Google Spreadsheet'),
  ('SYNC_SECRET_TOKEN', '', 'Secret token untuk endpoint sync'),
  ('LAST_SYNC', '', 'Timestamp sync terakhir'),
  ('SYNC_STATUS', 'idle', 'Status sync: idle, running, success, error');

-- ============================================================
-- 10. IMPORT_LOGS — Log Import Data
-- ============================================================
CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_type TEXT NOT NULL,                -- 'kaldik', 'karyawan', 'tema', dst
  source TEXT DEFAULT 'csv_paste',          -- 'csv_paste', 'file_upload', 'sync'
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  perlu_cek_rows INTEGER DEFAULT 0,
  tanpa_tanggal_rows INTEGER DEFAULT 0,
  rejected_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',            -- pending, processing, success, error
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. CHANGE_LOGS — Log Perubahan Data
-- ============================================================
CREATE TABLE change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,                     -- CREATE, UPDATE, DELETE, VALIDATE, IGNORE, IMPORT
  old_data JSONB,
  new_data JSONB,
  description TEXT,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_change_logs_table ON change_logs(table_name);
CREATE INDEX idx_change_logs_record ON change_logs(record_id);

-- ============================================================
-- 12. SYNC_LOGS — Log Sinkronisasi
-- ============================================================
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type TEXT NOT NULL,                  -- 'weekly', 'manual'
  trigger_source TEXT DEFAULT 'manual',     -- 'manual', 'cron', 'api'
  source_name TEXT DEFAULT 'Google Sheets',
  target_name TEXT DEFAULT 'Supabase',
  total_rows INTEGER DEFAULT 0,
  inserted_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  conflict_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',            -- pending, running, success, error
  message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. SYNC_CONFLICTS — Data Konflik Sinkronisasi
-- ============================================================
CREATE TABLE sync_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  source_id TEXT NOT NULL,                  -- ID data di spreadsheet
  spreadsheet_data JSONB,                   -- data dari spreadsheet
  supabase_data JSONB,                      -- data di supabase
  reason TEXT,                              -- alasan konflik
  status TEXT DEFAULT 'Pending',            -- Pending, Resolved, Ignored
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- FUNCTIONS — Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger ke semua tabel yang punya updated_at
CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kaldik_updated_at
  BEFORE UPDATE ON kaldik
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tema_bulanan_updated_at
  BEFORE UPDATE ON tema_bulanan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perlu_cek_updated_at
  BEFORE UPDATE ON perlu_cek
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tanpa_tanggal_updated_at
  BEFORE UPDATE ON tanpa_tanggal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_karyawan_updated_at
  BEFORE UPDATE ON karyawan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hari_khusus_updated_at
  BEFORE UPDATE ON hari_khusus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pokok_doa_updated_at
  BEFORE UPDATE ON pokok_doa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (Row Level Security) — Aktifkan jika multi-user
-- ============================================================
-- Untuk MVP single admin, RLS bisa dinonaktifkan
-- Aktifkan jika user lebih dari satu

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaldik ENABLE ROW LEVEL SECURITY;
ALTER TABLE tema_bulanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE perlu_cek ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanpa_tanggal ENABLE ROW LEVEL SECURITY;
ALTER TABLE karyawan ENABLE ROW LEVEL SECURITY;
ALTER TABLE hari_khusus ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokok_doa ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Policy: service_role bisa akses semua (untuk server-side operations)
CREATE POLICY "Service role full access" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON kaldik FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tema_bulanan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON perlu_cek FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tanpa_tanggal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON karyawan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON hari_khusus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pokok_doa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON import_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON change_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sync_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sync_conflicts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- VIEWS — Helper views untuk dashboard
-- ============================================================

-- View: Kaldik bulan ini
CREATE OR REPLACE VIEW v_kaldik_bulan_ini AS
SELECT k.*, u.name as unit_name, u.color as unit_color
FROM kaldik k
LEFT JOIN units u ON k.unit_id = u.id
WHERE k.bulan = EXTRACT(MONTH FROM NOW())
  AND k.tahun = EXTRACT(YEAR FROM NOW())
  AND k.status != 'Dibatalkan'
ORDER BY k.tanggal_mulai;

-- View: Karyawan ulang tahun bulan ini
CREATE OR REPLACE VIEW v_ultah_bulan_ini AS
SELECT kr.*, u.name as unit_name
FROM karyawan kr
LEFT JOIN units u ON kr.unit_id = u.id
WHERE EXTRACT(MONTH FROM kr.tanggal_lahir) = EXTRACT(MONTH FROM NOW())
  AND kr.status = 'Aktif'
ORDER BY EXTRACT(DAY FROM kr.tanggal_lahir);

-- View: Pokok doa bulan ini
CREATE OR REPLACE VIEW v_pokok_doa_bulan_ini AS
SELECT *
FROM pokok_doa
WHERE bulan = EXTRACT(MONTH FROM NOW())
  AND tahun = EXTRACT(YEAR FROM NOW())
ORDER BY tanggal;
