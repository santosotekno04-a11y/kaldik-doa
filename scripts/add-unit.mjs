/**
 * Script untuk menambahkan unit baru ke Supabase
 * Jalankan: node scripts/add-unit.mjs
 */

const SUPABASE_URL = 'https://hjrmfcqeygplntemrehj.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcm1mY3FleWdwbG50ZW1yZWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzYyNzI1NSwiZXhwIjoyMDk5MjAzMjU1fQ.xrKlfR1X03LCsTo4a_oP19ceKVyCgCphgd_mgl1gyNk';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function addUnit() {
  console.log('=== Menambahkan Unit TBI ===\n');

  // Check existing units
  const existing = await fetch(`${SUPABASE_URL}/rest/v1/units?select=*&order=code`, { headers });
  const units = await existing.json();
  console.log('Unit yang ada:');
  units.forEach(u => console.log(`  ${u.code}: ${u.name} (${u.color})`));

  // Check if TBI already exists
  if (units.some(u => u.name === 'TBI')) {
    console.log('\n✓ Unit TBI sudah ada!');
    return;
  }

  // Generate next code
  const lastCode = units.map(u => parseInt(u.code.replace('U', ''))).sort((a, b) => b - a)[0];
  const nextCode = `U${String(lastCode + 1).padStart(3, '0')}`;

  // Insert TBI unit
  const res = await fetch(`${SUPABASE_URL}/rest/v1/units`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: nextCode,
      name: 'TBI',
      color: 'teal',
      is_active: true
    })
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`\n✓ Unit TBI berhasil ditambahkan!`);
    console.log(`  ID: ${data[0].id}`);
    console.log(`  Code: ${data[0].code}`);
    console.log(`  Name: ${data[0].name}`);
    console.log(`  Color: ${data[0].color}`);
  } else {
    const err = await res.text();
    console.log(`\n✗ Gagal: ${err}`);
  }
}

addUnit().catch(console.error);
