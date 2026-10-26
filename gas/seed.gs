/**
 * Demo dataset: 3 accounts (one per role), 9 questions, 2 exams, 3 graded
 * submissions. Safe to run only on an empty Users sheet.
 *
 * Demo passwords:
 *   admin@cbt.local / Admin#123
 *   guru@cbt.local  / Guru#123
 *   siswa@cbt.local / Siswa#123
 */

var SEED_CREDENTIALS = {
  'admin@cbt.local': 'gjqOCiRuNOCRvTcR3UM5YdeluqIrX6Z0XQ5rZYdzIOo=',
  'guru@cbt.local': '2u9Iu/3nsvgp4Hx6+npm9nfDIS2ZTVodYOWUC5Pphbo=',
  'siswa@cbt.local': 'IanebL5A8SHWj9uoYyR2eV7XwDTWJ8pDyW2ESZiJ/v0=',
  'siswa2@cbt.local': 'Y/d1rM6ulaUK7EwE5fpyr8EvEcPBPz3+r5JCC3eI4+g=',
  'siswa3@cbt.local': 'Mf4ZhfffDP0t4POf4XAtV57MeD+Mw3d/0p/hYTRWYfg=',
};

function seedDemoData(skipCheck) {
  if (!skipCheck && readRows_('Users').length > 0) {
    fail_(
      'CONFLICT',
      'Sheet Users sudah berisi data. Gunakan resetDemoData() bila ini spreadsheet demo.',
    );
  }

  const secret = tokenSecret_();
  if (!secret) fail_('INTERNAL', 'TOKEN_SECRET gagal dibuat. Jalankan setupSpreadsheet().');

  const now = Date.now();
  const hour = 3600000;
  const day = 86400000;
  function iso(offset) {
    return new Date(Date.now() + offset).toISOString();
  }
  /* ---------------------------------------------------------------- users */

  const users = [
    { id: 'USR-admin', email: 'admin@cbt.local', name: 'Admin Sekolah', role: 'admin' },
    { id: 'USR-guru', email: 'guru@cbt.local', name: 'Budi Santoso, S.Pd.', role: 'guru' },
    {
      id: 'USR-siswa',
      email: 'siswa@cbt.local',
      name: 'Ani Lestari',
      role: 'siswa',
      nis: '2024001',
      kelas: 'XII-IPA-1',
    },
    {
      id: 'USR-siswa2',
      email: 'siswa2@cbt.local',
      name: 'Bima Prakoso',
      role: 'siswa',
      nis: '2024002',
      kelas: 'XII-IPA-1',
    },
    {
      id: 'USR-siswa3',
      email: 'siswa3@cbt.local',
      name: 'Citra Dewi',
      role: 'siswa',
      nis: '2024003',
      kelas: 'XII-IPA-2',
    },
  ];

  users.forEach(function (user) {
    insertRow_('Users', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      nis: user.nis || '',
      kelas: user.kelas || '',
      passwordHash: hashCredential_(SEED_CREDENTIALS[user.email]),
      googleSub: '',
      avatarUrl: '',
      active: true,
      tokenVersion: 0,
      createdAt: iso(-30 * day),
      updatedAt: iso(),
    });
  });

  /* ------------------------------------------------------------ questions */

  function option(id, teks) {
    return { id: id, teks: teks };
  }

  const questions = [
    {
      id: 'QST-eksponen',
      tipe: 'pg',
      pertanyaan: 'Hasil dari 2^5 adalah ...',
      options: [option('A', '16'), option('B', '25'), option('C', '32'), option('D', '64'), option('E', '128')],
      kunci: { selected: ['C'] },
      bobot: 1,
      tingkat: 'mudah',
      tags: 'eksponen,pangkat',
      pembahasan: '2^5 = 2 x 2 x 2 x 2 x 2 = 32.',
    },
    {
      id: 'QST-gradien',
      tipe: 'pg',
      pertanyaan: 'Gradien garis dengan persamaan y = 2x + 3 adalah ...',
      options: [option('A', '1'), option('B', '2'), option('C', '3'), option('D', '-2'), option('E', '-3')],
      kunci: { selected: ['B'] },
      bobot: 1,
      tingkat: 'sedang',
      tags: 'gradien,persamaan-garis',
      pembahasan: 'Bentuk y = mx + c memiliki gradien m = 2.',
    },
    {
      id: 'QST-kuadrat',
      tipe: 'pg',
      pertanyaan: 'Himpunan penyelesaian dari x^2 - 5x + 6 = 0 adalah ...',
      options: [
        option('A', '{1, 6}'),
        option('B', '{2, 3}'),
        option('C', '{-2, -3}'),
        option('D', '{2, -3}'),
        option('E', '{1, 5}'),
      ],
      kunci: { selected: ['B'] },
      bobot: 1,
      tingkat: 'sedang',
      tags: 'persamaan-kuadrat',
      pembahasan: '(x - 2)(x - 3) = 0, sehingga x = 2 atau x = 3.',
    },
    {
      id: 'QST-trigonometri',
      tipe: 'pg',
      pertanyaan: 'Nilai sin 30 derajat adalah ...',
      options: [
        option('A', '0'),
        option('B', '1/2'),
        option('C', '1/2 akar 2'),
        option('D', '1/2 akar 3'),
        option('E', '1'),
      ],
      kunci: { selected: ['B'] },
      bobot: 1,
      tingkat: 'mudah',
      tags: 'trigonometri',
      pembahasan: 'sin 30 derajat = 1/2.',
    },
    {
      id: 'QST-keliling',
      tipe: 'pg',
      pertanyaan: 'Keliling persegi dengan panjang sisi 7 cm adalah ...',
      options: [
        option('A', '14 cm'),
        option('B', '21 cm'),
        option('C', '28 cm'),
        option('D', '35 cm'),
        option('E', '49 cm'),
      ],
      kunci: { selected: ['C'] },
      bobot: 1,
      tingkat: 'mudah',
      tags: 'geometri',
      pembahasan: 'Keliling persegi = 4 x 7 = 28 cm.',
    },
    {
      id: 'QST-faktor',
      tipe: 'pg_kompleks',
      pertanyaan: 'Manakah bilangan berikut yang merupakan faktor dari 12? (Pilih semua yang benar)',
      options: [option('A', '2'), option('B', '3'), option('C', '4'), option('D', '5'), option('E', '6')],
      kunci: { selected: ['A', 'B', 'C', 'E'] },
      bobot: 2,
      tingkat: 'sedang',
      tags: 'faktor,bilangan',
      pembahasan: 'Faktor 12: 1, 2, 3, 4, 6, 12.',
    },
    {
      id: 'QST-genap',
      tipe: 'benar_salah',
      pertanyaan: 'Bilangan 0 termasuk bilangan genap.',
      options: [option('B', 'Benar'), option('S', 'Salah')],
      kunci: { value: true },
      bobot: 1,
      tingkat: 'mudah',
      tags: 'bilangan',
      pembahasan: '0 habis dibagi 2, sehingga termasuk bilangan genap.',
    },
    {
      id: 'QST-ibukota',
      tipe: 'isian',
      pertanyaan: 'Ibu kota Indonesia adalah ...',
      options: [],
      kunci: { accepted: ['jakarta', 'dki jakarta'] },
      bobot: 2,
      tingkat: 'mudah',
      kategori: 'IPS',
      tags: 'geografi',
      pembahasan: 'Ibu kota Indonesia adalah Jakarta.',
    },
    {
      id: 'QST-essay',
      tipe: 'essay',
      pertanyaan: 'Jelaskan langkah-langkah menyelesaikan persamaan linear satu variabel 3x + 5 = 20.',
      options: [],
      kunci: { rubrik: 'Langkah memindahkan konstanta, membagi koefisien, dan menuliskan x = 5.' },
      bobot: 5,
      tingkat: 'sulit',
      tags: 'aljabar',
      pembahasan: '3x = 15 sehingga x = 5.',
    },
  ];

  questions.forEach(function (question) {
    insertRow_('Questions', {
      id: question.id,
      ownerId: 'USR-guru',
      tipe: question.tipe,
      pertanyaan: question.pertanyaan,
      gambarUrl: '',
      opsiJson: toJson_(question.options),
      kunciJson: toJson_(question.kunci),
      pembahasan: question.pembahasan || '',
      bobot: question.bobot,
      tingkat: question.tingkat,
      kategori: question.kategori || 'Matematika',
      tags: question.tags || '',
      aktif: true,
      createdAt: iso(-10 * day),
      updatedAt: iso(-2 * day),
    });
  });

  /* ---------------------------------------------------------------- exams */

  const examBase = {
    ownerId: 'USR-guru',
    mapel: 'Matematika',
    acakSoal: false,
    acakOpsi: true,
    tampilkanPembahasan: true,
    tampilkanNilai: true,
    kelasTargetJson: toJson_(['XII-IPA-1', 'XII-IPA-2']),
    createdAt: iso(-8 * day),
    updatedAt: iso(-2 * day),
  };

  insertRow_('Exams', {
    id: 'EXM-demo',
    ownerId: examBase.ownerId,
    nama: 'Ujian Demo Matematika',
    mapel: examBase.mapel,
    deskripsi: 'Ujian demo untuk mencoba alur CBT dari login sampai melihat nilai.',
    durasiMenit: 30,
    mulaiAt: iso(-2 * hour),
    selesaiAt: iso(7 * day),
    jumlahSoal: 5,
    acakSoal: examBase.acakSoal,
    acakOpsi: examBase.acakOpsi,
    tampilkanPembahasan: examBase.tampilkanPembahasan,
    tampilkanNilai: examBase.tampilkanNilai,
    token: '',
    kelasTargetJson: examBase.kelasTargetJson,
    status: 'published',
    createdAt: examBase.createdAt,
    updatedAt: examBase.updatedAt,
  });

  insertRow_('Exams', {
    id: 'EXM-aljabar',
    ownerId: examBase.ownerId,
    nama: 'Ulangan Harian Aljabar',
    mapel: examBase.mapel,
    deskripsi: 'Ulangan yang sudah selesai, dipakai untuk contoh riwayat dan rekap nilai.',
    durasiMenit: 20,
    mulaiAt: iso(-5 * day),
    selesaiAt: iso(-4 * day),
    jumlahSoal: 5,
    acakSoal: examBase.acakSoal,
    acakOpsi: examBase.acakOpsi,
    tampilkanPembahasan: examBase.tampilkanPembahasan,
    tampilkanNilai: examBase.tampilkanNilai,
    token: '',
    kelasTargetJson: examBase.kelasTargetJson,
    status: 'closed',
    createdAt: iso(-8 * day),
    updatedAt: iso(-4 * day),
  });

  const examIds = ['EXM-demo', 'EXM-aljabar'];
  const basicQuestionIds = [
    'QST-eksponen',
    'QST-gradien',
    'QST-kuadrat',
    'QST-trigonometri',
    'QST-keliling',
  ];

  examIds.forEach(function (examId) {
    basicQuestionIds.forEach(function (questionId, index) {
      insertRow_('ExamQuestions', {
        id: examId + '-LINK-' + (index + 1),
        examId: examId,
        questionId: questionId,
        urutan: index + 1,
        bobot: 1,
      });
    });
  });

  /* ---------------------------------------------------------- submissions */

  const answerKey = {
    'QST-eksponen': { selected: ['C'] },
    'QST-gradien': { selected: ['B'] },
    'QST-kuadrat': { selected: ['B'] },
    'QST-trigonometri': { selected: ['B'] },
    'QST-keliling': { selected: ['C'] },
  };

  const attempts = [
    {
      id: 'SUB-demo-ani',
      studentId: 'USR-siswa',
      skor: 80,
      benar: 4,
      salah: 1,
      kosong: 0,
      answers: [
        ['QST-eksponen', answerKey['QST-eksponen'], true],
        ['QST-gradien', answerKey['QST-gradien'], true],
        ['QST-kuadrat', { selected: ['A'] }, false],
        ['QST-trigonometri', answerKey['QST-trigonometri'], true],
        ['QST-keliling', answerKey['QST-keliling'], true],
      ],
    },
    {
      id: 'SUB-demo-bima',
      studentId: 'USR-siswa2',
      skor: 100,
      benar: 5,
      salah: 0,
      kosong: 0,
      answers: [
        ['QST-eksponen', answerKey['QST-eksponen'], true],
        ['QST-gradien', answerKey['QST-gradien'], true],
        ['QST-kuadrat', answerKey['QST-kuadrat'], true],
        ['QST-trigonometri', answerKey['QST-trigonometri'], true],
        ['QST-keliling', answerKey['QST-keliling'], true],
      ],
    },
    {
      id: 'SUB-demo-citra',
      studentId: 'USR-siswa3',
      skor: 60,
      benar: 3,
      salah: 2,
      kosong: 0,
      answers: [
        ['QST-eksponen', answerKey['QST-eksponen'], true],
        ['QST-gradien', { selected: ['D'] }, false],
        ['QST-kuadrat', { selected: ['A'] }, false],
        ['QST-trigonometri', answerKey['QST-trigonometri'], true],
        ['QST-keliling', answerKey['QST-keliling'], true],
      ],
    },
  ];

  attempts.forEach(function (attempt) {
    const mulaiAt = iso(-5 * day + hour);
    const submitAt = iso(-5 * day + hour + 15 * 60000);
    insertRow_('Submissions', {
      id: attempt.id,
      examId: 'EXM-aljabar',
      studentId: attempt.studentId,
      mulaiAt: mulaiAt,
      expiresAt: iso(-5 * day + hour + 20 * 60000),
      submitAt: submitAt,
      status: 'graded',
      skor: attempt.skor,
      skorMaks: 100,
      benar: attempt.benar,
      salah: attempt.salah,
      kosong: attempt.kosong,
      perluManual: 0,
      tabSwitchCount: 0,
      autoSubmitted: false,
      lastSeenAt: submitAt,
      questionOrderJson: toJson_(basicQuestionIds),
      durationSec: 900,
      userAgent: 'seed',
    });

    attempt.answers.forEach(function (entry, index) {
      insertRow_('Answers', {
        id: attempt.id + '-ANS-' + (index + 1),
        examId: 'EXM-aljabar',
        userId: attempt.studentId,
        submissionId: attempt.id,
        questionId: entry[0],
        jawabanJson: toJson_(entry[1]),
        ragu: false,
        benar: entry[2],
        skor: entry[2] ? 1 : 0,
        dinilaiOleh: '',
        dinilaiAt: '',
        updatedAt: submitAt,
      });
    });
  });

  insertRow_('Logs', {
    id: newId_('LOG'),
    ts: iso(-2 * hour),
    actorId: 'USR-guru',
    actorName: 'Budi Santoso, S.Pd.',
    action: 'exam.publish',
    entity: 'exam',
    entityId: 'EXM-demo',
    metaJson: toJson_({ nama: 'Ujian Demo Matematika' }),
  });
  insertRow_('Logs', {
    id: newId_('LOG'),
    ts: iso(-5 * day + hour),
    actorId: 'USR-siswa',
    actorName: 'Ani Lestari',
    action: 'exam.submit',
    entity: 'submission',
    entityId: 'SUB-demo-ani',
    metaJson: toJson_({ skor: 80 }),
  });

  SpreadsheetApp.flush();

  const summary = {
    users: 5,
    questions: 9,
    exams: 2,
    submissions: 3,
    note: 'Login: admin@cbt.local / Admin#123 (idem guru & siswa).',
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}
