# Panduan Pengguna

Aplikasi CBT mendukung tiga peran: **Admin**, **Guru**, dan **Siswa**.
Panduan ini mengikuti alur nyata di aplikasi.

---

## 1. Masuk ke aplikasi

1. Buka URL aplikasi.
2. Isi **Email** dan **Kata sandi**, lalu klik **Masuk**.
3. Jika tombol **Masuk dengan Google** tampil, akun Google dengan email yang
   sama dapat dipakai (fitur opsional; bergantung konfigurasi sekolah).

Lupa kata sandi? Hubungi Admin. Guru tidak dapat mereset kata sandi siswa.

### Akun demo (mode lokal)

| Peran | Email | Kata sandi |
|---|---|---|
| Admin | `admin@cbt.local` | `Admin#123` |
| Guru | `guru@cbt.local` | `Guru#123` |
| Siswa | `siswa@cbt.local` | `Siswa#123` |

Akun demo hanya ada saat aplikasi berjalan dengan backend mock (tanpa URL GAS).
Di produksi, Admin membuat akun melalui menu **Pengguna**.

### Ganti kata sandi

Klik nama Anda di kanan atas → **Ganti kata sandi**. Setelah berhasil, semua
sesi lama berakhir dan Anda harus masuk kembali.

---

## 2. Siswa

### 2.1 Melihat ujian

Menu **Ujian Saya** menampilkan ujian yang:
- sudah diterbitkan guru,
- sesuai kelas Anda,
- belum melewati waktu selesai.

Kartu ujian menampilkan mapel, durasi, jumlah soal, jadwal, dan badge **Token**
bila guru mewajibkan token.

### 2.2 Mengerjakan ujian

1. Klik **Kerjakan ujian**.
2. Baca halaman petunjuk: jadwal, durasi, jumlah soal, dan tata tertib.
3. Jika diminta token, masukkan token dari guru/pengawas.
4. Klik **Mulai ujian**. Timer server langsung berjalan.

Selama ujian:

| Elemen | Fungsi |
|---|---|
| Timer di atas | Sisa waktu (berubah kuning < 5 menit, merah < 1 menit) |
| **Tandai ragu** | Menandai soal untuk diperiksa lagi |
| Grid nomor | Menunjukkan soal terjawab (teal), ragu (garis kuning), dan kosong |
| Indikator simpan | “Jawaban tersimpan” / “Menyimpan…” / “Belum tersimpan” |
| **Kumpulkan** | Mengakhiri ujian (dengan konfirmasi) |

Hal penting:

- Jawaban disimpan otomatis ke server setiap ±5 detik (atau lebih cepat bila
  Anda mengubah 5 soal). Salinan juga disimpan di perangkat.
- Jika koneksi putus, banner merah muncul. Tetap jawab; sistem akan mengirim
  ulang saat koneksi pulih. **Jangan menutup tab.**
- Jika browser/HP mati, buka kembali ujian. Tombol berubah menjadi
  **Lanjutkan ujian** dan jawaban dipulihkan.
- Berpindah tab/layar penuh dinonaktifkan? Tidak— tetapi **dicatat**. Banner
  peringatan muncul dan guru dapat melihat jumlah pelanggaran fokus.
- Menyalin/menempel teks dinonaktifkan selama ujian.
- Waktu habis → jawaban otomatis dikumpulkan.

Setelah dikumpulkan:

- Skor otomatis muncul (PG, PG kompleks, B/S, isian).
- Essay berstatus **Menunggu penilaian** sampai guru mengoreksi.
- Klik **Unduh PDF** untuk laporan resmi dengan kop sekolah.

Ujian hanya dapat dikerjakan **satu kali**. Tidak ada fitur remidi di versi ini.

### 2.3 Riwayat nilai

Menu **Riwayat Nilai** berisi semua ujian yang sudah dikumpulkan, rata-rata, dan
nilai terbaik. Klik **Detail** untuk melihat jawaban, kunci, dan pembahasan
(jika guru mengizinkannya).

---

## 3. Guru

### 3.1 Dashboard

Ringkasan ujian Anda, jumlah soal, pekerjaan yang perlu dinilai, rata-rata
nilai, dan aktivitas 7 hari terakhir.

### 3.2 Bank Soal

Menu **Bank Soal**:

- **Tambah soal** — form lengkap: tipe, pertanyaan, opsi, kunci, bobot,
  tingkat, kategori, tag, gambar (URL), pembahasan.
- **Edit** — melalui menu ⋯ pada baris soal.
- **Pratinjau** — melihat soal beserta kunci (khusus guru/admin).
- **Hapus** — soft delete; soal hilang dari bank tetapi ujian lama tetap aman.
- **Filter** — cari teks, kategori, tipe, tingkat.
- **Import** — XLSX/DOCX, lihat bagian 3.3.

Tipe soal:

| Tipe | Penilaian |
|---|---|
| Pilihan Ganda | Otomatis, satu kunci |
| PG Kompleks | Otomatis, all-or-nothing (semua pilihan harus tepat) |
| Benar/Salah | Otomatis |
| Isian Singkat | Otomatis, abaikan besar/kecil huruf & spasi berlebih |
| Essay | Manual oleh guru |

Guru hanya melihat soal miliknya. Admin melihat semua soal.

### 3.3 Import soal (XLSX & DOCX)

1. Klik **Import**.
2. Unduh template bila belum punya (**Template XLSX** / **Template DOCX**).
3. Isi sesuai `docs/IMPORT_FORMAT.md`.
4. Unggah file. Sistem menampilkan pratinjau + daftar error per baris.
5. Klik **Impor N soal**. Hanya baris valid yang disimpan.

Tips:

- Mulai dari template; jangan mengubah nama kolom/header.
- Satu baris = satu soal.
- Kunci PG kompleks dipisah koma: `A, C, E`.
- Isian: pisahkan varian jawaban dengan `|`, mis. `jakarta | dki jakarta`.
- DOCX: setiap soal diawali `1. [PG] ...`; metadata `Kunci:`, `Bobot:`,
  `Kategori:`, `Tingkat:`.

### 3.4 Membuat ujian

Menu **Ujian → Buat ujian**.

1. **Informasi**: nama, mapel, durasi, deskripsi/instruksi.
2. **Jadwal & peserta**: waktu mulai/selesai (WIB), daftar kelas
   (`XII-IPA-1, XII-IPA-2`), token opsional.
3. **Pengaturan**:
   - **Jumlah soal diujikan** — berapa soal yang dipakai dari pool.
   - **Acak soal** — urutan dan pemilihan soal acak per siswa.
   - **Acak opsi** — urutan opsi diacak di perangkat siswa.
   - **Tampilkan pembahasan** — siswa melihat kunci/pembahasan di hasil.
   - **Tampilkan nilai** — jika dimatikan, siswa baru melihat nilai setelah
     ujian ditutup.
4. **Pilih soal** — centang soal dari bank. Pool yang dipilih dapat lebih banyak
   dari jumlah soal diujikan.
5. **Simpan** (draft) atau **Simpan & terbitkan**.

Setelah terbit, siswa pada kelas target bisa mulai sesuai jadwal. Gunakan menu
⋯ untuk **Pratinjau** atau **Tutup ujian**.

> Ujian yang sudah memiliki peserta tidak dapat dihapus; tutup saja.

### 3.5 Hasil & penilaian

Menu **Hasil & Penilaian**:

1. Pilih ujian.
2. Tab **Semua peserta** menampilkan NIS, kelas, benar/salah, nilai, waktu
   submit.
3. Tab **Perlu dinilai** memfilter yang masih punya essay belum dikoreksi.
4. Klik **Detail** untuk:
   - melihat jawaban & kunci tiap soal,
   - mengisi skor essay (`0..bobot`),
   - menyimpan nilai (total langsung dihitung ulang),
   - mengunduh **PDF siswa**,
   - mengumpulkan paksa attempt yang masih berjalan.

**Export** (kanan atas):

- **PDF rekap kelas** — kop sekolah, statistik, tabel nilai, kolom tanda tangan.
- **Excel rekap nilai** — sheet `Rekap` + `Statistik`.

### 3.6 Statistik

Menu **Statistik**:

- jumlah peserta, rata-rata, tertinggi, terendah, jumlah lulus (KKM 75),
- grafik distribusi nilai,
- analisis butir soal: benar/salah/kosong dan akurasi per soal.

---

## 4. Admin

### 4.1 Dashboard

Total pengguna (dengan rincian guru/siswa), ujian aktif, jumlah bank soal,
jumlah pengerjaan, grafik aktivitas, pengerjaan terbaru.

### 4.2 Statistik

Menu **Statistik** menampilkan ujian dari semua guru: jumlah peserta, rata-rata,
distribusi nilai, dan analisis butir soal. Admin dapat mengekspor rekap PDF/XLSX
dari halaman ini.

### 4.3 Pengguna

Menu **Pengguna**:

- **Tambah pengguna** — nama, email, role, NIS/kelas, kata sandi awal.
- **Edit** — ubah nama/email/role/kelas/status aktif.
- **Reset sandi** — masukkan sandi baru; semua sesi pengguna tersebut berakhir.
- **Hapus** — tidak bisa menghapus akun sendiri atau admin terakhir.

Kata sandi di-hash di browser (PBKDF2 100.000 iterasi), lalu server menyimpan
HMAC-nya dengan pepper. Admin **tidak dapat melihat** kata sandi pengguna.

### 4.4 Aktivitas

Log audit: login, perubahan pengguna, import soal, pembuatan/terbit ujian,
submit, peringatan fokus, dan perubahan pengaturan.

### 4.5 Pengaturan

- Nama sekolah, alamat, kepala sekolah, URL logo (dipakai di kop PDF).
- Informasi backend: mode Mock/GAS, URL GAS, status OAuth.

Pengaturan disimpan sebagai Script Properties di backend (bukan sheet), sehingga
tidak ikut terhapus saat data ujian diarsipkan.

---

## 5. Pertanyaan umum

**Siswa tidak menemukan ujiannya.**
Periksa: status ujian sudah *Terbit*, jadwal sudah dimulai, dan kelas siswa ada
di daftar kelas target. Ujian untuk kelas lain tidak ditampilkan.

**Token salah / tidak bisa mulai.**
Token tidak peka huruf besar/kecil, tetapi harus sama persis. Minta guru
memastikan token dan jadwal.

**Koneksi terputus saat ujian.**
Jangan tutup tab. Jawaban disimpan lokal; saat koneksi kembali, autosave
mengirim ulang. Jika tab terlanjur tertutup, buka ujian lagi → **Lanjutkan**.

**Nilai belum muncul.**
Jika ujian belum ditutup dan guru mematikan *Tampilkan nilai*, siswa akan
mendapat pesan “Nilai belum dibuka oleh guru”. Essay juga menunggu koreksi.

**Siswa pindah tab karena telepon masuk, apakah ujian dibatalkan?**
Tidak. Aktivitas dicatat sebagai peringatan; guru dapat melihat jumlahnya.
Aplikasi tidak melakukan auto-submit karena alasan tersebut.

**Bagaimana mengubah logo sekolah di PDF?**
Admin → Pengaturan → URL logo (harus dapat diakses publik). Jika CORS memblokir,
PDF tetap tercetak tanpa logo.

**Apakah bisa mengerjakan ulang?**
Tidak. Satu ujian = satu attempt per siswa.

**Data hilang setelah ganti browser/HP?**
Pada mode produksi, data ada di Google Sheets. Pada mode demo, data disimpan di
`localStorage` browser tersebut; gunakan browser yang sama untuk melihat data
demo.

---

## 6. Rekomendasi perangkat

- Chrome/Edge/Safari versi terbaru (dukungan Web Crypto & fullscreen).
- Aktifkan mode layar penuh saat ujian (tombol di header).
- Jangan gunakan mode incognito untuk produksi karena refresh token tidak
  bertahan setelah tab ditutup.
- Pastikan koneksi stabil; aplikasi tetap menyimpan draft saat offline.
