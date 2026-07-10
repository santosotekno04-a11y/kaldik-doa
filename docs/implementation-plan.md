# Rencana Implementasi Bertahap — Kaldik & Doa

---

## Tahap 1: Foundation (Blueprint & Setup)
**Status: Sedang Dikerjakan**

### Deliverables:
- [x] `docs/Brain.md` — Pusat konteks project
- [x] `docs/supabase-schema.sql` — Database schema Supabase
- [x] `.trae/documents/prd.md` — Product Requirements Document
- [x] `.trae/documents/technical.md` — Technical Architecture
- [x] `docs/implementation-plan.md` — File ini
- [ ] `.env.example` — Template environment variables
- [ ] Inisialisasi Next.js project (`npx create-next-app`)
- [ ] Install dependencies (tailwind, shadcn/ui, supabase-js, googleapis, tanstack-query)
- [ ] Konfigurasi Supabase client (browser + server)
- [ ] Konfigurasi TypeScript types
- [ ] Setup shadcn/ui components

### Setelah Tahap 1:
Project siap untuk development. Semua konfigurasi dan struktur sudah ada.

---

## Tahap 2: Layout & Dashboard
**Depends on: Tahap 1**

### Deliverables:
- [ ] Root layout dengan sidebar
- [ ] Desktop sidebar (fixed, collapsible)
- [ ] Mobile bottom navigation
- [ ] Topbar (breadcrumb, search)
- [ ] Dashboard page:
  - [ ] Stat cards (agenda bulan ini, perlu cek, tanpa tanggal, karyawan aktif)
  - [ ] Agenda terdekat (7 hari)
  - [ ] Status sync terakhir
  - [ ] Shortcut buttons (Tambah Agenda, Import, Generate Doa, Sync)
- [ ] Auth middleware (PIN login)
- [ ] Login page

### Komponen yang dibuat:
- `components/layout/sidebar.tsx`
- `components/layout/mobile-nav.tsx`
- `components/layout/topbar.tsx`
- `components/ui/stat-card.tsx`
- `components/ui/loading.tsx`

---

## Tahap 3: Kaldik CRUD
**Depends on: Tahap 2**

### Deliverables:
- [ ] Kaldik list page (table view + filter)
- [ ] Kaldik calendar view
- [ ] Kaldik card view (mobile)
- [ ] Form tambah/edit Kaldik
- [ ] Filter: tahun ajaran, semester, bulan, unit, status, kategori
- [ ] Aksi: duplikat, pindah tanggal, batalkan, arsipkan, hapus
- [ ] Bulk action (ubah status)
- [ ] Search

### Komponen yang dibuat:
- `components/ui/data-table.tsx`
- `components/ui/calendar-grid.tsx`
- `components/ui/unit-badge.tsx`
- `components/ui/status-badge.tsx`
- `components/ui/modal.tsx`
- `components/ui/toast.tsx`
- `components/forms/kaldik-form.tsx`

### API yang dibuat:
- `getKaldik`, `createKaldik`, `updateKaldik`, `deleteKaldik`
- `duplicateKaldik`, `moveKaldikDate`, `cancelKaldik`, `archiveKaldik`

---

## Tahap 4: Import Data
**Depends on: Tahap 3**

### Deliverables:
- [ ] Import page (paste CSV / upload file)
- [ ] Auto-detect delimiter
- [ ] Header mapping preview
- [ ] Data validation preview
- [ ] Kategorisasi: valid, perlu cek, tanpa tanggal, rejected
- [ ] Execute import → simpan ke Supabase
- [ ] Import log

### API yang dibuat:
- `parseImportPreview`, `executeImport`

### Mapping logic (dari ImportService.gs lama):
- Header mapping table
- Unit mapping (text → code)
- Status mapping
- Date transform
- Boolean transform

---

## Tahap 5: Sync Engine
**Depends on: Tahap 4**

### Deliverables:
- [ ] Google Sheets API integration
- [ ] Sync engine core (Spreadsheet → Supabase)
- [ ] Column mappers (per tabel)
- [ ] Validators (per tabel)
- [ ] Manual sync endpoint (`/api/sync/manual`)
- [ ] Weekly sync endpoint (`/api/sync/weekly`)
- [ ] Vercel Cron configuration
- [ ] Sync log recording
- [ ] Sync conflict detection
- [ ] Setting page: Spreadsheet Integration section
- [ ] Setting page: Sync Logs section
- [ ] Setting page: Sync Conflicts section
- [ ] Sync conflict resolver UI

### File yang dibuat:
- `lib/google-sheets.ts`
- `lib/sync/sync-engine.ts`
- `lib/sync/mappers.ts`
- `lib/sync/validators.ts`
- `app/api/sync/manual/route.ts`
- `app/api/sync/weekly/route.ts`

---

## Tahap 6: Modul Pendukung
**Depends on: Tahap 3**

### 6a. Tema Bulanan
- [ ] List tema per bulan per unit
- [ ] CRUD tema
- [ ] Bulk update

### 6b. Perlu Cek
- [ ] List data ambigu
- [ ] Form validasi → konversi ke Kaldik
- [ ] Abaikan

### 6c. Tanpa Tanggal
- [ ] List data tanpa tanggal
- [ ] Konversi ke Kaldik
- [ ] Simpan sebagai catatan
- [ ] Abaikan

### 6d. Karyawan
- [ ] List karyawan (filter unit, status)
- [ ] CRUD karyawan
- [ ] Import dari CSV
- [ ] Info ulang tahun

### 6e. Hari Khusus
- [ ] List hari khusus
- [ ] CRUD hari khusus
- [ ] Filter jenis (Kristen, Nasional, Sekolah)

---

## Tahap 7: Generate Doa & Hasil Pokok Doa
**Depends on: Tahap 6**

### 7a. Generate Doa
- [ ] Generate page (pilih bulan, tahun, unit mode)
- [ ] Generate engine (prioritas 1-11, dari PrayerService.gs)
- [ ] Template management (30+ template default)
- [ ] Template rendering (variable substitution)
- [ ] Anti-timpa rules (locked, final, edited)
- [ ] Options: overwriteAutoDraft, skipEdited, skipFinal
- [ ] Preview hasil generate
- [ ] Regenerate per tanggal

### 7b. Hasil Pokok Doa
- [ ] List doa per bulan
- [ ] Edit isi doa
- [ ] Lock/unlock individual
- [ ] Finalize individual
- [ ] Finalize sebulan
- [ ] Status badge: Auto Draft, Edited Manual, Final

---

## Tahap 8: Export & Setting
**Depends on: Tahap 7**

### 8a. Export
- [ ] Export Kaldik ke HTML (print-ready)
- [ ] Export Pokok Doa ke HTML (print-ready)
- [ ] Filter: bulan, tahun, unit
- [ ] Print preview

### 8b. Setting (lengkap)
- [ ] Section Aplikasi (nama, TA aktif, semester)
- [ ] Section Unit (kelola unit)
- [ ] Section Spreadsheet Integration
- [ ] Section Sync Schedule
- [ ] Section Sync Logs
- [ ] Section Sync Conflicts
- [ ] Section Security (PIN, token)
- [ ] Section Backup/Export

---

## Dependency Graph

```
Tahap 1 (Foundation)
  │
  ├─→ Tahap 2 (Layout & Dashboard)
  │     │
  │     ├─→ Tahap 3 (Kaldik CRUD)
  │     │     │
  │     │     ├─→ Tahap 4 (Import)
  │     │     │     │
  │     │     │     └─→ Tahap 5 (Sync Engine)
  │     │     │
  │     │     ├─→ Tahap 6 (Modul Pendukung)
  │     │     │
  │     │     └─→ Tahap 7 (Generate Doa)
  │     │           │
  │     │           └─→ Tahap 8 (Export & Setting)
  │     │
  │     └─→ Auth (di dalam Tahap 2)
  │
  └─→ Database Setup (bisa paralel)
```

---

## Catatan Penting

1. **Jangan skip tahap** — setiap tahap bergantung pada tahap sebelumnya
2. **Test setiap tahap** — pastikan fitur berfungsi sebelum lanjut
3. **Update Brain.md** — setelah setiap tahap selesai
4. **Commit per tahap** — git commit setelah setiap tahap selesai
5. **Review PRD** — pastikan sesuai requirement sebelum coding
