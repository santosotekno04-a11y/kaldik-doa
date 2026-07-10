-- ============================================================
-- Tambah kolom tanggal_sort (DATE) untuk sorting kronologis
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Tambah kolom ke jadwal_ibadah
ALTER TABLE jadwal_ibadah ADD COLUMN IF NOT EXISTS tanggal_sort DATE;

-- Tambah kolom ke jadwal_holy_morning
ALTER TABLE jadwal_holy_morning ADD COLUMN IF NOT EXISTS tanggal_sort DATE;

-- Buat index untuk sorting cepat
CREATE INDEX IF NOT EXISTS idx_jadwal_ibadah_tanggal_sort ON jadwal_ibadah(tanggal_sort);
CREATE INDEX IF NOT EXISTS idx_jadwal_hm_tanggal_sort ON jadwal_holy_morning(tanggal_sort);
