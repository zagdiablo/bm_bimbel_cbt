# ROLE
Kamu adalah Senior Full-Stack Engineer & Solution Architect. Tugasmu membangun 
aplikasi **Computer Based Test (CBT)** yang lengkap, production-ready, dan 
dapat berjalan tanpa server mahal dengan memanfaatkan **Google Apps Script (GAS)** 
sebagai backend.

# TUJUAN
Bangun aplikasi CBT end-to-end yang mendukung:
- Manajemen bank soal (CRUD)
- Pelaksanaan ujian online dengan timer & anti-cheat dasar
- Penilaian otomatis (auto-grading)
- Import soal dari **DOCX**, **XLSX**
- Export hasil ujian ke **PDF**, **XLSX**
- Integrasi **Google Apps Script** + **Google Sheets** sebagai database & API

# TECH STACK (WAJIB)
- **Frontend**: React + Vite + TypeScript + TailwindCSS + shadcn/ui + React Router + Zustand (state) + React Query
- **Backend**: Google Apps Script (Web App) + Google Sheets sebagai DB
- **Auth**: Google OAuth (via GAS) atau JWT sederhana (email + password ter-hash)
- **Parsing File**:
  - DOCX → `mammoth.js` (client) / `docx` (server-side opsional)
  - XLSX → `xlsx` (SheetJS)
  - PDF → `jspdf` + `jspdf-autotable` (export), `pdf-parse` (import opsional)
- **Charts**: Recharts (untuk statistik)
- **Deployment**: Frontend → Vercel/Netlify, Backend → GAS Web App

# FITUR LENGKAP

## 1. Autentikasi & Role
- 3 role: **Admin**, **Guru**, **Siswa**
- Login via Google OAuth (utama) + email/password (fallback)
- Session management (token di localStorage + validasi ke GAS)

## 2. Manajemen Bank Soal (Admin/Guru)
- CRUD soal dengan tipe: **Pilihan Ganda**, **PG Kompleks**, **Benar/Salah**, **Isian Singkat**, **Essay** (manual grading)
- Field soal: pertanyaan, gambar (opsional), opsi jawaban, kunci, bobot, tingkat kesulitan, kategori/mapel, tags
- **Bulk import**:
  - **XLSX**: template kolom [no, tipe, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci, bobot, kategori]
  - **DOCX**: parsing format terstruktur (gunakan heading/penomoran)
  - Sediakan **tombol download template** (.xlsx & .docx) yang siap diisi
- Preview & edit inline
- Filter by kategori, tipe, tingkat kesulitan

## 3. Manajemen Ujian (Admin/Guru)
- Buat ujian: nama, mapel, durasi, jadwal mulai/selesai, jumlah soal (random dari bank), acak soal, acak opsi
- Assign ke kelas/siswa
- Token ujian (opsional)
- Preview ujian sebelum publish

## 4. Pelaksanaan Ujian (Siswa)
- UI bersih dengan:
  - Timer countdown (sinkron dengan server, cegah manipulasi)
  - Navigasi soal (grid nomor, tandai ragu-ragu)
  - Auto-save jawaban tiap perubahan (debounce → kirim ke GAS)
  - Resume ujian jika koneksi terputus
- **Anti-cheat dasar**: deteksi tab switch, disable copy/paste, fullscreen request
- Submit → konfirmasi → auto-grade (kecuali essay)

## 5. Penilaian & Hasil
- Auto-grade: PG, PG kompleks, B/S, isian (normalize case/trim)
- Essay: form manual grading untuk Guru
- Hasil siswa: skor, benar/salah, pembahasan (jika diaktifkan)
- **Export hasil**:
  - **PDF** (per siswa & rekap kelas) dengan header sekolah, logo, tabel nilai
  - **XLSX** (rekap semua siswa: nama, NIS, skor, waktu submit, status)
- Statistik: rata-rata, nilai tertinggi/terendah, distribusi nilai (chart)

## 6. Dashboard
- Admin: total user, ujian aktif, soal, submission
- Guru: ujian miliknya, soal miliknya, submission yang perlu dinilai
- Siswa: ujian mendatang, riwayat ujian, nilai

# INTEGRASI GOOGLE APPS SCRIPT
Buat file `gas/Code.gs` dan `gas/appsscript.json` yang berisi:
- Struktur **spreadsheet** dengan sheet: `Users`, `Questions`, `Exams`, `ExamQuestions`, `Submissions`, `Answers`, `Logs`
- Fungsi **doGet/doPost** sebagai API router (action-based: `?action=login`, `?action=getQuestions`, dst.)
- **CRUD** lengkap untuk tiap entitas
- **Auth middleware** (validasi token di setiap request)
- **CORS** handling
- Fungsi `setupSpreadsheet()` untuk bootstrap sheet + header otomatis
- Timezone: `Asia/Jakarta`
- Dokumentasikan cara deploy: `Extensions > Apps Script > Deploy > New Deployment > Web App > Anyone`

Sertakan file `gas/README.md` dengan langkah setup lengkap (buat spreadsheet → paste kode → deploy → salin URL ke `.env`).

# STRUKTUR REPOSITORY (WAJIB DIIKUTI)
cbt-app/
├── frontend/
│ ├── src/
│ │ ├── components/ # UI reusable
│ │ ├── pages/ # Admin, Guru, Siswa
│ │ ├── features/ # bank-soal, ujian, hasil, auth
│ │ ├── lib/ # api client, parser (docx/xlsx/pdf), utils
│ │ ├── hooks/
│ │ ├── stores/
│ │ └── types/
│ ├── public/templates/ # template .xlsx & .docx untuk import
│ ├── .env.example
│ ├── package.json
│ └── vite.config.ts
├── gas/
│ ├── Code.gs
│ ├── appsscript.json
│ └── README.md
├── docs/
│ ├── API.md
│ ├── USER_GUIDE.md
│ └── ARCHITECTURE.md
└── README.md

text

# ATURAN PENGEMBANGAN
1. **TypeScript strict mode** — tidak boleh ada `any` yang tidak beralasan.
2. **Error handling** konsisten: semua API call dibungkus, tampilkan toast.
3. **Loading states** & **empty states** wajib ada di setiap halaman.
4. **Responsive** — mobile-first (siswa sering pakai HP).
5. **Aksesibilitas**: label form, kontras warna, keyboard navigation.
6. **Keamanan**:
   - Hash password (bcrypt/Web Crypto) di GAS
   - Validasi input di client & server
   - Rate limit di GAS untuk submit
   - Jangan expose kunci jawaban ke client saat ujian berlangsung (kirim soal tanpa `kunci`)
7. **Kode bersih**: komponen kecil, fungsi murni, no duplication.
8. Sertakan **komentar secukupnya** di bagian non-trivial (parsing DOCX, timer sync, anti-cheat).
9. Sertakan **seed data** contoh (5 soal PG, 1 ujian demo, 1 akun tiap role) via script `seed.gs`.

# DELIVERABLES
Setelah selesai, hasilkan:
- [ ] Seluruh source code sesuai struktur di atas
- [ ] `README.md` root dengan: prasyarat, cara install, cara setup GAS, cara deploy, akun demo
- [ ] `docs/API.md` (daftar endpoint GAS + payload)
- [ ] `docs/USER_GUIDE.md` (panduan admin/guru/siswa)
- [ ] Template import `.xlsx` & `.docx` di `public/templates/`
- [ ] `.env.example` dengan variabel: `VITE_GAS_API_URL`, `VITE_APP_NAME`
- [ ] Script `npm run dev` berfungsi tanpa error

# KRITERIA SUKSES
- Siswa bisa login → ikut ujian → submit → lihat nilai, tanpa error.
- Guru bisa import soal dari XLSX & DOCX → buat ujian → export hasil PDF & XLSX.
- Admin bisa kelola user & lihat statistik.
- Semua data persist di Google Sheets via GAS.
- UI rapi, responsive, dan konsisten.

# URUTAN PENGERJAAN (SARAN)
1. Scaffold frontend + setup Tailwind + shadcn/ui
2. Buat skema & setup GAS (sheet, auth, CRUD questions)
3. Halaman login + role guard
4. Bank soal + import XLSX/DOCX
5. Manajemen ujian
6. Halaman ujian siswa (timer, autosave, anti-cheat)
7. Auto-grading + halaman hasil + export PDF/XLSX
8. Dashboard & statistik
9. Seed data & dokumentasi

**Mulai sekarang.** Sebelum menulis kode besar, tampilkan dulu:
1. Rencana file yang akan dibuat (checklist)
2. Skema Google Sheets
3. Ringkasan endpoint API GAS
Tunggu konfirmasi saya sebelum lanjut ke implementasi penuh.
