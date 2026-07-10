/**
 * Direct Supabase Migration Script
 * Menggunakan pg untuk koneksi langsung ke PostgreSQL
 * Jalankan: node scripts/migrate-direct.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project ref from Supabase URL
const PROJECT_REF = 'hjrmfcqeygplntemrehj';

async function runMigration() {
  console.log('=== KALDIK & DOA — Database Migration ===\n');
  console.log(`Project: ${PROJECT_REF}`);

  // Read the migration SQL file
  const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Use Supabase SQL API via fetch (no external deps needed)
  // We'll use the Supabase REST API with service role key

  // First, let's test the connection using Supabase REST API
  const supabaseUrl = 'https://hjrmfcqeygplntemrehj.supabase.co';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcm1mY3FleWdwbG50ZW1yZWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYyNzI1NSwiZXhwIjoyMDk5MjAzMjU1fQ.xrKlfR1X03LCsTo4a_oP19ceKVyCgCphgd_mgl1gyNk';

  console.log('\n[1/3] Testing connection to Supabase...');

  try {
    // Test connection by querying units table (might not exist yet)
    const testRes = await fetch(`${supabaseUrl}/rest/v1/units?select=count`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });

    if (testRes.ok) {
      console.log('   ✓ Connection successful! Units table already exists.');
      console.log('   Tables may already be created. Skipping migration.');
      await verifyTables(supabaseUrl, serviceKey);
      return;
    }

    console.log('   Units table not found (expected for fresh database).');
    console.log('   Proceeding with migration...');
  } catch (err) {
    console.log('   Connection test result:', err.message);
  }

  // Split SQL into individual statements and execute
  console.log('\n[2/3] Executing migration SQL...');

  // For Supabase, we need to use the SQL Editor API
  // The best approach is to execute via the /pg endpoint or use the Management API
  // Since we don't have the management token, let's try the direct approach

  // We'll try using the Supabase SQL API
  // Note: This requires the project to have the sql endpoint enabled

  console.log('\n⚠️  Supabase REST API tidak mendukung eksekusi SQL langsung.');
  console.log('   Silakan jalankan migration manual melalui Supabase Dashboard:');
  console.log('   1. Buka https://supabase.com/dashboard');
  console.log('   2. Pilih project: hjrmfcqeygplntemrehj');
  console.log('   3. Klik "SQL Editor" di sidebar kiri');
  console.log('   4. Klik "New Query"');
  console.log('   5. Paste isi file: supabase/migrations/001_initial_schema.sql');
  console.log('   6. Klik "Run" (atau tekan Ctrl+Enter)');
  console.log('\n   Atau, jika Anda punya database password, jalankan:');
  console.log('   node scripts/migrate-direct.mjs --password YOUR_DB_PASSWORD');
  console.log('\n   Setelah migration selesai, jalankan:');
  console.log('   node scripts/verify-connection.mjs');

  // If password provided via CLI args, use direct PostgreSQL connection
  const passwordArg = process.argv.find(arg => arg.startsWith('--password='));
  if (passwordArg) {
    const password = passwordArg.split('=')[1];
    await runDirectPG(sql, password);
  }
}

async function runDirectPG(sql, password) {
  console.log('\n[2/3] Connecting directly to PostgreSQL...');

  // We need pg package for direct connection
  // Install it dynamically if needed
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.log('   Installing pg package...');
    const { execSync } = await import('child_process');
    execSync('npm install pg', { stdio: 'inherit' });
    pg = await import('pg');
  }

  const { Client } = pg.default || pg;
  const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('   ✓ Connected to PostgreSQL');

    // Execute the full SQL
    console.log('   Executing migration...');
    await client.query(sql);
    console.log('   ✓ Migration executed successfully!');

    await client.end();

    // Verify
    await verifyTablesViaPG(password);
  } catch (err) {
    console.error('   ✗ Migration failed:', err.message);
    if (err.message.includes('already exists')) {
      console.log('   Tables already exist. Migration may have been run before.');
    }
    await client.end();
  }
}

async function verifyTablesViaPG(password) {
  console.log('\n[3/3] Verifying tables...');

  let pg;
  try {
    pg = await import('pg');
  } catch {
    return;
  }

  const { Client } = pg.default || pg;
  const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const tables = [
    'units', 'kaldik', 'tema_bulanan', 'perlu_cek', 'tanpa_tanggal',
    'karyawan', 'hari_khusus', 'pokok_doa', 'settings',
    'import_logs', 'change_logs', 'sync_logs', 'sync_conflicts'
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM ${table}`);
      console.log(`   ✓ ${table}: ${res.rows[0].count} rows`);
    } catch (err) {
      console.log(`   ✗ ${table}: ${err.message}`);
    }
  }

  await client.end();
  console.log('\n=== Migration Complete ===');
}

async function verifyTables(supabaseUrl, serviceKey) {
  console.log('\n[3/3] Verifying tables...');

  const tables = [
    'units', 'kaldik', 'tema_bulanan', 'perlu_cek', 'tanpa_tanggal',
    'karyawan', 'hari_khusus', 'pokok_doa', 'settings',
    'import_logs', 'change_logs', 'sync_logs', 'sync_conflicts'
  ];

  for (const table of tables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=count`, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'count=exact'
        }
      });

      if (res.ok) {
        const count = res.headers.get('content-range')?.split('/')[1] || '?';
        console.log(`   ✓ ${table}: ${count} rows`);
      } else {
        console.log(`   ✗ ${table}: not found (status ${res.status})`);
      }
    } catch (err) {
      console.log(`   ✗ ${table}: ${err.message}`);
    }
  }

  console.log('\n=== Verification Complete ===');
}

runMigration().catch(console.error);
