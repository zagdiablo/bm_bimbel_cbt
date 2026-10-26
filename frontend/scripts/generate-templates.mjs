/**
 * Generates ready-to-fill import templates in public/templates.
 * Run with: npm run generate:templates
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/templates');
fs.mkdirSync(outputDir, { recursive: true });

/* ------------------------------------------------------------------ XLSX */

const headers = [
  'no',
  'tipe',
  'pertanyaan',
  'opsi_a',
  'opsi_b',
  'opsi_c',
  'opsi_d',
  'opsi_e',
  'kunci',
  'bobot',
  'kategori',
  'tingkat',
  'tags',
  'pembahasan',
  'gambar',
];

const exampleRows = [
  [
    1,
    'PG',
    'Hasil dari 2^5 adalah ...',
    16,
    25,
    32,
    64,
    128,
    'C',
    1,
    'Matematika',
    'mudah',
    'eksponen, pangkat',
    '2^5 = 32',
    '',
  ],
  [
    2,
    'PG KOMPLEKS',
    'Manakah yang merupakan faktor dari 12? (Pilih semua yang benar)',
    2,
    3,
    4,
    5,
    6,
    'A, B, C, E',
    2,
    'Matematika',
    'sedang',
    'faktor, bilangan',
    'Faktor 12: 1, 2, 3, 4, 6, 12',
    '',
  ],
  [
    3,
    'ISIAN',
    'Ibu kota Indonesia adalah ...',
    '',
    '',
    '',
    '',
    '',
    'jakarta | dki jakarta',
    2,
    'IPS',
    'mudah',
    'geografi',
    '',
    '',
  ],
  [
    4,
    'ESSAY',
    'Jelaskan langkah menyelesaikan 3x + 5 = 20.',
    '',
    '',
    '',
    '',
    '',
    'Rubrik: memindahkan konstanta, membagi koefisien, x = 5',
    5,
    'Matematika',
    'sulit',
    'aljabar',
    '',
    '',
  ],
];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
sheet['!cols'] = [
  { wch: 5 },
  { wch: 14 },
  { wch: 55 },
  { wch: 14 },
  { wch: 14 },
  { wch: 14 },
  { wch: 14 },
  { wch: 14 },
  { wch: 18 },
  { wch: 8 },
  { wch: 16 },
  { wch: 10 },
  { wch: 22 },
  { wch: 40 },
  { wch: 24 },
];
sheet['!autofilter'] = { ref: `A1:O${exampleRows.length + 1}` };
sheet['!freeze'] = { xSplit: '0', ySplit: '1' };
XLSX.utils.book_append_sheet(workbook, sheet, 'Soal');

const guide = XLSX.utils.aoa_to_sheet([
  ['PANDUAN IMPORT SOAL — CBT'],
  [],
  ['1. Isi sheet "Soal". Jangan mengubah baris header.'],
  ['2. Kolom wajib: tipe, pertanyaan, kunci, bobot, kategori.'],
  ['3. Tipe yang diterima: PG, PG KOMPLEKS, BENAR/SALAH, ISIAN, ESSAY.'],
  ['4. PG: isi minimal opsi_a dan opsi_b, kunci satu huruf (contoh: C).'],
  ['5. PG KOMPLEKS: kunci beberapa huruf dipisah koma (contoh: A, C, D).'],
  ['6. BENAR/SALAH: kunci Benar/B atau Salah/S.'],
  ['7. ISIAN: beberapa jawaban diterima dipisah tanda | (contoh: jakarta | dki jakarta).'],
  ['8. ESSAY: kunci diisi rubrik penilaian (opsional).'],
  ['9. Tingkat: mudah, sedang, atau sulit.'],
  ['10. Hapus baris contoh yang tidak dipakai sebelum mengunggah.'],
  [],
  ['CATATAN KEAMANAN'],
  ['Kunci jawaban hanya diunggah oleh guru/admin dan tidak pernah dikirim ke perangkat siswa saat ujian.'],
  ['Baris dengan format salah akan ditolak dan ditampilkan nomor barisnya pada dialog import.'],
]);
guide['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(workbook, guide, 'Petunjuk');

const xlsxPath = path.join(outputDir, 'template-soal.xlsx');
XLSX.writeFile(workbook, xlsxPath);

/* ------------------------------------------------------------------ DOCX */

const text = (value, options = {}) => new TextRun({ text: value, ...options });
const line = (value = '', options = {}) => new Paragraph({ children: [text(value, options)], spacing: { after: 80 } });

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22 } },
    },
  },
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [text('TEMPLATE IMPORT SOAL — CBT')],
        }),
        line('Petunjuk: setiap soal diawali "nomor. [TIPE] pertanyaan". Tipe yang didukung:'),
        line('PG, PG KOMPLEKS, BENAR/SALAH, ISIAN, ESSAY. Opsi memakai "A." sampai "E.".', { italics: true }),
        line('Metadata: Kunci, Bobot, Kategori, Tingkat, Tags, Pembahasan, Gambar.', { italics: true }),
        line('Pisahkan setiap soal dengan satu baris kosong. Jangan menambahkan tabel.', { italics: true }),
        line(''),
        line('CONTOH — silakan ganti atau hapus.'),
        line(''),
        line('1. [PG] Hasil dari 2^5 adalah ...'),
        line('A. 16'),
        line('B. 25'),
        line('C. 32'),
        line('D. 64'),
        line('E. 128'),
        line('Kunci: C'),
        line('Bobot: 1'),
        line('Kategori: Matematika'),
        line('Tingkat: mudah'),
        line('Tags: eksponen, pangkat'),
        line('Pembahasan: 2^5 = 2 x 2 x 2 x 2 x 2 = 32.'),
        line(''),
        line('2. [PG KOMPLEKS] Manakah yang merupakan faktor dari 12? (Pilih semua yang benar)'),
        line('A. 2'),
        line('B. 3'),
        line('C. 4'),
        line('D. 5'),
        line('E. 6'),
        line('Kunci: A, B, C, E'),
        line('Bobot: 2'),
        line('Kategori: Matematika'),
        line('Tingkat: sedang'),
        line(''),
        line('3. [ISIAN] Ibu kota Indonesia adalah ...'),
        line('Kunci: jakarta | dki jakarta'),
        line('Bobot: 2'),
        line('Kategori: IPS'),
        line('Tingkat: mudah'),
        line(''),
        line('4. [ESSAY] Jelaskan langkah menyelesaikan persamaan 3x + 5 = 20.'),
        line('Kunci: Rubrik — memindahkan konstanta, membagi koefisien, menuliskan x = 5.'),
        line('Bobot: 5'),
        line('Kategori: Matematika'),
        line('Tingkat: sulit'),
      ],
    },
  ],
});

const docxBuffer = await Packer.toBuffer(doc);
const docxPath = path.join(outputDir, 'template-soal.docx');
fs.writeFileSync(docxPath, docxBuffer);

console.log('Template dibuat:');
console.log(' -', xlsxPath);
console.log(' -', docxPath);
