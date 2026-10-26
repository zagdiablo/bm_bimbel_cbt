# Dokumentasi Format Import Soal

Dokumen ini adalah **kontrak format** untuk fitur import bank soal. Parser
(`frontend/src/lib/parse-xlsx.ts` dan `parse-docx.ts`) memvalidasi secara ketat:
baris/blok yang tidak sesuai **tidak** disimpan, dan alasan penolakan ditampilkan
per nomor baris di dialog import.

Template siap pakai tersedia di:

- `frontend/public/templates/template-soal.xlsx`
- `frontend/public/templates/template-soal.docx`

Template juga dapat diunduh dari halaman **Bank Soal → Template XLSX / Template DOCX**.

---

## 1. Excel (.xlsx)

Gunakan sheet bernama **`Soal`** (jika tidak ada, sheet pertama dipakai).
Baris pertama **wajib** header. Jangan mengganti nama kolom.

| Kolom | Wajib | Keterangan |
|---|---|---|
| `no` | tidak | Nomor urut, hanya referensi |
| `tipe` | ya | `PG`, `PG KOMPLEKS`, `BENAR/SALAH`, `ISIAN`, `ESSAY` |
| `pertanyaan` | ya | Teks soal. HTML sederhana (`<br>`, `<b>`) dibersihkan menjadi teks |
| `opsi_a` … `opsi_e` | PG/PG kompleks | Opsi jawaban. Opsi kosong diabaikan |
| `kunci` | ya* | Lihat aturan kunci di bawah |
| `bobot` | ya | Angka > 0 (default 1). Bobot menentukan kontribusi nilai |
| `kategori` | ya | Mapel/topik, dipakai untuk filter |
| `tingkat` | tidak | `mudah` / `sedang` / `sulit` (default `sedang`) |
| `tags` | tidak | Pisahkan dengan koma, contoh `aljabar, faktor` |
| `pembahasan` | tidak | Ditampilkan ke siswa hanya bila ujian mengizinkan |
| `gambar` | tidak | URL gambar (http/https) |

\* `kunci` wajib untuk semua tipe, kecuali essay boleh berisi rubrik (opsional).

### Aturan kunci per tipe

| Tipe | Format kunci | Contoh |
|---|---|---|
| PG | satu huruf opsi | `C` |
| PG KOMPLEKS | beberapa huruf dipisah koma/titik koma | `A, C, E` |
| BENAR/SALAH | `Benar`/`B`/`true` atau `Salah`/`S`/`false` | `Benar` |
| ISIAN | satu atau beberapa jawaban diterima, dipisah `\|` | `jakarta \| dki jakarta` |
| ESSAY | teks rubrik (opsional) | `Memindahkan konstanta, x = 5` |

### Catatan validasi

- PG/PG kompleks: minimal 2 opsi terisi; kunci harus ada pada opsi.
- PG: tepat satu kunci. PG kompleks: minimal satu, boleh lebih.
- `bobot` harus angka > 0.
- Baris kosong di akhir file diabaikan.
- Baris yang gagal **tidak** membatalkan baris lain.
- Import dikirim per 50 baris untuk menghindari batas eksekusi GAS.

Contoh isi sheet:

| no | tipe | pertanyaan | opsi_a | opsi_b | opsi_c | opsi_d | opsi_e | kunci | bobot | kategori | tingkat | tags | pembahasan |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | PG | Hasil 2^5 adalah ... | 16 | 25 | 32 | 64 | 128 | C | 1 | Matematika | mudah | eksponen | 2^5 = 32 |
| 2 | PG KOMPLEKS | Faktor dari 12? | 2 | 3 | 4 | 5 | 6 | A, B, C, E | 2 | Matematika | sedang | faktor | 1,2,3,4,6,12 |
| 3 | ISIAN | Ibu kota Indonesia ... | | | | | | jakarta \| dki jakarta | 2 | IPS | mudah | geografi | |
| 4 | ESSAY | Jelaskan langkah 3x + 5 = 20 | | | | | | Rubrik: x = 5 | 5 | Matematika | sulit | aljabar | |

---

## 2. Word (.docx)

Parser memakai **mammoth** untuk mengekstrak teks, lalu menjalankan state
machine. Format harus mengikuti contoh template. Judul/instruksi sebelum soal
pertama diabaikan.

### Format baku

```text
1. [PG] Hasil dari 2^5 adalah ...
A. 16
B. 25
C. 32
D. 64
E. 128
Kunci: C
Bobot: 1
Kategori: Matematika
Tingkat: mudah
Tags: eksponen, pangkat
Pembahasan: 2^5 = 32.

2. [PG KOMPLEKS] Manakah yang merupakan faktor dari 12?
A. 2
B. 3
C. 4
D. 5
E. 6
Kunci: A, B, C, E
Bobot: 2
Kategori: Matematika
Tingkat: sedang

3. [BENAR/SALAH] Bilangan 0 termasuk bilangan genap.
Kunci: Benar
Bobot: 1
Kategori: Matematika

4. [ISIAN] Ibu kota Indonesia adalah ...
Kunci: jakarta | dki jakarta
Bobot: 2
Kategori: IPS

5. [ESSAY] Jelaskan langkah menyelesaikan 3x + 5 = 20.
Kunci: Rubrik: memindahkan konstanta, membagi koefisien, x = 5
Bobot: 5
Kategori: Matematika
```

### Aturan sintaks

| Elemen | Pola | Keterangan |
|---|---|---|
| Pembuka soal | `1. [PG] Teks soal` | Nomor + titik, lalu `[TIPE]`. Wajib memulai soal baru |
| Opsi | `A. teks` hingga `E. teks` | Hanya huruf A–E. Untuk BENAR/SALAH tidak perlu opsi |
| Metadata | `Kunci: ...`, `Bobot: ...`, `Kategori: ...`, `Tingkat: ...`, `Tags: ...`, `Pembahasan: ...`, `Gambar: ...` | Tidak peka huruf besar/kecil |
| Baris lanjutan | teks bebas di bawah pertanyaan/opsi | Digabung ke field terakhir (mendukung soal panjang) |
| Pemisah soal | baris kosong | Disarankan, tidak wajib |

Tipe yang dikenali pada `[ ... ]`:

- `PG`, `Pilihan Ganda`
- `PG KOMPLEKS`, `Pilihan Ganda Kompleks`
- `BENAR/SALAH`, `B/S`, `Benar Salah`
- `ISIAN`, `Isian Singkat`
- `ESSAY`, `Esai`

### Yang membuat file ditolak

- Tidak ada satupun baris `1. [TIPE] ...`.
- Tipe di dalam `[...]` tidak dikenal.
- Soal PG/PG kompleks dengan kurang dari 2 opsi.
- Kunci tidak ada di daftar opsi.
- `Bobot` bukan angka > 0.
- `Tingkat` bukan mudah/sedang/sulit.

Error ditampilkan per blok soal (nomor soal), misalnya:

```text
Soal 3: kunci D tidak ada pada opsi.
Soal 5: minimal 2 opsi (A. ... dan B. ...).
```

---

## 3. Alur import di UI

1. Buka **Bank Soal → Import**.
2. Pilih tab **Excel** atau **Word**, lalu unggah file.
3. Sistem mem-parse dan menampilkan:
   - jumlah baris valid,
   - tabel pratinjau 12 baris pertama,
   - daftar error per baris/blok.
4. Klik **Impor N soal**. Hanya baris valid yang dikirim, dibagi per 50 soal.
5. Server memvalidasi ulang (defense in depth) dan mengembalikan error per indeks
   bila ada yang gagal.

> Kunci jawaban hanya melewati endpoint guru/admin. Saat siswa mengerjakan,
> backend menghapus `kunci` dan `pembahasan` dari payload soal.
