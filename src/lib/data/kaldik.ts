import { createServerClient } from '@/lib/supabase/server';
import type { Kaldik, KaldikFilters } from '@/lib/types';

const supabase = createServerClient();

export async function getKaldik(filters?: KaldikFilters) {
  let query = supabase
    .from('kaldik')
    .select(`
      *,
      unit:units(id, code, name, color)
    `)
    .order('tanggal_mulai', { ascending: true });

  if (filters?.tahun_ajaran) query = query.eq('tahun_ajaran', filters.tahun_ajaran);
  if (filters?.semester) query = query.eq('semester', filters.semester);
  if (filters?.bulan) query = query.eq('bulan', filters.bulan);
  if (filters?.tahun) query = query.eq('tahun', filters.tahun);
  if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.kategori) query = query.eq('kategori', filters.kategori);
  if (filters?.search) query = query.ilike('nama_kegiatan', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as (Kaldik & { unit: { id: string; code: string; name: string; color: string } | null })[];
}

export async function getKaldikById(id: string) {
  const { data, error } = await supabase
    .from('kaldik')
    .select('*, unit:units(id, code, name, color)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createKaldik(data: Partial<Kaldik>) {
  const { data: result, error } = await supabase
    .from('kaldik')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateKaldik(id: string, data: Partial<Kaldik>) {
  const { data: result, error } = await supabase
    .from('kaldik')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteKaldik(id: string) {
  const { error } = await supabase.from('kaldik').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateKaldik(id: string) {
  const original = await getKaldikById(id);
  const { id: _, created_at, updated_at, ...rest } = original;
  return createKaldik({
    ...rest,
    kaldik_id: `KAL-DUP-${Date.now()}`,
    status: 'Draft',
    sumber_data: 'Manual',
  });
}

export async function getDashboardSummary() {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  const [kaldikRes, perluCekRes, tanpaRes, karyawanRes, syncRes] = await Promise.all([
    supabase.from('kaldik').select('id', { count: 'exact', head: true })
      .eq('bulan', bulan).eq('tahun', tahun).neq('status', 'Dibatalkan'),
    supabase.from('perlu_cek').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    supabase.from('tanpa_tanggal').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    supabase.from('karyawan').select('id', { count: 'exact', head: true }).eq('status', 'Aktif'),
    supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(1),
  ]);

  const agendaTerdekat = await supabase
    .from('kaldik')
    .select('*, unit:units(name, color)')
    .gte('tanggal_mulai', now.toISOString().split('T')[0])
    .neq('status', 'Dibatalkan')
    .order('tanggal_mulai', { ascending: true })
    .limit(5);

  return {
    kaldik_bulan_ini: kaldikRes.count || 0,
    perlu_cek: perluCekRes.count || 0,
    tanpa_tanggal: tanpaRes.count || 0,
    karyawan_aktif: karyawanRes.count || 0,
    agenda_terdekat: agendaTerdekat.data || [],
    last_sync: syncRes.data?.[0] || null,
  };
}
