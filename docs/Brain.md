# Brain.md — Pusat Konteks Project Kaldik & Doa

> File ini WAJIB dibaca oleh AI sebelum membuat perubahan apapun.
> Jangan keluar dari konteks yang tertulis di sini.

---

## 1. Nama Aplikasi

**Kaldik & Doa** (Kalender Pendidikan & Pokok Doa Terpadu)

## 2. Tujuan Aplikasi

Membangun aplikasi web modern untuk mengelola:
- **Kalender Pendidikan (Kaldik)** — agenda kegiatan TK, SD, SMP, Manajemen
- **Pokok Doa** — doa harian yang di-generate otomatis dari data Kaldik, Hari Khusus, Ulang Tahun Karyawan, dan Tema Bulanan
- **Manajemen Data** — Karyawan, Tema Bulanan, Import/Export, Sinkronisasi Spreadsheet

## 3. Scope Aplikasi

### Dalam Scope:
1. Dashboard ringkasan
2. CRUD Kaldik (agenda kegiatan)
3. Tema Bulanan per unit
4. Perlu Cek (data ambigu dari import)
5. Tanpa Tanggal (data tanpa tanggal dari import)
6. Karyawan (data karyawan + ulang tahun)
7. Hari Khusus (hari raya Kristen, hari libur nasional)
8. Generate Doa (auto-generate pokok doa dari Kaldik)
9. Hasil Pokok Doa (view, edit, lock, finalize)
10. Export HTML (Kaldik + Pokok Doa)
11. Import Data (CSV paste / file upload)
12. Setting (aplikasi, unit, spreadsheet, sync, security)
13. Sinkronisasi Spreadsheet → Supabase (satu arah)
14. Sync Log & Conflict Manager

### Di Luar Scope (Jangan Dibuat):
- Sinkronisasi dua arah (Supabase → Spreadsheet)
- Multi-user / role-based access (MVP pakai 1 admin PIN)
- Mobile app native
- Notifikasi push / email
- Integrasi pihak ketiga selain Google Sheets

## 4. Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14+ (App Router) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui + custom components |
| Database | Supabase PostgreSQL |
| Auth | Simple PIN login (MVP) |
| Deploy | Vercel |
| Spreadsheet Integration | Google Sheets API (service account) |
| Sync Trigger | Vercel Cron + Manual Button |

## 5. Arsitektur Supabase + Vercel + Spreadsheet

```
┌─────────────────────┐
│ Google Spreadsheet  │ ← Sumber data awal, import massal, backup
│ (KALDIK, TEMA, dll) │
└─────────┬───────────┘
          │ Sync satu arah (setiap Selasa / manual)
          ▼
┌─────────────────────┐
│  Vercel API Route   │ ← /api/sync/weekly, /api/sync/manual
│  (Next.js Server)   │ ← /api/export/*, /api/sync/*
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Supabase (Postgres)│ ← Database utama aplikasi
│  13 tabel utama     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Next.js Frontend   │ ← Aplikasi web modern
│  (Vercel Hosting)   │
└─────────────────────┘
```

## 6. Arah Sync MVP: Spreadsheet → Supabase

**Alasan:**
- Data massal masih berasal dari Spreadsheet
- Satu arah lebih aman untuk MVP
- Risiko konflik lebih rendah

**Aturan Sync:**
1. Setiap tabel punya ID unik (`kaldik_id`, `tema_id`, dll)
2. Setiap data punya `updated_at`
3. Sistem baca data dari Spreadsheet
4. Mapping kolom Spreadsheet → tabel Supabase
5. Validasi unit, tanggal, status, field wajib
6. ID belum ada → INSERT
7. ID ada + Spreadsheet updated_at lebih baru → UPDATE
8. ID ada + Supabase updated_at lebih baru → SKIP (masuk sync_conflicts)
9. Data ambigu → perlu_cek
10. Data tanpa tanggal → tanpa_tanggal
11. Data tidak valid → import_logs (rejected)
12. Semua hasil sync → sync_logs
13. Konflik → sync_conflicts

## 7. Aturan Konflik Data

- **Jangan overwrite otomatis** jika data Supabase lebih baru
- Simpan ke tabel `sync_conflicts`
- Admin bisa resolve: pilih Spreadsheet, pilih Supabase, atau abaikan
- Semua perubahan penting masuk `change_logs`

## 8. Menu Aplikasi

| No | Menu | Keterangan |
|----|------|------------|
| 1 | Dashboard | Ringkasan + shortcut |
| 2 | Kaldik | CRUD agenda kegiatan |
| 3 | Tema Bulanan | Tema per unit per bulan |
| 4 | Perlu Cek | Data ambigu dari import |
| 5 | Tanpa Tanggal | Data tanpa tanggal dari import |
| 6 | Karyawan | Data karyawan + ulang tahun |
| 7 | Hari Khusus | Hari raya Kristen, libur nasional |
| 8 | Generate Doa | Auto-generate pokok doa |
| 9 | Hasil Pokok Doa | View, edit, lock, finalize doa |
| 10 | Export | Export HTML Kaldik + Doa |
| 11 | Import Data | CSV paste / file upload |
| 12 | Setting | Konfigurasi aplikasi |

## 9. Database Schema

Lihat file: `docs/supabase-schema.sql`

### Tabel Utama (13 tabel):

1. **units** — Master unit (Universal, TK, SD, SMP, Manajemen)
2. **kaldik** — Agenda kegiatan kalender pendidikan
3. **tema_bulanan** — Tema bulanan per unit
4. **perlu_cek** — Data ambigu dari import
5. **tanpa_tanggal** — Data tanpa tanggal dari import
6. **karyawan** — Data karyawan
7. **hari_khusus** — Hari raya Kristen, libur nasional
8. **pokok_doa** — Hasil generate pokok doa
9. **settings** — Konfigurasi aplikasi (key-value)
10. **import_logs** — Log import data
11. **change_logs** — Log perubahan data
12. **sync_logs** — Log sinkronisasi
13. **sync_conflicts** — Data konflik sinkronisasi

## 10. Endpoint/API

### Dashboard
- `getDashboardSummary` — Ringkasan dashboard

### Kaldik
- `getKaldik(filters)` — List kaldik dengan filter
- `getKaldikById(id)` — Detail kaldik
- `createKaldik(data)` — Tambah kaldik
- `updateKaldik(id, data)` — Edit kaldik
- `duplicateKaldik(id)` — Duplikat kaldik
- `cancelKaldik(id)` — Batalkan kaldik
- `archiveKaldik(id)` — Arsipkan kaldik
- `deleteKaldik(id)` — Hapus kaldik
- `moveKaldikDate(id, newStart, newEnd)` — Pindah tanggal

### Tema Bulanan
- `getTemaBulanan(filters)` — List tema
- `createTemaBulanan(data)` — Tambah tema
- `updateTemaBulanan(id, data)` — Edit tema
- `deleteTemaBulanan(id)` — Hapus tema

### Perlu Cek
- `getPerluCek(filters)` — List data ambigu
- `validatePerluCek(id, fixedData)` — Validasi → konversi ke Kaldik
- `ignorePerluCek(id)` — Abaikan

### Tanpa Tanggal
- `getTanpaTanggal(filters)` — List data tanpa tanggal
- `createTanpaTanggal(data)` — Tambah
- `updateTanpaTanggal(id, data)` — Edit
- `convertTanpaTanggalToKaldik(id, data)` — Konversi ke Kaldik
- `ignoreTanpaTanggal(id)` — Abaikan

### Karyawan
- `getKaryawan(filters)` — List karyawan
- `createKaryawan(data)` — Tambah
- `updateKaryawan(id, data)` — Edit
- `deleteKaryawan(id)` — Hapus
- `importKaryawan(csvText)` — Import dari CSV

### Hari Khusus
- `getHariKhusus(filters)` — List hari khusus
- `createHariKhusus(data)` — Tambah
- `updateHariKhusus(id, data)` — Edit
- `deleteHariKhusus(id)` — Hapus

### Generate Doa
- `generatePokokDoa(month, year, unitMode, options)` — Generate doa bulanan
- `regeneratePrayerDate(date, unitMode, options)` — Regenerate doa per tanggal

### Hasil Pokok Doa
- `getPokokDoa(filters)` — List pokok doa
- `updatePokokDoa(id, data)` — Edit doa
- `lockPokokDoa(id)` — Kunci doa
- `unlockPokokDoa(id)` — Buka kunci
- `finalizePokokDoa(id)` — Finalisasi doa
- `finalizePokokDoaMonth(month, year, unitMode)` — Finalisasi sebulan

### Export
- `exportKaldikHtml(filters)` — Export Kaldik ke HTML
- `exportPokokDoaHtml(month, year, unitMode)` — Export Doa ke HTML

### Import
- `parseImportPreview(csvText)` — Preview import
- `executeImport(csvText)` — Eksekusi import

### Setting
- `getSettings()` — Ambil semua setting
- `updateSetting(key, value)` — Update setting

### Sync
- `/api/sync/manual` — Sync manual
- `/api/sync/weekly` — Sync otomatis (Vercel Cron)
- `getSyncLogs()` — Log sync
- `getSyncConflicts()` — Daftar konflik
- `resolveSyncConflict(id, resolution)` — Resolve konflik

## 11. UI/UX Rules

### Desain
- Modern, bersih, premium
- **BUKAN** tampilan spreadsheet
- Responsif (desktop + mobile)

### Warna
| Token | Warna |
|-------|-------|
| Primary | Indigo/Biru |
| Background | Soft gray (#f8fafc) |
| Card | White |
| Border | Light gray |
| Text | Slate/dark gray |

### Unit Badge
| Unit | Warna |
|------|-------|
| Universal | Gray |
| TK | Rose |
| SD | Blue |
| SMP | Purple |
| Manajemen | Green |

### Status Badge
| Status | Warna |
|--------|-------|
| Draft | Gray |
| Valid | Green |
| Perlu Cek | Amber |
| Final | Blue |
| Dibatalkan | Red |
| Locked | Purple |

### Desktop
- Sidebar kiri fixed
- Main content luas
- Tabel lengkap dengan filter detail
- Kalender besar
- Bulk action
- Import/export lengkap

### Mobile
- Top bar
- Bottom navigation
- Card view (bukan tabel)
- Floating add button
- Filter collapsible
- Form full-screen drawer/modal

## 12. Progress Fitur

| Fitur | Status |
|-------|--------|
| Brain.md | ✅ Selesai |
| Database Schema SQL | ⏳ Blueprint |
| Struktur Folder | ⏳ Blueprint |
| Layout (Sidebar + Mobile Nav) | ❌ Belum |
| Dashboard | ❌ Belum |
| Kaldik CRUD | ❌ Belum |
| Tema Bulanan | ❌ Belum |
| Perlu Cek | ❌ Belum |
| Tanpa Tanggal | ❌ Belum |
| Karyawan | ❌ Belum |
| Hari Khusus | ❌ Belum |
| Generate Doa | ❌ Belum |
| Hasil Pokok Doa | ❌ Belum |
| Export | ❌ Belum |
| Import Data | ❌ Belum |
| Setting | ❌ Belum |
| Sync Engine | ❌ Belum |
| Sync Log | ❌ Belum |
| Sync Conflict Manager | ❌ Belum |

## 13. Update Log

| Tanggal | Perubahan |
|---------|-----------|
| 2026-07-10 | Inisialisasi Brain.md |

## 14. Bug Log

| Tanggal | Bug | Status |
|---------|-----|--------|
| - | - | - |

## 15. Keputusan Teknis

| Keputusan | Alasan |
|-----------|--------|
| Supabase sebagai DB utama | Scalable, real-time, PostgreSQL |
| Sync satu arah (Spreadsheet → Supabase) | Aman untuk MVP, data massal dari Spreadsheet |
| Simple PIN auth (MVP) | Single admin, tidak perlu kompleksitas OAuth |
| shadcn/ui | Komponen modern, customizable, Tailwind-native |
| Vercel Cron untuk weekly sync | Terintegrasi langsung dengan Vercel deployment |
| ID unik per tabel | Mendukung sync dan deduplikasi |
| updated_at wajib di semua tabel | Mendukung conflict detection saat sync |

## 16. Catatan Larangan (Agar AI Tidak Keluar Konteks)

1. **JANGAN** membuat fitur di luar scope Kaldik & Doa
2. **JANGAN** menjadikan Spreadsheet sebagai live database utama
3. **JANGAN** membuat sinkronisasi dua arah
4. **JANGAN** overwrite konflik otomatis
5. **JANGAN** menghilangkan fitur inti dari aplikasi lama
6. **JANGAN** membuat UI yang mirip spreadsheet
7. **JANGAN** menyimpan secret key di frontend
8. **JANGAN** membuat mobile app native
9. **JANGAN** mengubah arsitektur tanpa diskusi
10. **JANGAN** menambah dependensi yang tidak perlu
11. **WAJIB** simpan semua perubahan data ke change_logs
12. **WAJIB** simpan semua sync ke sync_logs
13. **WAJIB** gunakan environment variable untuk secret
14. **WAJIB** ikuti struktur folder yang sudah ditentukan
15. **WAJIB** baca Brain.md sebelum membuat perubahan apapun

---

## Referensi Aplikasi Lama

File lama: `Kaldik-Pokok-Doa.json` (Google Apps Script)

### Modul dalam aplikasi lama:
- **Code.gs** — Entry point & router (api action dispatcher)
- **Auth.gs** — Login PIN + session
- **SheetService.gs** — Read/write Google Sheets
- **ImportService.gs** — Import CSV dengan header mapping & transform
- **ExportService.gs** — Export HTML
- **PrayerService.gs** — Generate Doa engine (prioritas 1-11)
- **CheckService.gs** — Perlu Cek validation
- **TemaService.gs** — Tema Bulanan CRUD
- **KaryawanService.gs** — Karyawan CRUD + import
- **LogService.gs** — Change logging
- **Utils.gs** — Utility functions

### Logika Generate Doa (dari PrayerService.gs):
1. **Prioritas 1**: Hari Raya Kristen → template Hari Raya Kristen
2. **Prioritas 2-9**: Kaldik agenda → sorted by kategori priority:
   - Ibadah (3), Ujian/Rapor/Asesmen (4), MPLS/Home Visit/Orientasi (5)
   - Ulang Tahun (6), Libur (7), Kegiatan/Rapat (8), Umum (9)
   - Sabtu/Minggu (10), Doa Umum Harian (11)
3. **Prioritas 10**: Ulang Tahun Karyawan
4. **Prioritas 11**: Sabtu → template Sabtu, Minggu → template Minggu
5. **Fallback**: Doa Umum Harian

### Template Doa:
- 30+ template default per kategori
- Mendukung variable: `{nama}`, `{bulan}`, `{tahun}`, `{tema}`, `{ayat}`
- Render template mengganti variable dengan data aktual

### Anti-timpa Rules:
- Skip jika `Locked = true`
- Skip jika `StatusDoa = Final` (kecuali force overwrite)
- Skip jika `StatusDoa = Edited Manual` (kecuali force overwrite)
- Hanya overwrite `StatusDoa = Auto Draft`
