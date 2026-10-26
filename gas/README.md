# Backend Google Apps Script

Backend CBT berupa Web App Apps Script + Google Sheets. Tidak butuh server/VPS.

## 1. Buat spreadsheet

1. Buat Google Spreadsheet baru, beri nama misalnya `CBT Database`.
2. Buka **Extensions → Apps Script**.
3. Hapus isi `Code.gs` default.

## 2. Masukkan kode

Opsi A — manual (paling cepat):

1. Buat file `.gs` di editor Apps Script dengan nama yang sama seperti folder ini:
   `Config.gs`, `Db.gs`, `Auth.gs`, `Users.gs`, `Questions.gs`, `Exams.gs`,
   `Attempts.gs`, `Grading.gs`, `Dashboard.gs`, `Code.gs`, `setup.gs`, `seed.gs`.
2. Salin isi masing-masing file dari folder `gas/`.
3. Buka **Project Settings**, centang *Show `appsscript.json` manifest file*,
   lalu ganti isinya dengan `gas/appsscript.json` (timezone `Asia/Jakarta`).

Opsi B — clasp (disarankan untuk pengembangan):

```bash
npm install -g @google/clasp
clasp login
clasp create --type sheets --title "CBT Database"
# salin .gs + appsscript.json dari folder gas/ ke root project clasp
clasp push
```

## 3. Bootstrap sheet & properti

Di editor Apps Script, pilih fungsi **`setupSpreadsheet`** lalu **Run**.

- Menyetujui izin (Sheets + UrlFetch).
- Membuat 7 sheet: `Users`, `Questions`, `Exams`, `ExamQuestions`,
  `Submissions`, `Answers`, `Logs` beserta header.
- Menyimpan `SPREADSHEET_ID`, `TOKEN_SECRET`, `PASSWORD_PEPPER`, dan pengaturan
  sekolah di Script Properties.

Opsional — data demo:

```text
Pilih fungsi seedDemoData → Run
```

Akun demo yang dibuat:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cbt.local` | `Admin#123` |
| Guru | `guru@cbt.local` | `Guru#123` |
| Siswa | `siswa@cbt.local` | `Siswa#123` |

`resetDemoData()` akan **menghapus seluruh isi sheet** lalu membuat ulang data
demo. Jangan jalankan di spreadsheet produksi.

## 4. Deploy Web App

1. **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. Isi:
   - Description: `CBT API v1`
   - **Execute as: Me**
   - **Who has access: Anyone**
4. Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

> Catatan: setiap kali kode diubah, buat **New deployment** (atau
> *Manage deployments → Edit → Version: New version*) agar perubahan aktif.

## 5. Hubungkan frontend

Di `frontend/.env`:

```env
VITE_GAS_API_URL=https://script.google.com/macros/s/XXXXXXXX/exec
VITE_USE_MOCK=false
```

Lalu `npm run dev` (atau build ulang di Vercel/Netlify).

## 6. Opsional: Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client
   ID** (Web application).
2. Authorized JavaScript origins: `http://localhost:5173` dan domain frontend
   produksi.
3. Simpan Client ID di dua tempat:
   - Frontend `.env`: `VITE_GOOGLE_CLIENT_ID=...`
   - Script Properties backend: `GOOGLE_CLIENT_ID=...`
     (Apps Script → Project Settings → Script Properties).

Tanpa konfigurasi ini, login email/password tetap berfungsi dan tombol Google
tidak dirender.

## 7. Verifikasi cepat

Buka URL Web App di browser (GET):

```text
https://script.google.com/macros/s/XXXX/exec?action=health
```

Respons yang benar:

```json
{
  "ok": true,
  "data": { "version": "1.0.0", "mode": "gas", "sheets": { "Users": true, ... } },
  "serverTime": "..."
}
```

Jika muncul halaman login Google atau HTML, deployment belum diset
**Anyone** / URL bukan `/exec`.

## 8. Pemeliharaan

- **Arsip per semester**: lihat `docs/ARCHITECTURE.md` (bagian *Answers growth*).
- **Ganti `TOKEN_SECRET`** akan membatalkan semua sesi (token lama tidak valid).
- **Ganti `PASSWORD_PEPPER`** membuat semua kata sandi lama tidak cocok — hanya
  lakukan jika Anda akan mereset semua kata sandi. Kedua nilai ini dibuat
  otomatis oleh `setupSpreadsheet()`.
- **Rate limit** memakai `CacheService` (login 10/menit, submit 3/menit,
  autosave 120/menit, event 60/menit).
- **LockService** timeout 10 detik → API mengembalikan `LOCK_TIMEOUT` (503-style)
  dan client melakukan retry backoff.
- Jalankan `setupSpreadsheet()` lagi setelah menambah sheet/kolom baru; fungsi ini
  idempoten dan hanya menulis header bila kosong.

## Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| `BACKEND_HTML` di frontend | Deployment belum `Anyone`, URL salah, atau butuh login |
| CORS error | Jangan kirim header `Content-Type: application/json`; gunakan `text/plain` (sudah diatur api-client) |
| `UNAUTHORIZED` setelah ganti sandi | Token lama dicabut (`tokenVersion` naik) — login ulang |
| `LOCK_TIMEOUT` saat submit bersamaan | Normal pada submit serentak; client retry otomatis. Bisa persempit dengan submit lebih awal |
| `RESULT_HIDDEN` pada siswa | Ujian `tampilkanNilai=false` dan belum ditutup guru |
| Logo tidak muncul di PDF | URL logo memblokir CORS; PDF tetap tercetak tanpa logo |
