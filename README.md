# CBT Sekolah — Computer Based Test

Aplikasi ujian online modern untuk sekolah: bank soal, pelaksanaan ujian dengan
timer server, penilaian otomatis, koreksi essay, rekap nilai PDF/Excel, dan
statistik — tanpa server mahal.

- **Frontend**: React 18 + Vite + TypeScript strict + TailwindCSS + Radix (pola shadcn/ui) + React Router 6 + Zustand + React Query 5 + Recharts
- **Backend**: Google Apps Script Web App + Google Spreadsheet (7 sheet)
- **Parsing/Export**: SheetJS, mammoth, jsPDF + autoTable, Recharts
- **Deploy**: Vercel/Netlify (frontend) + GAS Web App (backend)

---

## ✨ Fitur

| Modul | Kemampuan |
|---|---|
| Auth | Login email/password (3 role), Google OAuth opsional, ganti sandi, sesi 2 jam + refresh 7 hari, pencabutan sesi |
| Bank soal | CRUD 5 tipe soal (PG, PG kompleks, B/S, isian, essay), filter, pratinjau kunci, soft delete |
| Import | XLSX & DOCX dengan validasi per baris, pratinjau, template siap isi |
| Ujian | Jadwal, durasi, token, kelas target, acak soal/opsi, publish/tutup, pratinjau |
| Pelaksanaan | Timer server, autosave batching 5s/5 jawaban, heartbeat, resume, anti-cheat dasar |
| Penilaian | Auto-grade 4 tipe, essay manual, skor all-or-nothing PG kompleks, rekap otomatis |
| Hasil | Halaman nilai siswa, pembahasan opsional, PDF per siswa, PDF & XLSX rekap kelas |
| Statistik | Rata-rata/min/max, distribusi nilai, analisis butir soal, grafik Recharts |
| Admin | CRUD pengguna, reset sandi, pengaturan sekolah, log aktivitas, dashboard |
| Demo | Mock backend localStorage dengan data contoh, simulasi error, reset data |

---

## 🚀 Mulai cepat (mode demo, tanpa GAS)

Prasyarat: **Node.js ≥ 18** (disarankan 20+) dan npm.

```bash
cd frontend
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Buka `http://localhost:5173`.

Karena `VITE_GAS_API_URL` kosong, aplikasi otomatis memakai **mock backend** di
`localStorage`. Semua fitur dapat dicoba tanpa Google Sheets.

### Akun demo

| Peran | Email | Kata sandi |
|---|---|---|
| Admin | `admin@cbt.local` | `Admin#123` |
| Guru | `guru@cbt.local` | `Guru#123` |
| Siswa | `siswa@cbt.local` | `Siswa#123` |

Data demo mencakup 9 soal, 2 ujian, dan 3 nilai contoh. Gunakan tombol **Bug** di
topbar untuk mensimulasikan error 500 atau mereset data demo.

---

## 🔗 Menghubungkan ke Google Sheets (produksi)

1. Buat Google Spreadsheet baru.
2. **Extensions → Apps Script**, lalu salin semua file dari folder [`gas/`](./gas) sesuai nama file.
3. Ganti `appsscript.json` (Project Settings → centang *Show appsscript.json*).
4. Jalankan fungsi **`setupSpreadsheet`** (membuat 7 sheet + properti).
5. Opsional: jalankan **`seedDemoData`** untuk data contoh.
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Salin URL yang berakhiran `/exec` ke `frontend/.env`:

```env
VITE_GAS_API_URL=https://script.google.com/macros/s/XXXXXXXX/exec
VITE_USE_MOCK=false
```

8. Jalankan ulang `npm run dev` atau deploy ulang frontend.

Panduan langkah demi langkah + troubleshooting: [`gas/README.md`](./gas/README.md).

### Variabel environment

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `VITE_GAS_API_URL` | produksi | kosong | URL Web App `/exec`; kosong = mock |
| `VITE_APP_NAME` | tidak | `CBT Sekolah` | Nama di sidebar/judul |
| `VITE_GOOGLE_CLIENT_ID` | tidak | kosong | Jika kosong, tombol Google tidak dirender |
| `VITE_USE_MOCK` | tidak | `auto` | `auto` / `true` / `false` |
| `VITE_MOCK_ERROR_RATE` | tidak | `0` | Persen error acak mock (0–100) |

---

## 🧱 Struktur repository

```text
.
├── frontend/
│   ├── src/
│   │   ├── app/            # router, providers, guards, error boundary
│   │   ├── components/     # UI (shadcn-pattern) + layout + common
│   │   ├── features/       # auth, users, questions, exams, attempt, results, dashboard
│   │   ├── hooks/          # debounce, media query, title
│   │   ├── lib/            # api client, mock backend, parser, export, utils
│   │   ├── pages/          # admin, guru, siswa
│   │   ├── stores/         # auth (memory token), attempt (answers/pending)
│   │   └── types/          # domain + API types
│   ├── public/templates/   # template-soal.xlsx & .docx
│   ├── scripts/            # generator template + helper credential
│   └── .env.example
├── gas/                    # backend Apps Script (12 file .gs + manifest + README)
├── docs/
│   ├── API.md              # kontrak endpoint lengkap
│   ├── ARCHITECTURE.md     # arsitektur, timer, grading, quota, arsip
│   ├── IMPORT_FORMAT.md    # format baku XLSX & DOCX
│   └── USER_GUIDE.md       # panduan admin/guru/siswa
├── PROGRESS.md
├── PROMPT.md
└── README.md
```

---

## 🛠️ Script npm

Dijalankan dari `frontend/`:

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server Vite (port 5173) |
| `npm run build` | Typecheck strict + build produksi ke `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Pratinjau hasil build |
| `npm run generate:templates` | Regenerasi template XLSX/DOCX di `public/templates/` |

Helper API:

```bash
node frontend/scripts/derive-credential.mjs guru@cbt.local 'Guru#123'
```

---

## 🔐 Keamanan (ringkasan)

- Kata sandi **tidak pernah** dikirim ke server: browser menurunkan verifier
  PBKDF2-SHA256 100.000 iterasi; server menyimpan HMAC-SHA256 verifier dengan
  pepper `PASSWORD_PEPPER`.
- Access token 2 jam disimpan **di memory**; refresh token 7 hari di
  `localStorage`. Logout/ganti sandi mencabut semua token lewat `tokenVersion`.
- Kunci jawaban & pembahasan **tidak disertakan** pada payload attempt siswa.
  Token ujian juga tidak dikirim ke siswa.
- Semua action backend memeriksa role dan kepemilikan data.
- Mutasi memakai `LockService`; rate limit memakai `CacheService`.
- Jenis soal PG kompleks dinilai *all-or-nothing* (tanpa partial credit).
- Anti-cheat mencatat tab switch/copy/fullscreen exit, **tanpa auto-submit**
  (dapat diubah di `gas/Config.gs`).

Detail lengkap: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## ✅ Status verifikasi

Sudah diuji langsung di browser (mode mock):

- Login 3 role + login akun yang baru dibuat (password hashing end-to-end).
- Admin: dashboard, daftar pengguna, tambah pengguna, pengaturan, aktivitas.
- Guru: bank soal, import XLSX (4 soal) & DOCX (4 soal), buat ujian 9 soal,
  terbitkan, rekap hasil, detail pengerjaan, koreksi essay, export PDF & XLSX,
  statistik.
- Siswa: dashboard, daftar ujian, petunjuk, mulai ujian, jawab 5 soal PG,
  autosave + resume, submit, lihat nilai 100, download PDF; ujian campuran
  (essay) → status *Perlu Dinilai* → guru beri skor → nilai menjadi 100.
- `npm run typecheck` dan `npm run build` lulus tanpa error.

**Belum diuji di environment nyata**: deployment GAS + Google Sheets (perlu
spreadsheet dan akun Google Anda) dan Google OAuth (perlu Client ID). Lihat
checklist di [`PROGRESS.md`](./PROGRESS.md).

---

## ⚠️ Batasan yang diketahui

- Satu siswa = satu attempt per ujian (belum ada remidi/retake).
- Penugasan ujian berbasis **kelas**; penugasan ke siswa tertentu belum tersedia.
- Gambar soal berupa URL, belum ada upload file/Drive.
- Pencarian & filter membaca sheet di memori; cocok untuk skala sekolah, bukan
  puluhan ribu baris.
- Export PDF/XLSX dibuat di browser, bukan di server (agar tidak kena limit GAS).
- Mode mock menyimpan data di `localStorage` browser, bukan database sungguhan.
- Belum ada notifikasi email/WhatsApp otomatis.

---

## 📚 Dokumentasi

- [API Reference](./docs/API.md)
- [Arsitektur & keputusan teknis](./docs/ARCHITECTURE.md)
- [Format import soal](./docs/IMPORT_FORMAT.md)
- [Panduan pengguna](./docs/USER_GUIDE.md)
- [Panduan deploy backend](./gas/README.md)
- [Progress & catatan implementasi](./PROGRESS.md)

---

## Deployment frontend

**Vercel**

1. Import repository → root directory `frontend`.
2. Build command `npm run build`, output `dist`.
3. Tambahkan environment variables (Production & Preview).
4. Deploy. `vercel.json` sudah berisi rewrite SPA.

**Netlify**

1. Base directory `frontend`.
2. Build command `npm run build`, publish directory `frontend/dist`.
3. Tambahkan environment variables.
4. Deploy. `public/_redirects` sudah menangani route SPA.

Pastikan domain produksi ditambahkan ke *Authorized JavaScript origins* bila
memakai Google OAuth.
