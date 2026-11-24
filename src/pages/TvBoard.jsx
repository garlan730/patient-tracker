import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PROGRAMS, WAITING_DAYS, programOf } from '../lib/constants.js';
import { getProgress, visitsOf } from '../lib/patients.js';
import { daysSince, fmt, fmtDate } from '../lib/dates.js';
import { useData } from '../lib/data.jsx';
import { t } from '../lib/i18n.jsx';
import { cx } from '../components/ui.jsx';
import logo from '../assets/logo.png';
import { DEMO_DOCTORS, DEMO_PATIENTS } from './tvDemo.js';

// Read-only progress board for the clinic TV (staff room). Drawn on a fixed 1920×1080 stage and
// scaled to the screen, so it looks the same on any TV. Long lists page through on their own.
// Remote: arrows pick a patient (auto-paging stops), OK opens their visit timeline, Back closes it.
// After IDLE_MS without a key press the board goes back to paging by itself.
const W = 1920;
const H = 1080;
const ROWS_PER_PAGE = 7;
const PAGE_MS = 15000;
const IDLE_MS = 60000;

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

function Row({ row, focused }) {
  const { p, pr, days, doctor } = row;
  return (
    <div
      className={cx(
        'grid grid-cols-[1fr_290px] items-center gap-5 rounded-2xl px-6 py-3 transition-all duration-200',
        focused ? 'scale-[1.02] bg-white/20 ring-4 ring-amber-300 shadow-2xl' : 'bg-white/[0.06] ring-1 ring-white/10'
      )}
    >
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

const pagesOf = (rows) => Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

function Column({ program, rows, page, focusIdx }) {
  const pages = pagesOf(rows);
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
        {shown.map((row, i) => <Row key={row.p.id} row={row} focused={page * ROWS_PER_PAGE + i === focusIdx} />)}
        {rows.length === 0 && <p className="text-[24px] text-brand-200">{t('No patients in progress.')}</p>}
      </div>
    </section>
  );
}

const MAX_VISITS = 16;

// Full-screen panel with every recorded visit, oldest first, then the next step and (for fixed programs)
// the planned steps still to come. Notes are left out on purpose.
function Timeline({ row }) {
  const { p, pr, days, doctor } = row;
  const visits = visitsOf(p);
  const hidden = Math.max(0, visits.length - MAX_VISITS);
  const shown = visits.slice(-MAX_VISITS);
  const upcoming = pr.flexible ? (pr.nextStep ? [pr.nextStep] : []) : pr.remaining;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
      <div className="h-[900px] w-[1700px] rounded-[36px] bg-white p-14 text-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-10 border-b border-slate-200 pb-7">
          <div className="min-w-0">
            <div className="text-[22px] font-medium text-brand-700">{PROGRAMS[programOf(p)].label}</div>
            <h2 className="truncate text-[56px] font-bold leading-tight">{p.name}</h2>
            {doctor && <div className="text-[26px] text-slate-500">{doctor}</div>}
          </div>
          <div className="flex-none text-right">
            <div className="text-[48px] font-bold text-brand-700">{pr.percent}%</div>
            <div className="mt-1 h-3 w-[300px] overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${pr.percent}%` }} />
            </div>
            <div className={cx('mt-3 text-[24px] font-semibold', days >= WAITING_DAYS.alert ? 'text-red-600' : days >= WAITING_DAYS.warn ? 'text-amber-600' : 'text-slate-500')}>
              {days == null ? '' : days === 0 ? t('Last visit today') : t('Last visit {n} days ago', { n: days })}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_440px] gap-12">
          <div>
            <h3 className="mb-4 text-[26px] font-semibold text-slate-500">{t('Visit history')}</h3>
            {visits.length === 0 && <p className="text-[26px] text-slate-500">{t('No visits recorded yet.')}</p>}
            {hidden > 0 && <p className="mb-2 text-[20px] text-slate-400">{t('+{n} earlier visits', { n: hidden })}</p>}
            <ol className={cx('grid gap-x-10', shown.length > 8 && 'grid-flow-col grid-cols-2 grid-rows-8')}>
              {shown.map((v, i) => (
                <li key={v.id || i} className="flex items-center gap-5 py-[9px]">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-600 text-[20px] font-bold text-white">{hidden + i + 1}</span>
                  <span className="w-[170px] flex-none text-[22px] text-slate-500">{fmtDate(v.date, 'd MMM yyyy')}</span>
                  <span className="truncate text-[26px] font-semibold">{v.step.label}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl bg-brand-50 p-8">
            <h3 className="mb-4 text-[26px] font-semibold text-brand-800">{pr.status === 'completed' ? t('Completed') : t('Next step')}</h3>
            {pr.nextStep && <div className="mb-6 rounded-2xl bg-brand-700 px-6 py-4 text-[30px] font-bold text-white">→ {pr.nextStep.label}</div>}
            {!pr.flexible && upcoming.length > 1 && (
              <>
                <div className="mb-2 text-[20px] text-brand-800">{t('Still planned')}</div>
                <ul className="space-y-1.5">
                  {upcoming.filter((s) => s.id !== pr.nextStep?.id).slice(0, 8).map((s) => (
                    <li key={s.id} className="text-[22px] text-slate-600">○ {s.label}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-right text-[20px] text-slate-400">{t('Press Back to close')}</p>
      </div>
    </div>
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

  // sel = { col, idx } while someone is using the remote; null = auto-paging.
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState(false);
  const frozen = useRef([]); // each column's page when the remote was first pressed
  const idleTimer = useRef(null);

  const autoPage = (rows) => tick % pagesOf(rows);
  const pageOf = (ci) => {
    const rows = columns[ci].rows;
    if (!sel) return autoPage(rows);
    if (sel.col === ci) return Math.floor(sel.idx / ROWS_PER_PAGE);
    return Math.min(frozen.current[ci] ?? 0, pagesOf(rows) - 1);
  };

  const reset = useCallback(() => { setOpen(false); setSel(null); }, []);
  const touch = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(reset, IDLE_MS);
  }, [reset]);
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  // Back from the TV app: close the timeline, then leave selection mode. Returns false to let the app exit.
  const back = useCallback(() => {
    if (open) { setOpen(false); touch(); return true; }
    if (sel) { reset(); return true; }
    return false;
  }, [open, sel, reset, touch]);
  useEffect(() => {
    window.tvBack = back;
    return () => { if (window.tvBack === back) delete window.tvBack; };
  }, [back]);

  useEffect(() => {
    if (!ready) return undefined;
    const onKey = (e) => {
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      touch();
      if (e.key === 'Escape' || e.key === 'Backspace') { back(); return; }
      if (open) return; // the timeline only closes with Back
      const nonEmpty = columns.map((c, i) => (c.rows.length ? i : -1)).filter((i) => i >= 0);
      if (!nonEmpty.length) return;
      if (!sel) {
        // First press: freeze the pages on screen and select the top patient that is showing.
        frozen.current = columns.map((c) => autoPage(c.rows));
        const ci = nonEmpty[0];
        setSel({ col: ci, idx: Math.min(frozen.current[ci] * ROWS_PER_PAGE, columns[ci].rows.length - 1) });
        return;
      }
      const rows = columns[sel.col].rows;
      if (e.key === 'Enter') { if (rows[sel.idx]) setOpen(true); return; }
      if (e.key === 'ArrowUp') setSel({ ...sel, idx: Math.max(0, sel.idx - 1) });
      if (e.key === 'ArrowDown') setSel({ ...sel, idx: Math.min(rows.length - 1, sel.idx + 1) });
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const to = nonEmpty[nonEmpty.indexOf(sel.col) + (e.key === 'ArrowRight' ? 1 : -1)];
        if (to == null) return;
        // Keep the same spot on the page in the other column.
        frozen.current[sel.col] = Math.floor(sel.idx / ROWS_PER_PAGE);
        const page = Math.min(frozen.current[to] ?? 0, pagesOf(columns[to].rows) - 1);
        const idx = Math.min(page * ROWS_PER_PAGE + (sel.idx % ROWS_PER_PAGE), columns[to].rows.length - 1);
        setSel({ col: to, idx });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Keep the selection valid when the patient list changes underneath it.
  const selRow = sel ? columns[sel.col]?.rows[Math.min(sel.idx, (columns[sel.col]?.rows.length || 1) - 1)] : null;
  useEffect(() => {
    if (sel && !selRow) reset();
  }, [sel, selRow, reset]);

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
            {columns.map((c, ci) => (
              <Column key={c.program} program={c.program} rows={c.rows} page={pageOf(ci)} focusIdx={sel?.col === ci ? sel.idx : -1} />
            ))}
          </div>
        )}

        <footer className="absolute bottom-10 left-16 right-16 flex items-center justify-between text-[19px] text-brand-200">
          <span>{error || (sel ? t('OK: open visit timeline · Back: return to auto view') : t('Use the arrows on the remote to pick a patient. For staff only.'))}</span>
          <span className="flex gap-6">
            <span className="text-amber-300">● {t('{n}+ days', { n: WAITING_DAYS.warn })}</span>
            <span className="text-red-300">● {t('{n}+ days', { n: WAITING_DAYS.alert })}</span>
          </span>
        </footer>

        {open && selRow && <Timeline row={selRow} />}
      </div>
    </div>
  );
}
