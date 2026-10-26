# Arsitektur Aplikasi CBT

## 1. Ringkasan

Aplikasi terdiri dari dua bagian yang dideploy terpisah:

```text
┌────────────────────────────┐        HTTPS (POST text/plain)        ┌──────────────────────────┐
│  Frontend React + Vite     │ ───────────────────────────────────> │  Google Apps Script      │
│  Vercel / Netlify          │ <─────────────────────────────────── │  Web App (Anyone)        │
│                            │        JSON envelope                 │                          │
│  - React Router 6          │                                      │  - Router action-based   │
│  - React Query 5           │                                      │  - Auth HMAC token       │
│  - Zustand (token+attempt) │                                      │  - Grading engine        │
│  - SheetJS / mammoth /     │                                      │  - LockService           │
│    jsPDF (lazy loaded)     │                                      │  - CacheService limits   │
└────────────────────────────┘                                      └────────────┬─────────────┘
                                                                                 │
                                                                     ┌───────────▼────────────┐
                                                                     │ Google Spreadsheet     │
                                                                     │ 7 sheet (database)     │
                                                                     └────────────────────────┘
```

Tidak ada server aplikasi terpisah. Frontend dapat berjalan sepenuhnya dengan
**mock backend localStorage** saat `VITE_GAS_API_URL` kosong, memakai kontrak
API yang sama dengan backend GAS.

## 2. Struktur repository

```text
frontend/   React app (TypeScript strict)
gas/        Backend Apps Script (.gs) + manifest + panduan deploy
docs/       API, arsitektur, format import, panduan pengguna
```

## 3. Skema database (7 sheet)

Semua ID berformat `PREFIX-<12 hex>`. Timestamp disimpan sebagai ISO-8601
(string), ditampilkan dalam zona `Asia/Jakarta`.

| Sheet | Kolom penting | Indeks logis |
|---|---|---|
| `Users` | `id, email, name, role, nis, kelas, passwordHash, googleSub, active, tokenVersion` | email (unik), role |
| `Questions` | `id, ownerId, tipe, pertanyaan, opsiJson, kunciJson, bobot, tingkat, kategori, tags, aktif` | ownerId, kategori |
| `Exams` | `id, ownerId, nama, mapel, durasiMenit, mulaiAt, selesaiAt, jumlahSoal, token, kelasTargetJson, status` | ownerId, status |
| `ExamQuestions` | `id, examId, questionId, urutan, bobot` | examId, questionId |
| `Submissions` | `id, examId, studentId, mulaiAt, expiresAt, submitAt, status, skor, benar, salah, kosong, perluManual, tabSwitchCount, questionOrderJson` | examId, studentId |
| `Answers` | `id, examId, userId, submissionId, questionId, jawabanJson, ragu, benar, skor` | **examId, userId, submissionId** (denormalisasi untuk arsip) |
| `Logs` | `id, ts, actorId, action, entity, entityId, metaJson` | action, ts |

JSON disimpan sebagai string di kolom `*Json`. Detail lengkap ada di
`gas/Config.gs` (`CONFIG.SHEETS`) dan `docs/API.md`.

### Mengapa `Answers` didenormalisasi

`Answers` menyimpan `examId` dan `userId` selain `submissionId`. Tujuannya agar
arsip/analitik per ujian atau per siswa tidak perlu join ke `Submissions`.

### Strategi arsip `Answers` per semester

Belum diimplementasikan sebagai UI, tetapi skemanya siap:

1. Akhir semester, guru/admin membuat spreadsheet arsip (**File → Make a copy**
   atau spreadsheet baru).
2. Pindahkan baris `Answers`, `Submissions`, dan `Logs` lama ke salinan tersebut
   (filter `examId` per periode), lalu hapus dari spreadsheet aktif.
3. Karena `examId` ada di setiap baris `Answers`, proses arsip tidak memerlukan
   join dan aman dilakukan per ujian.
4. Praktik yang disarankan: arsipkan setelah nilai final diunduh (PDF/XLSX), dan
   simpan salinan read-only.

## 4. Autentikasi

### 4.1 Protokol kata sandi

Apps Script **tidak menyediakan bcrypt** dan mengeksekusi maksimal ~6 menit per
request; 100.000 iterasi HMAC di server akan membuat login sangat lambat. Karena
itu KDF dijalankan di browser:

```text
Browser                                                    Apps Script
────────                                                   ───────────
salt = "cbt:v1:" + lowercase(email)
verifier = PBKDF2-HMAC-SHA256(password, salt, 100_000, 32B)
        ──── credential (base64) ──── POST auth.login ───>
                                                           stored = HMAC-SHA256(credential, PASSWORD_PEPPER)
                                                           bandingkan constant-time
```

- Password asli **tidak pernah** meninggalkan browser.
- Server menyimpan HMAC dari verifier dengan pepper `PASSWORD_PEPPER` (Script
  Property terpisah dari `TOKEN_SECRET`, tidak ada di spreadsheet).
- Salt deterministik dari email membuat alur sederhana tanpa endpoint challenge;
  keamanannya tetap karena verifier 256-bit.
- Login Google (opsional) memakai GIS di frontend. Backend memverifikasi
  `id_token` via `oauth2.googleapis.com/tokeninfo`, memeriksa `aud` =
  `GOOGLE_CLIENT_ID`, lalu mencocokkan email dengan akun yang sudah terdaftar
  (tanpa auto-provisioning).

### 4.2 Token & sesi

| Token | TTL | Penyimpanan | Isi |
|---|---|---|---|
| Access | 2 jam | **memory Zustand** (tidak di localStorage) | `sub, typ=access, exp, tv` |
| Refresh | 7 hari | `localStorage` | `sub, typ=refresh, exp, tv` |

- Token ditandatangani HMAC-SHA256; `TOKEN_SECRET` hanya di server.
- `tv` (token version) dibandingkan dengan kolom `Users.tokenVersion`. Logout,
  ganti sandi, dan reset sandi menaikkan versi sehingga semua token lama mati.
- Mitigasi XSS: access token tidak pernah dipersist; refresh token dipisah.
- Client otomatis memanggil `auth.refresh` sekali saat menerima `TOKEN_EXPIRED`
  (single-flight), lalu mengulang request.

## 5. Kontrak API

- Semua request: `POST {WEB_APP_URL}?action=<action>` dengan body JSON dan
  header `Content-Type: text/plain;charset=utf-8`.
- **Alasan `text/plain`:** GAS Web App tidak menangani preflight `OPTIONS`.
  `application/json` atau custom header (`Authorization`) memicu preflight dan
  gagal CORS. Token dikirim di body.
- GAS selalu membalas HTTP 200; status bisnis ada di envelope:

```json
{ "ok": true, "data": {}, "serverTime": "2026-10-26T08:00:00.000Z" }
{ "ok": false, "error": { "code": "LOCK_TIMEOUT", "message": "..." }, "serverTime": "..." }
```

- Error yang dapat di-retry: `NETWORK`, `TIMEOUT`, `INTERNAL`, `LOCK_TIMEOUT`.
  Client memakai backoff 500ms → 1s → 2s (maks 3x). Submit memakai `noRetry`
  pada level transport untuk menghindari duplikasi tak terkendali, tetapi server
  membuat submit **idempoten** (status bukan `in_progress` langsung mengembalikan
  submission yang ada).

## 6. Alur ujian

### 6.1 Mulai / resume

1. `attempts.start` memvalidasi: status ujian `published`, jadwal, kelas target,
   token, dan belum ada submission.
2. Jika ada submission `in_progress` dan belum kedaluwarsa → payload yang sama
   dikembalikan (resume).
3. Jika kedaluwarsa → server menyelesaikan penilaian dan mengembalikan
   `ALREADY_SUBMITTED` beserta `submissionId`.
4. Urutan soal:
   - pool = `ExamQuestions` terurut;
   - jika `acakSoal` → shuffle, lalu ambil `jumlahSoal`;
   - urutan disimpan di `Submissions.questionOrderJson` agar konsisten saat
     resume dan saat review hasil.
5. Opsi diacak **di client** dengan PRNG deterministik
   (`seededShuffle(options, submissionId + questionId)`), sehingga tidak perlu
   menyimpan matriks opsi dan tetap stabil antar-refresh.
6. `expiresAt = min(now + durasi, exam.selesaiAt)` disimpan di server dan menjadi
   sumber kebenaran timer.

### 6.2 Timer sync

- Server mengirim `remainingSec` + `serverTime` pada start/save.
- Client menyimpan deadline lokal dan hanya resync bila selisih > 3 detik
  (mencegah jam “meloncat” karena latency).
- Setiap detik client menghitung sisa waktu dari deadline; saat 0 → submit
  otomatis. Server juga menolak/menutup attempt setelah `expiresAt + 10s` (grace).

### 6.3 Autosave batching + heartbeat

Satu endpoint (`attempts.save`) dipakai untuk dua hal:

| Kondisi | Payload | Frekuensi |
|---|---|---|
| Ada perubahan | daftar jawaban yang berubah (maks 100) | tiap 5 detik, atau langsung saat ≥ 5 soal berubah |
| Tidak ada perubahan | `answers: []` (heartbeat) | tiap ~30 detik |

- Antrean memakai versi per soal (`versions`); jawaban yang berubah lagi saat
  request berjalan tidak ditandai tersimpan (tidak ada lost update).
- Draft juga ditulis ke `localStorage` (debounce 700ms). Saat resume, draft yang
  berbeda dari server dimerge dan dikirim ulang.
- Saat submit, client mengirim jawaban pending terlebih dahulu agar tidak ada
  jawaban terakhir yang hilang.

### 6.4 Anti-cheat

- Sinyal: `tab_switch` (visibilitychange), `blur`, `fullscreen_exit`, `copy`,
  `paste`, `contextmenu`.
- `copy`/`paste`/`contextmenu` dicegah selama halaman ujian.
- Setiap sinyal dicatat ke `Logs`; `tab_switch` menambah `tabSwitchCount`.
- UI menampilkan banner + jumlah peringatan focus.
- **Tidak ada auto-submit** karena tab switch bisa terjadi karena telepon masuk
  (`CONFIG.AUTO_SUBMIT_ON_CHEAT = false`). Guru dapat melihat jumlah pelanggaran
  di detail pengerjaan.

### 6.5 Keamanan kunci jawaban

- `attempts.*` membangun payload soal tanpa `kunci` dan `pembahasan`.
- Hasil siswa hanya memuat kunci/pembahasan bila `Exams.tampilkanPembahasan = true`.
- Token ujian tidak pernah dikirim ke siswa (hanya flag `requiresToken`).
- Nilai pada hasil siswa mengikuti `tampilkanNilai` (jika false, endpoint
  mengembalikan `RESULT_HIDDEN` sampai ujian ditutup).

## 7. Penilaian

| Tipe | Aturan |
|---|---|
| PG | `selected` harus tepat 1 dan sama dengan kunci |
| PG kompleks | himpunan jawaban == himpunan kunci (all-or-nothing, tanpa partial credit) |
| Benar/Salah | `value` boolean sama |
| Isian | normalisasi NFKD → lowercase → spasi tunggal → hapus tanda baca; cocok dengan salah satu `accepted` |
| Essay | manual; `benar=null`, `skor=null` sampai dinilai guru |

Rumus:

```text
skor = round(Σ skor_diperoleh / Σ bobot_soal × 100, 2)
```

Status:

- `in_progress` — sedang dikerjakan.
- `needs_grading` — ada essay terjawab yang belum dinilai.
- `graded` — semua soal otomatis + essay (jika ada) sudah dinilai.
- `expired` — disiapkan untuk kebutuhan arsip; praktiknya attempt kedaluwarsa
  langsung difinalisasi menjadi `graded`/`needs_grading` dengan `autoSubmitted`.

Nilai essay di-clamp `0..bobot`; setelah disimpan, submission dihitung ulang
otomatis (status kembali `graded` bila tidak ada essay tersisa).

## 8. Kuota & performa GAS

| Masalah | Solusi di kode |
|---|---|
| ~6 menit / eksekusi | Tidak ada loop berat; import dipecah 50 baris; PDF dibuat di client |
| ~20k request/hari | Autosave batching 5s/5 jawaban; heartbeat digabung ke save; anti-cheat event di-throttle client |
| Concurrent submit | `LockService.tryLock(10s)` → `LOCK_TIMEOUT`; client retry backoff. Submit idempoten |
| Response besar | Pagination server (`pageSize` default 20, max 100) untuk questions/exams/users/submissions/logs |
| Baca sheet berulang | Data sekolah berskala kecil (±ratusan siswa); untuk skala besar, tambahkan CacheService pada daftar soal/ujian atau pindahkan analitik ke BigQuery |
| `Answers` membengkak | Indeks `examId/userId/submissionId` + arsip per semester |

## 9. Batasan & keputusan yang disengaja

- **Tidak realtime**: hasil guru tidak push; React Query invalidate setelah aksi.
- **Satu attempt per siswa per ujian** (tidak ada fitur remidi/retake).
- **Gambar soal berupa URL**, bukan upload file (menghindari limit cell & izin Drive).
- **Pencarian dilakukan di memori** setelah membaca sheet, cocok untuk skala sekolah.
- **Google OAuth opsional**; login utama adalah email/password.
- **Mock backend** menyimpan kredensial verifier di localStorage — hanya untuk demo,
  bukan untuk produksi.
- Tidak ada endpoint `attempts.resume` terpisah; resume memakai `attempts.start`.
- Tidak ada refresh-token rotation; pencabutan sesi memakai `tokenVersion`.

## 10. Deployment

| Komponen | Platform | Catatan |
|---|---|---|
| Frontend | Vercel / Netlify | Build command `npm run build`, output `dist`, env dari `.env` |
| Backend | GAS Web App | Deploy ulang (versi baru) setiap perubahan kode |
| Database | Google Sheets | Disebutkan oleh `SPREADSHEET_ID` di Script Properties |

Karena frontend adalah SPA, konfigurasi rewrite semua path ke `index.html`
(Vercel/Netlify sudah default untuk Vite). URL backend harus berakhiran `/exec`
dan deployment harus **Anyone**.

## 11. Checklist keamanan

- [x] Password di-hash (PBKDF2 100k di client + HMAC pepper server)
- [x] Token HMAC + expiry + `tokenVersion`
- [x] Access token tidak dipersist
- [x] RBAC server-side pada setiap action (admin/guru/siswa)
- [x] Kunci jawaban tidak dikirim saat attempt aktif
- [x] Validasi input client **dan** server
- [x] Rate limit login/submit/autosave/event
- [x] LockService untuk semua mutasi
- [x] Audit log untuk aksi penting
- [x] `RESULT_HIDDEN` bila guru menyembunyikan nilai
- [ ] 2FA (di luar cakupan)
- [ ] Enkripsi kolom tambahan (Sheets sudah terenkripsi at-rest oleh Google)
