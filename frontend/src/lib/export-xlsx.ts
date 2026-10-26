import type { ExportPayload } from '@/types/api';
import { SUBMISSION_STATUS_LABELS } from './constants';
import { formatDateTime } from './utils';

/** Export class recap as a two-sheet workbook (recap + statistics). */
export async function exportRecapXlsx(payload: ExportPayload): Promise<void> {
  // SheetJS is loaded lazily to keep the main bundle small.
  const XLSX = await import('xlsx');
  const { exam, school, rows, stats, generatedAt } = payload;

  const info: (string | number)[][] = [
    [school.schoolName],
    [school.schoolAddress],
    ['REKAPITULASI HASIL UJIAN'],
    [],
    ['Ujian', exam.nama],
    ['Mata Pelajaran', exam.mapel],
    ['Jadwal', `${formatDateTime(exam.mulaiAt)} - ${formatDateTime(exam.selesaiAt)}`],
    ['Durasi', `${exam.durasiMenit} menit`],
    ['Dibuat', formatDateTime(generatedAt)],
    [],
    ['Peserta', stats.count, 'Rata-rata', stats.avg, 'Tertinggi', stats.max, 'Terendah', stats.min],
    ['Lulus (KKM 75)', stats.passed, 'Belum lulus', Math.max(0, stats.count - stats.passed)],
    [],
  ];

  const header = [
    'No',
    'NIS',
    'Nama',
    'Kelas',
    'Benar',
    'Salah',
    'Kosong',
    'Nilai',
    'Status',
    'Waktu Submit',
    'Durasi',
  ];

  const data = rows.map((row) => [
    row.no,
    row.nis,
    row.nama,
    row.kelas,
    row.benar,
    row.salah,
    row.kosong,
    row.skor,
    SUBMISSION_STATUS_LABELS[row.status] ?? row.status,
    row.submitAt ? formatDateTime(row.submitAt) : '-',
    row.durasi,
  ]);

  const recapSheet = XLSX.utils.aoa_to_sheet([...info, header, ...data]);
  recapSheet['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
  ];

  const statsSheet = XLSX.utils.aoa_to_sheet([
    ['Statistik', 'Nilai'],
    ['Jumlah peserta', stats.count],
    ['Rata-rata', stats.avg],
    ['Nilai tertinggi', stats.max],
    ['Nilai terendah', stats.min],
    ['Lulus (KKM 75)', stats.passed],
    [],
    ['Rentang Nilai', 'Jumlah'],
    ...stats.distribution.map((item) => [item.label, item.value]),
    [],
    ['No', 'Soal', 'Benar', 'Salah', 'Kosong'],
    ...stats.perQuestion.map((item) => [
      item.nomor,
      item.pertanyaan.replace(/<[^>]+>/g, ''),
      item.benar,
      item.salah,
      item.kosong,
    ]),
  ]);
  statsSheet['!cols'] = [{ wch: 8 }, { wch: 70 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, recapSheet, 'Rekap');
  XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistik');
  const safeName = exam.nama.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 50);
  XLSX.writeFile(workbook, `Rekap-${safeName}.xlsx`);
}
