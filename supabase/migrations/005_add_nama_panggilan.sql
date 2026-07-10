-- Add nama_panggilan and sumber_data columns to karyawan table
ALTER TABLE karyawan ADD COLUMN IF NOT EXISTS nama_panggilan TEXT;
ALTER TABLE karyawan ADD COLUMN IF NOT EXISTS sumber_data TEXT DEFAULT 'Manual';
