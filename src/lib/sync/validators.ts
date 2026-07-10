// Data validators for sync

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Kaldik row
 */
export function validateKaldik(row: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.kaldik_id) errors.push("KaldikID wajib diisi");
  if (!row.tahun_ajaran) errors.push("TahunAjaran wajib diisi");
  if (!row.bulan || (row.bulan as number) < 1 || (row.bulan as number) > 12) {
    errors.push("Bulan harus 1-12");
  }
  if (!row.tahun || (row.tahun as number) < 2020) {
    errors.push("Tahun tidak valid");
  }
  if (!row.nama_kegiatan) errors.push("NamaKegiatan wajib diisi");

  if (!row.tanggal_mulai) {
    warnings.push("TanggalMulai kosong — data akan masuk Tanpa Tanggal");
  }

  if (!row.unit_id) {
    warnings.push("Unit tidak dikenal — data akan masuk Perlu Cek");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Tema Bulanan row
 */
export function validateTema(row: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.tema_id) errors.push("TemaID wajib diisi");
  if (!row.tahun_ajaran) errors.push("TahunAjaran wajib diisi");
  if (!row.bulan) errors.push("Bulan wajib diisi");
  if (!row.tahun) errors.push("Tahun wajib diisi");

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate Karyawan row
 */
export function validateKaryawan(row: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.karyawan_id) errors.push("KaryawanID wajib diisi");
  if (!row.nama) errors.push("Nama wajib diisi");

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate Pokok Doa row
 */
export function validatePokokDoa(row: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.doa_id) errors.push("DoaID wajib diisi");
  if (!row.tanggal) errors.push("Tanggal wajib diisi");
  if (!row.bulan) errors.push("Bulan wajib diisi");
  if (!row.tahun) errors.push("Tahun wajib diisi");

  return { valid: errors.length === 0, errors, warnings };
}
