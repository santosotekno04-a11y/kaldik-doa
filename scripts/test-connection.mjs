/**
 * Koneksi Test — Verifikasi koneksi ke Supabase
 * Jalankan: node scripts/test-connection.mjs
 */

const SUPABASE_URL = 'https://hjrmfcqeygplntemrehj.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcm1mY3FleWdwbG50ZW1yZWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYyNzI1NSwiZXhwIjoyMDk5MjAzMjU1fQ.xrKlfR1X03LCsTo4a_oP19ceKVyCgCphgd_mgl1gyNk';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcm1mY3FleWdwbG50ZW1yZWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MjcyNTUsImV4cCI6MjA5OTIwMzI1NX0.RWfwrVIqfktDnkFWi4C9lapdAON9bPNMafvGTUvYVM8';

async function test() {
  console.log('=== KALDIK & DOA — Connection Test ===\n');
  console.log(`URL: ${SUPABASE_URL}`);

  // Test 1: Basic connectivity
  console.log('\n[1/4] Testing basic connectivity...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { 'apikey': SERVICE_KEY }
    });
    console.log(`   Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log('   ✓ Supabase API is reachable');
    }
  } catch (err) {
    console.log('   ✗ Cannot reach Supabase:', err.message);
    return;
  }

  // Test 2: Service role key
  console.log('\n[2/4] Testing service role key...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/units?select=count`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    if (res.status === 200) {
      const count = res.headers.get('content-range')?.split('/')[1] || '0';
      console.log(`   ✓ Service role key VALID — units table: ${count} rows`);
    } else if (res.status === 404 || res.status === 401) {
      const body = await res.text();
      console.log(`   Status ${res.status}: ${body.substring(0, 200)}`);
      if (res.status === 404) {
        console.log('   ⚠ Tabel "units" belum ada — perlu jalankan migration dulu');
      }
    } else {
      console.log(`   Status: ${res.status}`);
    }
  } catch (err) {
    console.log('   ✗ Service key test failed:', err.message);
  }

  // Test 3: Anon key
  console.log('\n[3/4] Testing anon key...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/units?select=count`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    if (res.status === 200) {
      console.log('   ✓ Anon key VALID');
    } else if (res.status === 404) {
      console.log('   ⚠ Tabel belum ada (normal jika migration belum dijalankan)');
    } else {
      console.log(`   Status: ${res.status}`);
    }
  } catch (err) {
    console.log('   ✗ Anon key test failed:', err.message);
  }

  // Test 4: Check all expected tables
  console.log('\n[4/4] Checking expected tables...');
  const tables = [
    'units', 'kaldik', 'tema_bulanan', 'perlu_cek', 'tanpa_tanggal',
    'karyawan', 'hari_khusus', 'pokok_doa', 'settings',
    'import_logs', 'change_logs', 'sync_logs', 'sync_conflicts'
  ];

  let existingCount = 0;
  for (const table of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'count=exact'
        }
      });
      if (res.ok) {
        const count = res.headers.get('content-range')?.split('/')[1] || '0';
        console.log(`   ✓ ${table}: ${count} rows`);
        existingCount++;
      } else {
        console.log(`   ✗ ${table}: tidak ditemukan`);
      }
    } catch (err) {
      console.log(`   ✗ ${table}: error`);
    }
  }

  console.log(`\n=== Hasil: ${existingCount}/${tables.length} tabel ditemukan ===`);

  if (existingCount === 0) {
    console.log('\n📋 LANGKAH SELANJUTNYA:');
    console.log('   Semua tabel belum ada. Jalankan migration:');
    console.log('   1. Buka https://supabase.com/dashboard');
    console.log('   2. Pilih project: hjrmfcqeygplntemrehj');
    console.log('   3. Klik "SQL Editor" di sidebar kiri');
    console.log('   4. Klik "New Query"');
    console.log('   5. Copy-paste isi file: supabase/migrations/001_initial_schema.sql');
    console.log('   6. Klik "Run" (Ctrl+Enter)');
    console.log('   7. Jalankan lagi: node scripts/test-connection.mjs');
  } else if (existingCount < tables.length) {
    console.log('\n⚠️  Sebagian tabel belum ada. Jalankan migration untuk tabel yang kurang.');
  } else {
    console.log('\n✅ Semua tabel sudah ada! Siap untuk sync data.');
  }
}

test().catch(console.error);
