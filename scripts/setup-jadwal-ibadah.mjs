/**
 * Script untuk membuat tabel Jadwal Ibadah di Supabase
 * Jalankan: node scripts/setup-jadwal-ibadah.mjs
 */

const SUPABASE_URL = 'https://hjrmfcqeygplntemrehj.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcm1mY3FleWdwbG50ZW1yZWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYyNzI1NSwiZXhwIjoyMDk5MjAzMjU1fQ.xrKlfR1X03LCsTo4a_oP19ceKVyCgCphgd_mgl1gyNk';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function checkTable(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=count`, {
    headers: { ...headers, 'Prefer': 'count=exact' }
  });
  if (res.ok) {
    const count = res.headers.get('content-range')?.split('/')[1] || '0';
    return { exists: true, count };
  }
  return { exists: false, count: 0 };
}

async function run() {
  console.log('=== Setup Jadwal Ibadah Tables ===\n');

  // Check if old tables exist
  const oldJadwal = await checkTable('jadwal');
  const oldItems = await checkTable('jadwal_items');

  if (oldJadwal.exists || oldItems.exists) {
    console.log('⚠ Tabel lama (jadwal/jadwal_items) terdeteksi.');
    console.log('  Hapus manual di Supabase Dashboard > Table Editor');
    console.log('  atau jalankan SQL: DROP TABLE IF EXISTS jadwal_items CASCADE; DROP TABLE IF EXISTS jadwal CASCADE;\n');
  }

  // Check new tables
  const ibadah = await checkTable('jadwal_ibadah');
  const hm = await checkTable('jadwal_holy_morning');

  console.log(`jadwal_ibadah: ${ibadah.exists ? `✓ ada (${ibadah.count} rows)` : '✗ belum ada'}`);
  console.log(`jadwal_holy_morning: ${hm.exists ? `✓ ada (${hm.count} rows)` : '✗ belum ada'}`);

  if (!ibadah.exists || !hm.exists) {
    console.log('\n📋 Silakan jalankan SQL berikut di Supabase Dashboard > SQL Editor:');
    console.log('   File: supabase/migrations/003_jadwal_ibadah_tables.sql');
    console.log('\n   Atau copy-paste SQL dari file tersebut ke SQL Editor dan klik Run.');
    console.log('\n   Setelah selesai, jalankan lagi script ini untuk verifikasi.');
  } else {
    console.log('\n✅ Semua tabel Jadwal Ibadah sudah ada dan siap digunakan!');
  }
}

run().catch(console.error);
