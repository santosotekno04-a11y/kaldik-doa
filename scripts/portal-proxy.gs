/**
 * PROXY SCRIPT - Bridge antara Kaldik (Next.js) dan Portal Jadwal Gedung
 * 
 * Deploy script ini di email sekolah Anda sebagai Web App dengan akses "Anyone".
 * Script ini akan membaca/menulis data dari spreadsheet Portal.
 * 
 * SETUP:
 * 1. Buka https://script.google.com
 * 2. Buat project baru
 * 3. Paste kode ini
 * 4. Ganti SPREADSHEET_ID di bawah dengan ID spreadsheet Portal
 * 5. Ganti API_KEY dengan key rahasia yang kuat
 * 6. Deploy → New deployment → Web app → "Anyone" → Deploy
 * 7. Copy URL deployment → masukkan ke .env.local Kaldik sebagai PORTAL_PROXY_URL
 */

// ============ KONFIGURASI ============
var SPREADSHEET_ID = '1E3gmrIaCVzYWvve4U5yJoh5IlJD3AFiNmzmTn9CF1H0';
var API_KEY = 'KALDIK_PORTAL_SECRET_2026'; // Ganti dengan key yang kuat!
var APP_TZ = 'Asia/Jakarta';
var DAFTAR_UNIT = ['TK', 'SD', 'SMP', 'TBI'];
var STATUS_COL = 7; // Kolom G = Status
var LOG_SHEET_NAME = 'Kaldik_API_Log';

// ============ HTTP HANDLERS ============

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Validasi API key
    if (data.api_key !== API_KEY) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    var action = data.action;
    
    switch (action) {
      case 'getJadwal':
        return jsonResponse(handleGetJadwal(data));
      case 'getJadwalAll':
        return jsonResponse(handleGetJadwalAll(data));
      case 'updateStatus':
        return jsonResponse(handleUpdateStatus(data));
      case 'getSettings':
        return jsonResponse(handleGetSettings());
      case 'getHolidays':
        return jsonResponse(handleGetHolidays(data));
      case 'getDashboard':
        return jsonResponse(handleGetDashboard(data));
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    logAction('ERROR', '', '', err.message);
    return jsonResponse({ error: err.message }, 500);
  }
}

function doGet(e) {
  return jsonResponse({ 
    status: 'ok', 
    message: 'Kaldik-Portal Proxy is running',
    version: '1.0.0'
  });
}

// ============ ACTION HANDLERS ============

/**
 * Ambil jadwal per unit per bulan
 */
function handleGetJadwal(data) {
  var unit = data.unit; // 'TK', 'SD', 'SMP', 'TBI', atau 'ALL'
  var bulan = parseInt(data.bulan) || (new Date().getMonth() + 1);
  var tahun = parseInt(data.tahun) || new Date().getFullYear();
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var result = [];
  
  var units = (unit === 'ALL') ? DAFTAR_UNIT : [unit];
  
  units.forEach(function(u) {
    var ws = ss.getSheetByName(u);
    if (!ws) return;
    
    var rows = ws.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      
      var tgl = parseTanggal(rows[i][0]);
      if (!tgl) continue;
      if (tgl.getMonth() + 1 !== bulan || tgl.getFullYear() !== tahun) continue;
      
      var jamStr = rows[i][2] ? rows[i][2].toString() : '';
      var splitJam = jamStr.split(/[-–—]/);
      
      result.push({
        sheetName: u,
        row: i + 1,
        unit: u,
        tanggal: Utilities.formatDate(tgl, APP_TZ, 'yyyy-MM-dd'),
        tanggalDisplay: Utilities.formatDate(tgl, APP_TZ, 'dd/MM/yyyy'),
        acara: rows[i][1] ? rows[i][1].toString() : '',
        jamMulai: splitJam[0] ? splitJam[0].trim() : '',
        jamSelesai: splitJam[1] ? splitJam[1].trim() : '',
        jam: jamStr,
        persiapan: rows[i][3] ? rows[i][3].toString() : '',
        hadirin: rows[i][4] || 0,
        deskripsi: rows[i][5] ? rows[i][5].toString() : '',
        status: normalisasiStatus(rows[i][6]),
        catatan: rows[i][7] ? rows[i][7].toString() : '',
        pdfUrl: rows[i][8] ? rows[i][8].toString() : '',
        kebutuhan: rows[i][9] ? rows[i][9].toString() : '',
        docUrl: rows[i][10] ? rows[i][10].toString() : ''
      });
    }
  });
  
  // Sort by tanggal + jam
  result.sort(function(a, b) {
    var d = a.tanggal.localeCompare(b.tanggal);
    if (d !== 0) return d;
    return (a.jamMulai || '').localeCompare(b.jamMulai || '');
  });
  
  return { status: 'success', data: result, count: result.length };
}

/**
 * Ambil SEMUA jadwal (tanpa filter bulan) untuk master calendar
 */
function handleGetJadwalAll(data) {
  var tahun = parseInt(data.tahun) || new Date().getFullYear();
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var result = [];
  
  DAFTAR_UNIT.forEach(function(u) {
    var ws = ss.getSheetByName(u);
    if (!ws) return;
    
    var rows = ws.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      
      var tgl = parseTanggal(rows[i][0]);
      if (!tgl) continue;
      if (tgl.getFullYear() !== tahun) continue;
      
      var jamStr = rows[i][2] ? rows[i][2].toString() : '';
      var splitJam = jamStr.split(/[-–—]/);
      var status = normalisasiStatus(rows[i][6]);
      
      // Skip cancelled/rejected
      if (status === 'Cancelled' || status === 'Rejected') continue;
      
      result.push({
        sheetName: u,
        row: i + 1,
        unit: u,
        tanggal: Utilities.formatDate(tgl, APP_TZ, 'yyyy-MM-dd'),
        acara: rows[i][1] ? rows[i][1].toString() : '',
        jamMulai: splitJam[0] ? splitJam[0].trim() : '',
        jamSelesai: splitJam[1] ? splitJam[1].trim() : '',
        jam: jamStr,
        hadirin: rows[i][4] || 0,
        status: status,
        catatan: rows[i][7] ? rows[i][7].toString() : ''
      });
    }
  });
  
  result.sort(function(a, b) {
    return a.tanggal.localeCompare(b.tanggal) || (a.jamMulai || '').localeCompare(b.jamMulai || '');
  });
  
  return { status: 'success', data: result, count: result.length };
}

/**
 * Update status jadwal (ACC / Reject / Cancel)
 */
function handleUpdateStatus(data) {
  var unit = data.unit;
  var row = parseInt(data.row);
  var newStatus = data.newStatus; // 'Approved', 'Rejected', 'Cancelled'
  var catatan = data.catatan || '';
  
  if (!unit || !row || !newStatus) {
    throw new Error('Parameter unit, row, dan newStatus wajib diisi');
  }
  
  var validStatuses = ['Approved', 'Rejected', 'Cancelled', 'Pending'];
  if (validStatuses.indexOf(newStatus) === -1) {
    throw new Error('Status tidak valid: ' + newStatus);
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName(unit);
  if (!ws) throw new Error('Sheet tidak ditemukan: ' + unit);
  
  // Ambil data lama untuk log
  var oldRow = ws.getRange(row, 1, 1, Math.max(11, ws.getLastColumn())).getValues()[0];
  var oldStatus = normalisasiStatus(oldRow[6]);
  var acara = oldRow[1] ? oldRow[1].toString() : '';
  var tgl = oldRow[0] ? oldRow[0].toString() : '';
  
  // Update status
  ws.getRange(row, STATUS_COL).setValue(newStatus);
  
  // Update catatan jika ada
  if (catatan) {
    ws.getRange(row, 8).setValue(catatan);
  }
  
  // Log aktivitas
  logAction('STATUS_UPDATE', unit, row, 
    'Status: ' + oldStatus + ' → ' + newStatus + 
    ' | Acara: ' + acara + 
    ' | Tanggal: ' + tgl +
    ' | Via: Kaldik API'
  );
  
  return { 
    status: 'success', 
    message: 'Status berhasil diubah ke ' + newStatus,
    data: { unit: unit, row: row, oldStatus: oldStatus, newStatus: newStatus }
  };
}

/**
 * Ambil pengaturan Portal
 */
function handleGetSettings() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName('Pengaturan');
  if (!ws) return { status: 'success', data: {} };
  
  var rows = ws.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) {
      settings[rows[i][0].toString()] = rows[i][1] ? rows[i][1].toString() : '';
    }
  }
  
  return { status: 'success', data: settings };
}

/**
 * Ambil data hari libur
 */
function handleGetHolidays(data) {
  var tahun = parseInt(data.tahun) || new Date().getFullYear();
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName('Hari_Libur');
  if (!ws) return { status: 'success', data: [] };
  
  var rows = ws.getDataRange().getValues();
  var holidays = [];
  
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var tgl = parseTanggal(rows[i][0]);
    if (!tgl) continue;
    if (tgl.getFullYear() !== tahun) continue;
    
    holidays.push({
      tanggal: Utilities.formatDate(tgl, APP_TZ, 'yyyy-MM-dd'),
      keterangan: rows[i][1] ? rows[i][1].toString() : '',
      tipe: rows[i][2] ? rows[i][2].toString() : ''
    });
  }
  
  return { status: 'success', data: holidays };
}

/**
 * Data dashboard (statistik ringkas)
 */
function handleGetDashboard(data) {
  var bulan = parseInt(data.bulan) || (new Date().getMonth() + 1);
  var tahun = parseInt(data.tahun) || new Date().getFullYear();
  
  var jadwalResult = handleGetJadwal({ unit: 'ALL', bulan: bulan, tahun: tahun });
  var allData = jadwalResult.data || [];
  
  var stats = {
    total: allData.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    byUnit: {}
  };
  
  DAFTAR_UNIT.forEach(function(u) { stats.byUnit[u] = { total: 0, pending: 0, approved: 0 }; });
  
  allData.forEach(function(item) {
    var s = item.status;
    if (s === 'Pending') stats.pending++;
    else if (s === 'Approved') stats.approved++;
    else if (s === 'Rejected') stats.rejected++;
    else if (s === 'Cancelled') stats.cancelled++;
    
    if (stats.byUnit[item.unit]) {
      stats.byUnit[item.unit].total++;
      if (s === 'Pending') stats.byUnit[item.unit].pending++;
      else if (s === 'Approved') stats.byUnit[item.unit].approved++;
    }
  });
  
  // Jadwal terdekat (7 hari ke devar)
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  var terdekat = allData.filter(function(item) {
    var tgl = new Date(item.tanggal + 'T00:00:00');
    return tgl >= today && tgl <= nextWeek && item.status === 'Approved';
  });
  
  return { 
    status: 'success', 
    stats: stats, 
    terdekat: terdekat.slice(0, 10),
    bulan: bulan,
    tahun: tahun
  };
}

// ============ UTILITIES ============

function parseTanggal(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  
  var s = val.toString().trim();
  
  // Format: DD/MM/YYYY
  var match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  
  // Format: YYYY-MM-DD
  match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  
  // Try native parse
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalisasiStatus(val) {
  if (!val) return 'Pending';
  var s = val.toString().trim().toLowerCase();
  if (s === 'approved' || s === 'acc' || s === 'disetujui') return 'Approved';
  if (s === 'rejected' || s === 'ditolak') return 'Rejected';
  if (s === 'cancelled' || s === 'canceled' || s === 'dibatalkan' || s === 'batal') return 'Cancelled';
  return 'Pending';
}

function logAction(action, unit, row, detail) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName(LOG_SHEET_NAME);
    if (!ws) {
      ws = ss.insertSheet(LOG_SHEET_NAME);
      ws.appendRow(['Waktu', 'Aksi', 'Unit', 'Row', 'Detail', 'User']);
      ws.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#D9EAD3');
    }
    ws.appendRow([
      Utilities.formatDate(new Date(), APP_TZ, 'dd/MM/yyyy HH:mm:ss'),
      action, unit, row, detail, 'Kaldik API'
    ]);
  } catch (e) {
    // Silent fail untuk logging
  }
}

function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
