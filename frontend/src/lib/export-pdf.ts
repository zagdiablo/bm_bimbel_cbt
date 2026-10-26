import type { jsPDF } from 'jspdf';
import type { ExportPayload } from '@/types/api';
import type { ResultDetail, SchoolSettings } from '@/types/domain';
import { formatDate, formatDateTime, formatDuration, formatNumber } from './utils';
import { stripHtml } from './parse-common';
import { SUBMISSION_STATUS_LABELS } from './constants';

const PRIMARY: [number, number, number] = [15, 118, 110];
const MUTED: [number, number, number] = [100, 116, 139];

function sanitizeText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/√/g, 'akar ')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim();
}

async function loadLogo(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Gagal membaca logo'));
      reader.readAsDataURL(blob);
    });
  } catch {
    // A blocked/expired logo URL should never block exporting the report.
    return null;
  }
}

interface HeaderOptions {
  title: string;
  subtitle?: string;
}

async function drawHeader(doc: jsPDF, school: SchoolSettings, options: HeaderOptions): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadLogo(school.schoolLogoUrl);
  const centerX = pageWidth / 2;
  let y = 16;

  if (logo) {
    try {
      const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logo, format, 16, 10, 20, 20);
    } catch {
      // Ignore unsupported image formats.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeText(school.schoolName || 'Sekolah'), centerX, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (school.schoolAddress) {
    doc.text(sanitizeText(school.schoolAddress), centerX, y, { align: 'center', maxWidth: pageWidth - 50 });
    y += 4;
  }
  y += 2;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageWidth - 14, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeText(options.title), centerX, y, { align: 'center' });
  y += 5;
  if (options.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(sanitizeText(options.subtitle), centerX, y, { align: 'center' });
    y += 5;
  }
  return y + 2;
}

function drawFooter(doc: jsPDF, school: SchoolSettings): void {
  const total = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      sanitizeText(`${school.schoolName} • CBT • Dicetak ${formatDateTime(new Date().toISOString())}`),
      14,
      pageHeight - 8,
    );
    doc.text(`Halaman ${page} dari ${total}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

function signature(doc: jsPDF, school: SchoolSettings, startY: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = Math.min(startY, doc.internal.pageSize.getHeight() - 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Jakarta, ${formatDate(new Date().toISOString())}`, pageWidth - 70, y);
  doc.text('Guru Mata Pelajaran', pageWidth - 70, y + 5);
  doc.text(school.schoolHeadmaster ? 'Kepala Sekolah' : '', 25, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text('(......................................)', pageWidth - 70, y + 22);
  if (school.schoolHeadmaster) {
    doc.text(sanitizeText(school.schoolHeadmaster), 25, y + 22);
  }
}

export async function exportStudentResultPdf(detail: ResultDetail): Promise<void> {
  const [{ jsPDF: JsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default;
  const { submission, exam, rows, canSeeKey, school } = detail;
  const settings: SchoolSettings = school ?? {
    schoolName: 'Sekolah',
    schoolAddress: '',
    schoolLogoUrl: '',
    schoolHeadmaster: '',
  };
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc, settings, {
    title: 'LAPORAN HASIL UJIAN',
    subtitle: `${exam.nama} • ${exam.mapel}`,
  });

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2 },
    body: [
      ['Nama', `: ${submission.studentName ?? '-'}`, 'Tanggal', `: ${formatDateTime(submission.submitAt)}`],
      ['NIS', `: ${submission.studentNis ?? '-'}`, 'Durasi', `: ${formatDuration(submission.durationSec)}`],
      ['Kelas', `: ${submission.kelas ?? '-'}`, 'Status', `: ${SUBMISSION_STATUS_LABELS[submission.status]}`],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 },
      1: { cellWidth: 58 },
      2: { fontStyle: 'bold', cellWidth: 20 },
      3: { cellWidth: 55 },
    },
    margin: { left: 16, right: 16 },
  });

  const afterIdentity = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = afterIdentity + 6;

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(...PRIMARY);
  doc.roundedRect(16, y, 178, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.text(`${formatNumber(submission.skor, 2)}`, 40, y + 13, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('NILAI AKHIR', 40, y + 17.5, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Benar: ${submission.benar}`, 90, y + 8);
  doc.text(`Salah: ${submission.salah}`, 90, y + 13);
  doc.text(`Kosong: ${submission.kosong}`, 90, y + 18);
  doc.text(`Esai perlu dinilai: ${submission.perluManual}`, 135, y + 8);
  doc.text(`Pelanggaran fokus: ${submission.tabSwitchCount}`, 135, y + 13);
  y += 27;

  const head = canSeeKey
    ? [['No', 'Pertanyaan', 'Jawaban', 'Kunci', 'Skor']]
    : [['No', 'Pertanyaan', 'Jawaban', 'Skor']];

  const body = rows.map((row) => {
    const answer = row.answer;
    const jawaban = answer?.value
      ? answer.value.selected?.length
        ? answer.value.selected.join(', ')
        : typeof answer.value.value === 'boolean'
          ? answer.value.value
            ? 'Benar'
            : 'Salah'
          : answer.value.text ?? '-'
      : '-';
    const kunci = row.question.kunci
      ? row.question.kunci.selected?.join(', ') ??
        (typeof row.question.kunci.value === 'boolean'
          ? row.question.kunci.value
            ? 'Benar'
            : 'Salah'
          : row.question.kunci.accepted?.join(' / ') ?? '-')
      : '-';
    const skor = `${formatNumber(answer?.skor ?? 0, 2)} / ${formatNumber(row.skorMaks, 2)}`;
    const pertanyaan = sanitizeText(stripHtml(row.question.pertanyaan));
    return canSeeKey
      ? [String(row.nomor), pertanyaan, sanitizeText(jawaban), sanitizeText(kunci), skor]
      : [String(row.nomor), pertanyaan, sanitizeText(jawaban), skor];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak', textColor: [30, 41, 59] },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: canSeeKey
      ? {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 90 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 19, halign: 'center' },
        }
      : {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 110 },
          2: { cellWidth: 38 },
          3: { cellWidth: 20, halign: 'center' },
        },
    margin: { left: 16, right: 16 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  signature(doc, settings, finalY + 12);
  drawFooter(doc, settings);
  doc.save(`Hasil-${sanitizeFilename(submission.studentName ?? 'Siswa')}-${sanitizeFilename(exam.nama)}.pdf`);
}

export async function exportRecapPdf(payload: ExportPayload): Promise<void> {
  const [{ jsPDF: JsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default;
  const { exam, school, rows, stats } = payload;
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = await drawHeader(doc, school, {
    title: 'REKAPITULASI HASIL UJIAN',
    subtitle: `${exam.nama} • ${exam.mapel} • ${formatDate(exam.mulaiAt)}`,
  });

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255] },
    head: [['Peserta', String(stats.count), 'Rata-rata', formatNumber(stats.avg, 2), 'Tertinggi', formatNumber(stats.max, 2), 'Terendah', formatNumber(stats.min, 2)]],
    body: [['Lulus (≥75)', String(stats.passed), 'Belum lulus', String(Math.max(0, stats.count - stats.passed)), 'KKM', '75', 'Durasi', `${exam.durasiMenit} mnt`]],
    margin: { left: 16, right: 16 },
  });

  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;

  autoTable(doc, {
    startY: y,
    head: [['No', 'NIS', 'Nama', 'Kelas', 'Benar', 'Salah', 'Kosong', 'Nilai', 'Status', 'Waktu Submit']],
    body: rows.map((row) => [
      String(row.no),
      row.nis || '-',
      sanitizeText(row.nama),
      row.kelas || '-',
      String(row.benar),
      String(row.salah),
      String(row.kosong),
      formatNumber(row.skor, 2),
      SUBMISSION_STATUS_LABELS[row.status] ?? row.status,
      row.submitAt ? formatDateTime(row.submitAt) : '-',
    ]),
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 45 },
      3: { cellWidth: 20 },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 14, halign: 'center' },
      8: { cellWidth: 26 },
      9: { cellWidth: 26 },
    },
    margin: { left: 16, right: 16 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  signature(doc, school, finalY + 12);
  drawFooter(doc, school);
  doc.save(`Rekap-${sanitizeFilename(exam.nama)}.pdf`);
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60);
}
