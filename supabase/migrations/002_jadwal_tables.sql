-- ============================================================
-- JADWAL — Tabel untuk menyimpan jadwal pelajaran/kegiatan
-- ============================================================

-- Tabel utama jadwal
CREATE TABLE jadwal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jadwal_id TEXT UNIQUE NOT NULL,           -- ID bisnis: 'JWL-xxx'
  nama_jadwal TEXT NOT NULL,                -- 'Jadwal Pelajaran Kelas 1A'
  unit_id UUID REFERENCES units(id),
  tahun_ajaran TEXT NOT NULL,
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  keterangan TEXT,                          -- catatan tambahan
  catatan TEXT,                             -- catatan di bagian bawah jadwal
  status TEXT DEFAULT 'Aktif',              -- Aktif, Nonaktif, Draft
  spreadsheet_row_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jadwal_unit ON jadwal(unit_id);
CREATE INDEX idx_jadwal_ta ON jadwal(tahun_ajaran);

-- Tabel detail jadwal (per slot waktu per hari)
CREATE TABLE jadwal_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jadwal_id UUID REFERENCES jadwal(id) ON DELETE CASCADE NOT NULL,
  hari TEXT NOT NULL,                       -- 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  jam_mulai TIME NOT NULL,                  -- '07:00'
  jam_selesai TIME NOT NULL,                -- '10:00'
  nama_slot TEXT,                           -- 'Pagi', 'Istirahat', 'Siang'
  mata_pelajaran TEXT,                      -- nama mata pelajaran/kegiatan
  pengajar TEXT,                            -- nama pengajar (opsional)
  ruangan TEXT,                             -- nama ruangan (opsional)
  warna TEXT DEFAULT '#e0e7ff',             -- warna cell (hex)
  urutan INTEGER DEFAULT 0,                 -- urutan tampil
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jadwal_items_jadwal ON jadwal_items(jadwal_id);
CREATE INDEX idx_jadwal_items_hari ON jadwal_items(hari);

-- Apply trigger
CREATE TRIGGER update_jadwal_updated_at
  BEFORE UPDATE ON jadwal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jadwal_items_updated_at
  BEFORE UPDATE ON jadwal_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON jadwal FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON jadwal_items FOR ALL USING (true) WITH CHECK (true);
