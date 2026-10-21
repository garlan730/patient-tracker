import { format } from 'date-fns';
import { PROGRAMS, STATUS } from './constants.js';
import { getProgress } from './patients.js';

const escape = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportPatientsCsv(patients, doctorName, program) {
  const TREATMENT_STEPS = PROGRAMS[program].steps;
  const header = [
    'Patient', 'Phone', 'Doctor', 'Status', 'Progress (%)', 'Last Activity',
    ...TREATMENT_STEPS.flatMap((s) => [s.label, `${s.label} Note`]),
    'Patient Notes',
  ];
  const rows = patients.map((p) => {
    const pr = getProgress(p);
    return [
      p.name,
      p.phone,
      doctorName(p.doctorId),
      STATUS[pr.status].label,
      pr.percent,
      pr.lastActivity || '',
      ...TREATMENT_STEPS.flatMap((s) => [p.steps?.[s.id]?.date || '', p.steps?.[s.id]?.note || '']),
      (p.notes || []).map((n) => `[${n.createdAt.slice(0, 10)} ${n.authorName}] ${n.text}`).join(' | '),
    ];
  });

  // BOM so Excel opens UTF-8 correctly.
  const csv = '﻿' + [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient-tracker-${program}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
