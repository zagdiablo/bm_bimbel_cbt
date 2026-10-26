# PROGRESS — Implementasi CBT

Terakhir diperbarui: 26 Oktober 2026
Status keseluruhan: **Selesai (frontend terverifikasi; backend GAS siap deploy, belum diuji di akun Google nyata)**

---

## 1. Ringkasan milestone

| # | Milestone | Status | Bukti |
|---|---|---|---|
| 1 | Scaffold React + Vite + TS strict + Tailwind + shadcn-pattern + router + Zustand + React Query | ✅ | `npm run build` lulus, 3406 modul |
| 2 | Setup GAS: skema 7 sheet, auth, CRUD Questions, health | ✅ (kode) | `gas/Config.gs`, `Db.gs`, `Auth.gs`, `Questions.gs`, `Code.gs` |
| 3 | Login + role guard + mock backend (`VITE_USE_MOCK=auto`) | ✅ | Login 3 role + akun baru diuji di browser |
| 4 | Bank soal CRUD + import XLSX/DOCX + `IMPORT_FORMAT.md` | ✅ | Import 4 soal XLSX & 4 soal DOCX berhasil |
| 5 | Manajemen ujian (jadwal, pool soal, publish, kelas, token) | ✅ | Ujian 9 soal dibuat + diterbitkan dari UI |
| 6 | Pelaksanaan ujian siswa (timer, autosave, anti-cheat, resume) | ✅ | 5 soal dijawab, autosave tersimpan, submit → nilai 100 |
| 7 | Auto-grading + hasil + export PDF/XLSX | ✅ | Essay pending → guru nilai 5 → nilai 100; PDF & XLSX terunduh |
| 8 | Dashboard & statistik (Recharts) | ✅ | Dashboard 3 role + distribusi & analisis butir soal |
| 9 | Seed data + template `.xlsx`/`.docx` | ✅ | `gas/seed.gs`, `frontend/public/templates/*` |
| 10 | Dokumentasi + build hijau | ✅ | README, docs/*, `npm run build` sukses |

---

## 2. Keputusan teknis penting

| Topik | Keputusan | Alasan |
|---|---|---|
| Password | PBKDF2-HMAC-SHA256 **100.000 iterasi di browser** + HMAC pepper di server | GAS tidak punya bcrypt & tidak sanggup 100k HMAC/request. Password asli tidak dikirim |
| Token | HMAC stateless, access 2 jam (memory), refresh 7 hari (localStorage), `tokenVersion` | Tanpa sheet Sessions; logout-all via versi token |
| CORS | POST `text/plain` + token di body | GAS tidak menangani preflight OPTIONS |
| Timer | `expiresAt` server, resync hanya bila selisih >3 detik | Cegah manipulasi jam & jitter |
| Autosave | Satu endpoint `attempts.save`, batch 5 detik / 5 jawaban, heartbeat 30 detik | Hemat kuota GAS |
| Retry | Backoff 500ms → 1s → 2s, submit idempoten | LockService dapat timeout saat submit serempak |
| PG kompleks | All-or-nothing | Keputusan final sesi Plan |
| Kunci jawaban | Tidak pernah dikirim saat attempt; hasil sesuai `tampilkanPembahasan`; token ujian hanya flag `requiresToken` | Anti-cheat |
| Anti-cheat | Catat + peringatan, **bukan** auto-submit (`AUTO_SUBMIT_ON_CHEAT=false`) | Hindari false positive |
| OAuth | Config-gated; tombol tidak dirender bila Client ID kosong | Login utama tetap email/password |
| Export | PDF/XLSX di browser dari `results.exportData` | GAS tidak cocok menghasilkan file |
| Template | Digenerate via `npm run generate:templates` (SheetJS + docx) | Binary dapat diregenerasi |
| Mock | localStorage, delay 300–800ms, simulasi error via toolbar | `npm run dev` langsung bisa didemokan |

---

## 3. File yang dibuat

### Root
- `README.md`, `PROGRESS.md`, `.gitignore`
- `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/IMPORT_FORMAT.md`, `docs/USER_GUIDE.md`

### gas/ (12 file)
`appsscript.json`, `Code.gs`, `Config.gs`, `Db.gs`, `Auth.gs`, `Users.gs`,
`Questions.gs`, `Exams.gs`, `Attempts.gs`, `Grading.gs`, `Dashboard.gs`,
`setup.gs`, `seed.gs`, `README.md`

### frontend/ (inti)
- Konfigurasi: `package.json`, `vite.config.ts`, `tsconfig.json`,
  `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`,
  `.env.example`, `scripts/generate-templates.mjs`, `scripts/derive-credential.mjs`
- `public/templates/template-soal.xlsx`, `template-soal.docx`
- `src/app/`: `router.tsx`, `providers.tsx`, `guards.tsx`, `error-boundary.tsx`
- `src/components/ui/`: 17 primitives (button, input, dialog, select, tabs, dsb.)
- `src/components/layout/`: `app-shell`, `sidebar`, `topbar`, `backend-status`
- `src/components/common/`: 11 komponen (empty/error/loading, pagination, badges, dsb.)
- `src/features/`
  - `auth/queries.ts`
  - `users/queries.ts`, `users/components/user-form-dialog.tsx`
  - `questions/queries.ts`, 6 komponen (table, form, filter, preview, import, template)
  - `exams/queries.ts`, `question-picker.tsx`, `exam-preview-dialog.tsx`
  - `attempt/hooks/{use-autosave,use-exam-timer,use-anti-cheat}.ts`,
    `components/{question-card,question-navigator}.tsx`
  - `results/queries.ts`, `submission-detail-dialog.tsx`, `export-buttons.tsx`
  - `dashboard/queries.ts`, `dashboard-view.tsx`
- `src/lib/`: `api.ts`, `api-client.ts`, `env.ts`, `constants.ts`, `utils.ts`,
  `password.ts`, `parse-common.ts`, `parse-xlsx.ts`, `parse-docx.ts`,
  `shuffle.ts`, `grading.ts`, `export-pdf.ts`, `export-xlsx.ts`, `notify.ts`,
  `query-keys.ts`, `navigation.ts`
  - `lib/mock/`: `db.ts`, `seed.ts`, `handler.ts` (≈35 action, kontrak sama dengan GAS)
- `src/stores/`: `auth-store.ts`, `attempt-store.ts`
- `src/hooks/`: debounce, media query, document title
- `src/pages/`: login, 404, unauthorized; admin (dashboard/users/activity/settings);
  guru (dashboard/bank soal/ujian/form ujian/hasil/statistik);
  siswa (dashboard/daftar ujian/kerjakan/hasil/riwayat)

---

## 4. Verifikasi yang sudah dilakukan (browser, mode mock)

1. **Login**
   - Demo 3 role berhasil.
   - Buat user `tes@cbt.local` dari Admin → logout → login dengan sandi baru →
     berhasil (membuktikan PBKDF2 client + verifikasi mock).
2. **Admin**
   - Dashboard menampilkan 5 pengguna, ujian aktif, soal, pengerjaan.
   - Daftar pengguna, tambah pengguna, pengaturan sekolah (mock), aktivitas.
3. **Guru**
   - Bank soal 9 soal awal.
   - Import XLSX template → pratinjau 4 valid → tersimpan (total 13).
   - Import DOCX template → pratinjau 4 valid.
   - Buat ujian 9 soal + terbitkan dari form (validasi + question picker).
   - Hasil: daftar peserta, detail jawaban, koreksi essay 5/5 → nilai 100.
   - Export PDF rekap & XLSX rekap berhasil terunduh.
   - Statistik menampilkan distribusi & akurasi.
4. **Siswa**
   - Kerjakan ujian demo 5 PG: jawab semua, autosave → “Jawaban tersimpan”,
     submit → 100, kunci & pembahasan tampil.
   - Unduh PDF hasil.
   - Ujian campuran (9 soal termasuk essay dan isian): submit → 66,67 dengan
     status “Perlu Dinilai”; guru menilai essay → 100.
5. **Teknis**
   - `npx tsc --noEmit` lulus.
   - `npm run build` lulus (bundle dipecah; xlsx/jspdf/mammoth lazy).
   - Console browser tanpa error pada alur di atas.

### Catatan bug yang ditemukan & diperbaiki saat pengujian
- Form dialog ter-reset setiap render karena `form`/objek user masuk dependency
  effect. Diperbaiki dengan dependency id (`open`, `userId`, `questionId`,
  `loadedExamId`) di `UserFormDialog`, `QuestionFormDialog`, `ExamFormPage`.
- `Answers` seed Citra tidak konsisten (60 vs 40). Diperbaiki menjadi 3 benar /
  2 salah / 0 kosong.
- Token ujian sebelumnya bisa ikut pada payload hasil siswa. Sekarang dihapus
  untuk role siswa (mock & GAS).
- Dashboard admin menautkan “Kelola ujian” ke route guru. Tombol dihapus untuk
  admin.

---

## 5. Belum diuji / TODO untuk sesi berikutnya

### Wajib sebelum produksi
- [ ] Jalankan `setupSpreadsheet()` dan `seedDemoData()` di spreadsheet nyata.
- [ ] Uji `health`, login, CRUD soal, ujian, submit, hasil lewat URL `/exec`.
- [ ] Pastikan deployment `Anyone` + URL `/exec` (respons JSON, bukan HTML).
- [ ] Uji import ke GAS (SheetJS/mammoth di browser → `bulkCreate`).
- [ ] Uji Google OAuth dengan Client ID nyata (frontend + Script Property).
- [ ] Uji dua submit bersamaan → `LOCK_TIMEOUT` → retry client.
- [ ] Uji logo sekolah CORS di PDF.
- [ ] Set `SPREADSHEET_ID`/`TOKEN_SECRET` di spreadsheet produksi, jangan pakai
      data demo.
- [ ] Nonaktifkan/ubah akun demo di produksi.

### Pengembangan lanjutan (opsional)
- [ ] Arsip otomatis per semester (endpoint admin + pemindahan baris).
- [ ] Upload gambar soal ke Drive (saat ini URL).
- [ ] Penugasan ujian per siswa (saat ini berbasis kelas).
- [ ] Remidi/retake dengan aturan guru.
- [ ] Dark mode toggle (token warna sudah ada).
- [ ] Notifikasi email hasil ujian.
- [ ] Unit test parser & grading (Vitest belum ditambahkan agar dependency
      tetap sesuai stack yang dikunci).
- [ ] Endpoint `exams.list` untuk admin agar bisa memantau semua ujian dari UI
      (saat ini dashboard admin hanya agregat).

---

## 6. Cara melanjutkan sesi baru

1. Baca `README.md` (setup) dan bagian 2 di file ini (keputusan).
2. `cd frontend && npm install && npm run dev` → cek alur demo.
3. Untuk backend: buka `gas/README.md`, buat spreadsheet, jalankan
   `setupSpreadsheet`, isi `.env`, uji `?action=health`.
4. Jika menambah action baru:
   - tambah tipe di `src/types/api.ts`/`domain.ts`,
   - tambah fungsi di `src/lib/api.ts`,
   - implementasi di `src/lib/mock/handler.ts` **dan** `gas/*.gs`,
   - perbarui `docs/API.md`.
5. Jalankan `npm run typecheck && npm run build` sebelum selesai.
