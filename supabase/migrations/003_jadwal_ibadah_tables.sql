-- ============================================================
-- JADWAL IBADAH — Tabel untuk jadwal ibadah dan holy morning
-- ============================================================
-- Jalankan ini SETELAH menghapus tabel jadwal & jadwal_items lama
-- (jika ada). Uncomment baris DROP di bawah jika diperlukan.
-- ============================================================

-- DROP TABLE IF EXISTS jadwal_items CASCADE;
-- DROP TABLE IF EXISTS jadwal CASCADE;

-- ============================================================
-- 1. JADWAL_IBADAH — Jadwal Ibadah dan Pelayan dalam Ibadah Pegawai
-- ============================================================
CREATE TABLE IF NOT EXISTS jadwal_ibadah (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tahun_ajaran TEXT NOT NULL,               -- '2026-2027'
  bulan TEXT NOT NULL,                       -- 'JULI', 'AGUSTUS', dst
  tanggal TEXT NOT NULL,                     -- '12 Juli 2026 HUT SKL'
  pelayan_ibadah TEXT,                       -- 'GKI dan SKL'
  pemberita_firman TEXT,                     -- 'Ev. Ratnajani Muljadi S.Th'
  tema_ibadah_bulanan TEXT,                  -- 'HOLY THOUGHT FOR GOD'
  nas_alkitab TEXT,                          -- 'PHIL. 4:8'
  catatan TEXT,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jadwal_ibadah_ta ON jadwal_ibadah(tahun_ajaran);
CREATE INDEX idx_jadwal_ibadah_bulan ON jadwal_ibadah(bulan);

-- ============================================================
-- 2. JADWAL_HOLY_MORNING — Jadwal Pelayan Firman Holy Morning
-- ============================================================
CREATE TABLE IF NOT EXISTS jadwal_holy_morning (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tahun_ajaran TEXT NOT NULL,               -- '2026-2027'
  bulan TEXT NOT NULL,                       -- 'JULI', 'AGUSTUS', dst
  tanggal TEXT NOT NULL,                     -- '7 Juli 2026'
  christian_worldview TEXT,                  -- tema worldview
  profil TEXT,                               -- profil pelajar
  bestra TEXT,                               -- BESTRA (pola asuh)
  karakter TEXT,                             -- karakter yang dikembangkan
  tema_bulanan TEXT,                         -- tema bulanan
  tema_mingguan TEXT,                        -- tema mingguan
  nas_alkitab TEXT,                          -- 'PHIL. 4:8'
  tujuan TEXT,                               -- tujuan ibadah
  pelayan_holy_morning TEXT,                 -- nama pelayan
  keterangan TEXT,                           -- catatan tambahan
  catatan TEXT,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jadwal_hm_ta ON jadwal_holy_morning(tahun_ajaran);
CREATE INDEX idx_jadwal_hm_bulan ON jadwal_holy_morning(bulan);

-- ============================================================
-- TRIGGERS — Auto-update updated_at
-- ============================================================
CREATE TRIGGER update_jadwal_ibadah_updated_at
  BEFORE UPDATE ON jadwal_ibadah
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jadwal_holy_morning_updated_at
  BEFORE UPDATE ON jadwal_holy_morning
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE jadwal_ibadah ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_holy_morning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON jadwal_ibadah FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON jadwal_holy_morning FOR ALL USING (true) WITH CHECK (true);
