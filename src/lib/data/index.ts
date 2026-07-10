import { createServerClient } from '@/lib/supabase/server';
import type { TemaBulanan, Karyawan, HariKhusus, PokokDoa } from '@/lib/types';

const supabase = createServerClient();

// ===================== TEMA BULANAN =====================
export async function getTemaBulanan(filters?: { tahun_ajaran?: string; semester?: number; bulan?: number; unit_id?: string }) {
  let query = supabase.from('tema_bulanan').select('*, unit:units(id, code, name, color)').order('bulan', { ascending: true });
  if (filters?.tahun_ajaran) query = query.eq('tahun_ajaran', filters.tahun_ajaran);
  if (filters?.semester) query = query.eq('semester', filters.semester);
  if (filters?.bulan) query = query.eq('bulan', filters.bulan);
  if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTemaBulanan(data: Partial<TemaBulanan>) {
  const { data: result, error } = await supabase.from('tema_bulanan').insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updateTemaBulanan(id: string, data: Partial<TemaBulanan>) {
  const { data: result, error } = await supabase.from('tema_bulanan').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function deleteTemaBulanan(id: string) {
  const { error } = await supabase.from('tema_bulanan').delete().eq('id', id);
  if (error) throw error;
}

// ===================== PERLU CEK =====================
export async function getPerluCek(filters?: { status?: string; search?: string }) {
  let query = supabase.from('perlu_cek').select('*').order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.search) query = query.ilike('nama_kegiatan', `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function validatePerluCek(id: string, fixedData: Partial<Kaldik>) {
  // Insert into kaldik
  const { error: insertError } = await supabase.from('kaldik').insert(fixedData);
  if (insertError) throw insertError;
  // Mark as validated
  const { error: updateError } = await supabase.from('perlu_cek').update({ status: 'Tervalidasi' }).eq('id', id);
  if (updateError) throw updateError;
}

export async function ignorePerluCek(id: string) {
  const { error } = await supabase.from('perlu_cek').update({ status: 'Diabaikan' }).eq('id', id);
  if (error) throw error;
}

// ===================== TANPA TANGGAL =====================
export async function getTanpaTanggal(filters?: { status?: string; search?: string }) {
  let query = supabase.from('tanpa_tanggal').select('*, unit:units(id, code, name, color)').order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.search) query = query.ilike('nama_kegiatan', `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function convertTanpaTanggalToKaldik(id: string, kaldikData: Partial<Kaldik>) {
  const { error: insertError } = await supabase.from('kaldik').insert(kaldikData);
  if (insertError) throw insertError;
  const { error: updateError } = await supabase.from('tanpa_tanggal').update({ status: 'Dikonversi' }).eq('id', id);
  if (updateError) throw updateError;
}

export async function ignoreTanpaTanggal(id: string) {
  const { error } = await supabase.from('tanpa_tanggal').update({ status: 'Diabaikan' }).eq('id', id);
  if (error) throw error;
}

// ===================== KARYAWAN =====================
export async function getKaryawan(filters?: { unit_id?: string; status?: string; search?: string }) {
  let query = supabase.from('karyawan').select('*, unit:units(id, code, name, color)').order('nama', { ascending: true });
  if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.search) query = query.ilike('nama', `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createKaryawan(data: Partial<Karyawan>) {
  const { data: result, error } = await supabase.from('karyawan').insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updateKaryawan(id: string, data: Partial<Karyawan>) {
  const { data: result, error } = await supabase.from('karyawan').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function deleteKaryawan(id: string) {
  const { error } = await supabase.from('karyawan').delete().eq('id', id);
  if (error) throw error;
}

// ===================== HARI KHUSUS =====================
export async function getHariKhusus(filters?: { jenis?: string; tahun?: number; search?: string }) {
  let query = supabase.from('hari_khusus').select('*').order('tanggal', { ascending: true });
  if (filters?.jenis) query = query.eq('jenis', filters.jenis);
  if (filters?.search) query = query.ilike('nama_hari', `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createHariKhusus(data: Partial<HariKhusus>) {
  const { data: result, error } = await supabase.from('hari_khusus').insert(data).select().single();
  if (error) throw error;
  return result;
}

export async function updateHariKhusus(id: string, data: Partial<HariKhusus>) {
  const { data: result, error } = await supabase.from('hari_khusus').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function deleteHariKhusus(id: string) {
  const { error } = await supabase.from('hari_khusus').delete().eq('id', id);
  if (error) throw error;
}

// ===================== POKOK DOA =====================
export async function getPokokDoa(filters?: { bulan?: number; tahun?: number; unit_mode?: string; status_doa?: string }) {
  let query = supabase.from('pokok_doa').select('*').order('tanggal', { ascending: true });
  if (filters?.bulan) query = query.eq('bulan', filters.bulan);
  if (filters?.tahun) query = query.eq('tahun', filters.tahun);
  if (filters?.unit_mode) query = query.eq('unit_mode', filters.unit_mode);
  if (filters?.status_doa) query = query.eq('status_doa', filters.status_doa);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updatePokokDoa(id: string, data: Partial<PokokDoa>) {
  const { data: result, error } = await supabase.from('pokok_doa').update(data).eq('id', id).select().single();
  if (error) throw error;
  return result;
}

export async function lockPokokDoa(id: string) {
  return updatePokokDoa(id, { locked: true });
}

export async function unlockPokokDoa(id: string) {
  return updatePokokDoa(id, { locked: false });
}

export async function finalizePokokDoa(id: string) {
  return updatePokokDoa(id, { status_doa: 'Final', locked: true });
}

export async function finalizePokokDoaMonth(bulan: number, tahun: number, unit_mode: string) {
  const { error } = await supabase
    .from('pokok_doa')
    .update({ status_doa: 'Final', locked: true })
    .eq('bulan', bulan)
    .eq('tahun', tahun)
    .eq('unit_mode', unit_mode)
    .neq('status_doa', 'Final');
  if (error) throw error;
}

// ===================== SETTINGS =====================
export async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*').order('key');
  if (error) throw error;
  return data;
}

export async function getSetting(key: string) {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
  if (error) throw error;
  return data?.value;
}

export async function updateSetting(key: string, value: string) {
  const { error } = await supabase.from('settings').update({ value }).eq('key', key);
  if (error) throw error;
}

// ===================== UNITS =====================
export async function getUnits() {
  const { data, error } = await supabase.from('units').select('*').order('code');
  if (error) throw error;
  return data;
}

// ===================== SYNC =====================
export async function getSyncLogs(limit = 20) {
  const { data, error } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function getSyncConflicts(filters?: { status?: string }) {
  let query = supabase.from('sync_conflicts').select('*').order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function resolveSyncConflict(id: string, resolution: 'Resolved' | 'Ignored', note?: string) {
  const { error } = await supabase
    .from('sync_conflicts')
    .update({ status: resolution, resolution_note: note, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Import type alias
type Kaldik = import('@/lib/types').Kaldik;
