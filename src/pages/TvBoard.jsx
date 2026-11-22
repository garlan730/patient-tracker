import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PROGRAMS, WAITING_DAYS, programOf } from '../lib/constants.js';
import { getProgress } from '../lib/patients.js';
import { daysSince, fmt, fmtDate } from '../lib/dates.js';
import { useData } from '../lib/data.jsx';
import { t } from '../lib/i18n.jsx';
import { cx } from '../components/ui.jsx';
import logo from '../assets/logo.png';
import { DEMO_DOCTORS, DEMO_PATIENTS } from './tvDemo.js';

// Read-only progress board for the clinic TV (staff room). Drawn on a fixed 1920×1080 stage and
// scaled to the screen, so it looks the same on any TV. Long lists page through on their own.
const W = 1920;
const H = 1080;
const ROWS_PER_PAGE = 7;
const PAGE_MS = 15000;

function useStageScale() {
  const get = () => Math.min(window.innerWidth / W, window.innerHeight / H);
  const [k, setK] = useState(get);
  useEffect(() => {
    const on = () => setK(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return k;
}

function useNow(ms) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Longest-waiting patients first, so the ones to follow up are on the first page.
function activeRows(patients, program, doctorName) {
  return patients
    .filter((p) => !p.archived && programOf(p) === program)
    .map((p) => {
      const pr = getProgress(p);
      const since = pr.lastActivity || p.createdAt?.slice(0, 10) || null;
      return { p, pr, days: daysSince(since), doctor: doctorName(p.doctorId) };
    })
    .filter(({ pr }) => pr.status !== 'completed')
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.p.name.localeCompare(b.p.name));
}

function waitTone(days) {
  if (days == null) return 'text-brand-100';
  if (days >= WAITING_DAYS.alert) return 'text-red-300';
  if (days >= WAITING_DAYS.warn) return 'text-amber-300';
  return 'text-brand-100';
}

function Row({ row }) {
  const { p, pr, days, doctor } = row;
  return (
    <div className="grid grid-cols-[1fr_290px] items-center gap-5 rounded-2xl bg-white/[0.06] px-6 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <div className="flex items-baseline gap-4">
          <span className="truncate text-[28px] font-semibold leading-tight text-white">{p.name}</span>
          {doctor && <span className="truncate text-[20px] text-brand-200">{doctor}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-4">
          <div className="h-3 w-[180px] flex-none overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-brand-200" style={{ width: `${pr.percent}%` }} />
          </div>
          <span className="truncate text-[21px] text-brand-100">
            {pr.lastStep ? `${pr.lastStep.label} · ${fmtDate(pr.lastActivity, 'd MMM')}` : t('Not started')}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="truncate text-[21px] font-medium text-white">
          {pr.nextStep ? `→ ${pr.nextStep.label}` : ''}
        </div>
        <div className={cx('mt-1 text-[20px] font-semibold', waitTone(days))}>
          {days == null ? '' : days === 0 ? t('Today') : t('{n} days ago', { n: days })}
        </div>
      </div>
    </div>
  );
}

function Column({ program, rows, tick }) {
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const page = tick % pages;
  const shown = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  return (
    <section className="flex min-w-0 flex-col">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[34px] font-semibold text-white">{PROGRAMS[program].label}</h2>
        <span className="text-[22px] text-brand-200">
          {t('{n} in progress', { n: rows.length })}
          {pages > 1 && ` · ${page + 1}/${pages}`}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {shown.map((row) => <Row key={row.p.id} row={row} />)}
        {rows.length === 0 && <p className="text-[24px] text-brand-200">{t('No patients in progress.')}</p>}
      </div>
    </section>
  );
}

export default function TvBoard({ demo = false }) {
  const data = useData();
  // demo: fictional patients for checking the layout on the dev server.
  const patients = demo ? DEMO_PATIENTS : data.patients;
  const doctorName = demo ? (id) => DEMO_DOCTORS.find((x) => x.id === id)?.name || '' : data.doctorName;
  const loading = demo ? false : data.loading;
  const error = demo ? '' : data.error;
  const k = useStageScale();
  const now = useNow(1000); // clock and page turns
  const tick = Math.floor(now.getTime() / PAGE_MS);

  const columns = useMemo(
    () => Object.keys(PROGRAMS).map((program) => ({ program, rows: activeRows(patients, program, doctorName) })),
    [patients, doctorName]
  );
  const ready = !loading;

  return (
    <div className="fixed inset-0 cursor-none overflow-hidden bg-brand-900">
      <div
        className="absolute bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 px-16 py-12"
        style={{ width: W, height: H, transform: `scale(${k})`, transformOrigin: '0 0', left: (window.innerWidth - W * k) / 2, top: (window.innerHeight - H * k) / 2 }}
      >
        <header className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <img src={logo} alt="" className="h-16 w-16 rounded-xl bg-white p-1" />
            <div>
              <h1 className="text-[40px] font-semibold leading-none text-white">{t('Patient Progress')}</h1>
              <p className="mt-2 text-[20px] text-brand-200">{t('Sorted by longest wait since the last visit')}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[52px] font-semibold leading-none text-white">{fmt(now, 'HH.mm')}</div>
            <div className="mt-2 text-[20px] text-brand-200">{fmt(now, 'EEEE, d MMMM yyyy')}</div>
          </div>
        </header>

        {!ready ? (
          <div className="flex h-[700px] items-center justify-center text-brand-200"><Loader2 size={48} className="animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-12">
            {columns.map((c) => <Column key={c.program} program={c.program} rows={c.rows} tick={tick} />)}
          </div>
        )}

        <footer className="absolute bottom-10 left-16 right-16 flex items-center justify-between text-[19px] text-brand-200">
          <span>{error || t('Updates automatically. For staff only.')}</span>
          <span className="flex gap-6">
            <span className="text-amber-300">● {t('{n}+ days', { n: WAITING_DAYS.warn })}</span>
            <span className="text-red-300">● {t('{n}+ days', { n: WAITING_DAYS.alert })}</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
