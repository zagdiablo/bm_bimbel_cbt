# API Reference — CBT Backend (Google Apps Script)

Base URL: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`

Semua endpoint dipanggil dengan:

```http
POST /exec?action=<action>
Content-Type: text/plain;charset=utf-8

{ ...payload }
```

> `text/plain` dipakai agar tidak memicu CORS preflight. Jangan mengirim header
> `Authorization`; token disertakan di body sebagai `token`.

## 1. Envelope respons

Sukses:

```json
{
  "ok": true,
  "data": { "...": "..." },
  "serverTime": "2026-10-26T10:00:00.000Z"
}
```

Gagal:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION",
    "message": "Pertanyaan wajib diisi.",
    "details": null
  },
  "serverTime": "2026-10-26T10:00:00.000Z"
}
```

HTTP status selalu `200` (keterbatasan Apps Script). Client harus memeriksa `ok`.

### Kode error

| Code | Arti | Penanganan client |
|---|---|---|
| `VALIDATION` | Input tidak valid | Tampilkan pesan field/toast |
| `UNAUTHORIZED` | Token tidak ada/invalid | Logout |
| `TOKEN_EXPIRED` | Access token kedaluwarsa | Refresh otomatis, lalu ulangi |
| `SESSION_EXPIRED` | Refresh token kedaluwarsa/dicabut | Logout + arahkan ke login |
| `FORBIDDEN` | Role/ownership tidak sesuai | Tampilkan akses ditolak |
| `NOT_FOUND` | Data tidak ada | Tampilkan empty/error |
| `CONFLICT` | Duplikat / data terkait | Jelaskan di toast |
| `LOCK_TIMEOUT` | LockService gagal (banyak submit bersamaan) | Retry backoff |
| `RATE_LIMITED` | Melebihi rate limit | Minta tunggu |
| `RESULT_HIDDEN` | Nilai belum dibuka guru | Tampilkan pesan |
| `EXAM_NOT_STARTED`, `EXAM_ENDED`, `INVALID_TOKEN`, `NO_QUESTIONS` | Validasi khusus ujian | Pesan spesifik |
| `ALREADY_SUBMITTED` | Attempt sudah selesai (ada `details.submissionId`) | Arahkan ke hasil |
| `INTERNAL` | Error tak terduga | Toast + retry |
| `NETWORK`, `TIMEOUT`, `BACKEND_HTML` | Hanya dari client (bukan server) | Banner konektivitas |

### Pagination

Endpoint list menerima `page` (default 1) dan `pageSize` (default 20, maks 100)
dan mengembalikan:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

---

## 2. Autentikasi

Credential adalah `base64(PBKDF2-HMAC-SHA256(password, "cbt:v1:" + email, 100000, 32 byte))`.
Gunakan helper:

```bash
node frontend/scripts/derive-credential.mjs guru@cbt.local 'Guru#123'
```

| Action | Auth | Payload | Respons |
|---|---|---|---|
| `auth.login` | publik | `{ email, credential }` | `{ accessToken, refreshToken, user }` |
| `auth.refresh` | publik | `{ refreshToken }` | `{ accessToken, refreshToken, user }` |
| `auth.google` | publik | `{ idToken }` | `{ accessToken, refreshToken, user }` |
| `auth.me` | token | `{ token }` | `{ user }` |
| `auth.logout` | token | `{ token }` | `{ ok: true }` — menaikkan `tokenVersion` |
| `auth.changePassword` | token | `{ token, currentCredential, newCredential }` | `{ ok: true }` |
| `auth.updateProfile` | token | `{ token, name, avatarUrl? }` | `{ user }` |

Contoh:

```bash
# 1) derive credential
CRED=$(node frontend/scripts/derive-credential.mjs admin@cbt.local 'Admin#123')

# 2) login
curl -s "$GAS_URL?action=auth.login" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d "{\"email\":\"admin@cbt.local\",\"credential\":\"$CRED\"}"
```

Google login: token diverifikasi terhadap `GOOGLE_CLIENT_ID` (Script Property)
dan `aud`; user harus sudah terdaftar (email sama). Tidak ada auto-register.

---

## 3. Users (admin)

| Action | Payload | Keterangan |
|---|---|---|
| `users.list` | `{ token, filters: { q?, role?, page?, pageSize? } }` | `role` = admin/guru/siswa |
| `users.create` | `{ token, input: { name, email, role, nis?, kelas?, active, credential } }` | `credential` wajib, dihitung client |
| `users.update` | `{ token, id, input: { name?, email?, role?, nis?, kelas?, active? } }` | |
| `users.delete` | `{ token, id }` | Tidak bisa hapus diri sendiri / admin terakhir |
| `users.resetPassword` | `{ token, id, credential }` | Menaikkan `tokenVersion` pengguna |

`User`: `{ id, email, name, role, nis?, kelas?, avatarUrl?, active, createdAt, updatedAt }`.

---

## 4. Questions (admin/guru)

| Action | Payload | Respons |
|---|---|---|
| `questions.list` | `{ token, filters: { q?, kategori?, tipe?, tingkat?, page?, pageSize? } }` | `Paginated<Question>` |
| `questions.get` | `{ token, id }` | `{ question }` |
| `questions.create` | `{ token, input: QuestionInput }` | `{ question }` |
| `questions.update` | `{ token, id, input: QuestionInput }` | `{ question }` |
| `questions.delete` | `{ token, id }` | `{ ok: true }` (soft delete) |
| `questions.bulkCreate` | `{ token, items: QuestionInput[] }` | `{ created, errors: [{ index, message }] }` (maks 50) |
| `questions.meta` | `{ token }` | `{ kategori: string[], tags: string[] }` |

```ts
type QuestionInput = {
  tipe: 'pg' | 'pg_kompleks' | 'benar_salah' | 'isian' | 'essay';
  pertanyaan: string;
  gambarUrl?: string;
  options: { id: string; teks: string }[];
  kunci: {
    selected?: string[];   // pg / pg_kompleks
    value?: boolean;       // benar_salah
    accepted?: string[];   // isian
    rubrik?: string;       // essay
  };
  pembahasan?: string;
  bobot: number;           // 0.1 - 100
  tingkat: 'mudah' | 'sedang' | 'sulit';
  kategori: string;
  tags: string[];
  aktif: boolean;
};
```

Guru hanya melihat/mengubah soal miliknya; admin melihat semua.

---

## 5. Exams

| Action | Auth | Payload | Respons |
|---|---|---|---|
| `exams.list` | semua | `{ token, filters: { q?, status?, page?, pageSize? } }` | `Paginated<Exam>` |
| `exams.info` | siswa | `{ token, id }` | `{ exam }` — tanpa token/kunci |
| `exams.get` | admin/guru | `{ token, id }` | `{ exam, questions: Question[] }` |
| `exams.preview` | admin/guru | `{ token, id }` | sama dengan get |
| `exams.create` | admin/guru | `{ token, input: ExamInput }` | `{ exam }` (status draft) |
| `exams.update` | admin/guru | `{ token, id, input: ExamInput }` | `{ exam }` |
| `exams.delete` | admin/guru | `{ token, id }` | `{ ok }` — gagal bila sudah ada peserta |
| `exams.setQuestions` | admin/guru | `{ token, examId, questionIds: string[] }` | `{ count }` |
| `exams.publish` | admin/guru | `{ token, id }` | `{ exam }` — butuh ≥ 1 soal |
| `exams.close` | admin/guru | `{ token, id }` | `{ exam }` |
| `exams.assign` | admin/guru | `{ token, id, kelas: string[] }` | `{ exam }` |

```ts
type ExamInput = {
  nama: string; mapel: string; deskripsi: string;
  durasiMenit: number;        // 1-480
  mulaiAt: string;            // ISO
  selesaiAt: string;          // ISO, > mulaiAt
  jumlahSoal: number;         // 1-200
  acakSoal: boolean; acakOpsi: boolean;
  tampilkanPembahasan: boolean; tampilkanNilai: boolean;
  token?: string;
  kelasTarget: string[];      // [] = semua kelas
};
```

Untuk siswa, daftar ujian hanya berisi ujian `published`, belum berakhir, dan
sesuai kelas. `Exam` siswa menyertakan `attemptStatus`, `submissionId`, dan
`requiresToken` (token asli tidak dikirim).

---

## 6. Attempts (siswa)

| Action | Payload | Respons |
|---|---|---|
| `attempts.start` | `{ token, examId, examToken? }` | `AttemptPayload` |
| `attempts.get` | `{ token, submissionId }` | `AttemptPayload` |
| `attempts.save` | `{ token, submissionId, answers: { questionId, value, ragu }[] }` | `SaveAttemptResult` |
| `attempts.logEvent` | `{ token, submissionId, event }` | `{ tabSwitchCount }` |
| `attempts.submit` | `{ token, submissionId }` | `{ submission }` (idempoten) |

`event`: `tab_switch` | `blur` | `copy` | `paste` | `contextmenu` | `fullscreen_exit`.

```ts
type AttemptPayload = {
  submission: Submission;
  exam: {
    id: string; nama: string; mapel: string; durasiMenit: number;
    acakOpsi: boolean; tampilkanPembahasan: boolean; tampilkanNilai: boolean;
  };
  questions: {           // TANPA kunci/pembahasan
    id: string; tipe: QuestionType; pertanyaan: string; gambarUrl?: string;
    options: QuestionOption[]; bobot: number; urutan: number;
  }[];
  answers: Answer[];
  remainingSec: number;
  serverTime: string;
};

type SaveAttemptResult = {
  saved: string[];
  remainingSec: number;
  serverTime: string;
  status: SubmissionStatus;
  tabSwitchCount: number;
};
```

Catatan perilaku:

- `attempts.save` juga berfungsi sebagai heartbeat bila `answers` kosong.
- Server menutup attempt otomatis bila melewati `expiresAt + 10 detik`.
- `attempts.start` untuk attempt `in_progress` = resume (nomor soal konsisten).
- Submit mengembalikan data yang sama bila sudah pernah submit.

---

## 7. Submissions & penilaian (admin/guru)

| Action | Payload | Respons |
|---|---|---|
| `submissions.list` | `{ token, filters: { examId?, status?, page?, pageSize? } }` | `Paginated<Submission>` |
| `submissions.get` | `{ token, submissionId }` | `ResultDetail` (dengan kunci) |
| `submissions.gradeEssay` | `{ token, submissionId, items: [{ answerId, skor }] }` | `{ submission }` |
| `submissions.forceSubmit` | `{ token, submissionId }` | `{ submission }` |

`status`: `in_progress | submitted | needs_grading | graded | expired`.
Bila `filters.status` kosong, pengerjaan `in_progress` tidak disertakan.

```ts
type ResultDetail = {
  submission: Submission;
  exam: Exam;
  rows: {
    nomor: number;
    question: Question;
    answer: Answer | null;
    bobot: number;
    skorMaks: number;
  }[];
  canSeeKey: boolean;
  school: SchoolSettings;
};
```

`gradeEssay` memvalidasi bahwa setiap `answerId` milik submission tersebut dan
merupakan soal essay. Skor di-clamp `0..bobot`, lalu total dihitung ulang.

---

## 8. Results

| Action | Auth | Payload | Respons |
|---|---|---|---|
| `results.mine` | siswa | `{ token }` | `{ items: Submission[] }` |
| `results.detail` | semua* | `{ token, submissionId }` | `ResultDetail` |
| `results.list` | admin/guru | `{ token, examId }` | `{ items: Submission[] }` |
| `results.stats` | admin/guru | `{ token, examId }` | `ExamStats` |
| `results.exportData` | admin/guru | `{ token, examId }` | `ExportPayload` |

\* Siswa hanya submission miliknya, dan mendapat `RESULT_HIDDEN` bila
`tampilkanNilai=false` sementara ujian belum ditutup. Kunci/pembahasan hanya
disertakan bila `tampilkanPembahasan=true`. Access token ujian tidak pernah
disertakan pada respons siswa.

```ts
type ExamStats = {
  count: number; avg: number; min: number; max: number; passed: number;
  distribution: { label: string; value: number }[]; // <60,60-69,...
  perQuestion: { questionId; nomor; pertanyaan; benar; salah; kosong }[];
};

type ExportPayload = {
  exam: Exam; school: SchoolSettings; rows: ExportRow[];
  stats: ExamStats; generatedAt: string;
};
```

PDF/XLSX dibuat di browser dari `ExportPayload` (GAS tidak menghasilkan file).

---

## 9. Dashboard, settings, logs

| Action | Auth | Payload | Respons |
|---|---|---|---|
| `dashboard.stats` | semua | `{ token }` | `DashboardStats` (bentuk kartu/chart/daftar per role) |
| `settings.get` | publik | `{}` | `{ settings: SchoolSettings, appName }` |
| `settings.update` | admin | `{ token, settings: SchoolSettings }` | `{ settings }` |
| `logs.list` | admin | `{ token, page?, pageSize? }` | `Paginated<LogEntry>` |
| `health` | publik | `{}` atau GET | `{ version, mode, sheets, serverTime }` |

`DashboardStats`:

```ts
{
  cards: { label: string; value: string; hint?: string; icon: StatIcon }[];
  chart: { label: string; value: number }[];
  upcomingExams: Exam[];
  recentSubmissions: Submission[];
  pendingGrading: Submission[];
}
```

---

## 10. Rate limit

| Key | Limit | Window |
|---|---|---|
| `login:<email>` | 10 | 1 menit |
| `start:<userId>` | 10 | 1 menit |
| `save:<submissionId>` | 120 | 1 menit |
| `event:<submissionId>` | 60 | 1 menit |
| `submit:<submissionId>` | 3 | 1 menit |

Melebihi batas → `RATE_LIMITED`.

## 11. Versioning

`health.data.version` mengikuti `CONFIG.VERSION` di `gas/Config.gs`. Perubahan
breaking pada kontrak API harus menaikkan versi dan diperbarui di dokumen ini.
