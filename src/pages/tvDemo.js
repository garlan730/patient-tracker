// Fictional patients for previewing the TV board locally (/tv-demo, dev server only). Not real people.
import { format, subDays } from 'date-fns';

const d = (n) => format(subDays(new Date(), n), 'yyyy-MM-dd');
const names = ['Rina Saputri', 'Budi Hartono', 'Sitti Aminah', 'Daeng Rahman', 'Wulan Pertiwi', 'Andi Firmansyah', 'Nurul Hidayah',
  'Yusuf Kurniawan', 'Hasna Marlina', 'Arif Setiawan', 'Dewi Lestari', 'Fajar Nugroho', 'Maya Anggraini', 'Rudi Hamzah'];
const internalSteps = ['consultation', 'anatomic', 'physio', 'vertical', 'tryin', 'sent_lab', 'arrived'];
const tanamSteps = ['consultation', 'anatomic', 'physio', 'vertical', 'material', 'implant', 'control1', 'control2'];

export const DEMO_DOCTORS = [
  { id: 'd1', name: 'drg. Contoh Satu, Sp.Pros' },
  { id: 'd2', name: 'drg. Contoh Dua, Sp.Pros' },
  { id: 'd3', name: 'drg. Contoh Tiga' },
];

export const DEMO_PATIENTS = names.flatMap((name, i) => {
  const ni = 1 + (i % internalSteps.length);
  const internal = {
    id: `i${i}`, name, program: 'internal', doctorId: DEMO_DOCTORS[i % 3].id, createdAt: d(120),
    visits: internalSteps.slice(0, ni).map((stepId, j) => ({ id: `v${i}${j}`, stepId, date: d((ni - j) * 7 + (i * 5) % 70) })),
  };
  if (i >= 9) return [internal];
  const nt = 1 + (i % tanamSteps.length);
  const tanam = {
    id: `t${i}`, name: names[(i + 5) % names.length].split(' ').reverse().join(' '), program: 'tanam', doctorId: DEMO_DOCTORS[(i + 1) % 3].id, createdAt: d(200),
    steps: Object.fromEntries(tanamSteps.slice(0, nt).map((s, j) => [s, { date: d((nt - j) * 10 + (i * 9) % 65) }])),
  };
  return [internal, tanam];
});
