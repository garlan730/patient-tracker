import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, MoreHorizontal } from 'lucide-react';
import { WAITING_DAYS, isFlexible, stepsFor } from '../lib/constants.js';
import { daysSince, fmtDate } from '../lib/dates.js';
import { cx } from './ui.jsx';
import { t } from '../lib/i18n-core.js';

// Days since the last recorded step (or since the patient was added, if none). Completed patients aren't waiting.
export function waitingDays(patient, progress) {
  if (progress.status === 'completed') return null;
  return daysSince(progress.lastActivity || patient.createdAt?.slice(0, 10));
}

export function WaitingBadge({ days, compact }) {
  if (days == null) return <span className="text-xs text-slate-400">—</span>;
  const tone = days >= WAITING_DAYS.alert
    ? 'bg-red-50 text-red-700 ring-red-200'
    : days >= WAITING_DAYS.warn
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : 'bg-slate-50 text-slate-600 ring-slate-200';
  return (
    <span
      className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset', tone)}
      title={days >= WAITING_DAYS.warn ? t('No step recorded for {n} days', { n: days }) : undefined}
    >
      {compact ? t('{n}d', { n: days }) : t(days === 1 ? '{n} day' : '{n} days', { n: days })}
    </span>
  );
}

// One segment per step: green = done, orange with a ring = next, light grey = later, dashed = not needed.
// The ring matters: some colour-blind users can't tell this orange from the green.
// Each segment is a button that opens that step's date/note editor.
export function ProgressStrip({ patient, progress, onStep, size = 'sm' }) {
  const flexible = isFlexible(patient);
  // Visit log (flexible programs): one segment per visit (steps can repeat), then the chosen next step.
  // Fixed programs: one segment per step in order.
  const segments = flexible
    ? [
        ...progress.visits.map((v) => ({ key: v.id, step: v.step, record: v, visit: v })),
        ...(progress.nextStep ? [{ key: 'next', step: progress.nextStep, record: null }] : []),
      ]
    : stepsFor(patient).map((s) => ({ key: s.id, step: s, record: patient.steps?.[s.id] }));
  return (
    <div className={cx('flex w-full items-center', size === 'lg' ? 'gap-1' : 'gap-0.5')} role="list" aria-label={t('Treatment steps')}>
      {segments.map(({ key, step: s, record: st, visit }) => {
        const done = !!st?.date;
        const next = !done && progress.nextStep?.id === s.id;
        const skipped = !done && !progress.inPlan(s.id);
        const label = `${s.label}: ${done ? fmtDate(st.date) : skipped ? t('not needed') : next ? t('next step') : t('not done yet')}${st?.note ? ` — ${st.note}` : ''}`;
        return (
          <button
            key={key}
            type="button"
            role="listitem"
            title={label}
            aria-label={label}
            onClick={(e) => { e.stopPropagation(); onStep(s.id, visit); }}
            className={cx('group/seg', flexible ? (size === 'lg' ? 'w-9' : 'w-7') : 'flex-1', size === 'lg' ? 'py-2' : 'py-1.5')}
          >
            <span
              className={cx(
                'relative block w-full rounded-full transition-transform group-hover/seg:scale-y-150',
                size === 'lg' ? 'h-2.5' : 'h-2',
                done ? 'bg-brand-600' : next ? 'bg-orange-500 outline outline-2 outline-offset-2 outline-orange-400' : skipped ? 'border border-dashed border-slate-300 bg-transparent' : 'bg-slate-200'
              )}
            >
              {st?.note && <span className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-500" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Text under the strip, in the same order and colours as the bar: done (green) on the left,
// what's next (orange) on the right.
export function ProgressSummary({ progress, onPickNext }) {
  const { status, nextStep, lastStep, completed, total, remaining, flexible } = progress;
  const nextText = <>{t('Next:')} <span className="font-semibold">{nextStep?.label}</span></>;
  return (
    <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
      <span className={lastStep ? 'text-brand-700' : 'text-slate-400'}>
        <span className="tabular-nums">{flexible ? t(completed === 1 ? '{n} visit' : '{n} visits', { n: completed }) : t('{done} of {total}', { done: completed, total })}</span>
        {' · '}
        {lastStep ? <>{t('Last:')} <span className="font-medium">{lastStep.label}</span></> : t('No steps yet')}
      </span>
      {status === 'completed' ? (
        <span className="font-medium text-brand-700">{t('Completed')}</span>
      ) : (
        onPickNext && (remaining.length > 1 || flexible) ? (
          <RowMenu
            label={t('Change next step')}
            triggerClassName="inline-flex items-center gap-0.5 rounded px-1 -mx-1 text-orange-700 hover:bg-orange-50"
            trigger={<>{nextText}<ChevronDown size={12} /></>}
            heading={t('Next step')}
            items={remaining.map((s) => ({
              label: s.label,
              icon: <Check size={14} className={s.id === nextStep?.id ? 'text-orange-600' : 'invisible'} />,
              onClick: () => onPickNext(s.id),
            }))}
          />
        ) : (
          <span className="text-orange-700">{nextText}</span>
        )
      )}
    </div>
  );
}

// ⋯ menu rendered with fixed positioning so it isn't clipped by the scrolling table.
export function RowMenu({ items, label = t('More actions'), trigger, triggerClassName, heading }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setPos(null); };
    const esc = (e) => e.key === 'Escape' && setPos(null);
    const off = () => setPos(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', off, true);
    window.addEventListener('resize', off);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', off, true);
      window.removeEventListener('resize', off);
    };
  }, [pos]);

  const open = (e) => {
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = btn.current.getBoundingClientRect();
    const width = 208;
    const below = window.innerHeight - r.bottom > 330;
    setPos({ left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8), top: below ? r.bottom + 4 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 4, width });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={open}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className={triggerClassName || 'rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700'}
      >
        {trigger || <MoreHorizontal size={16} />}
      </button>
      {pos && (
        <div ref={menu} role="menu" style={pos} className="fixed z-50 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {heading && <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>}
          {items.filter(Boolean).map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setPos(null); it.onClick(); }}
              className={cx('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50', it.danger ? 'text-red-600' : 'text-slate-700')}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
