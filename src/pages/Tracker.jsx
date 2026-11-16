import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Archive, ArchiveRestore, Trash2, Pencil, MessageSquare, SlidersHorizontal, X, Users, ChevronDown, CalendarPlus, CalendarDays } from 'lucide-react';
import { PROGRAMS, STATUS, WAITING_DAYS, programOf } from '../lib/constants.js';
import { getProgress } from '../lib/patients.js';
import { fmtDate, toDate } from '../lib/dates.js';
import { exportPatientsCsv } from '../lib/csv.js';
import { t } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { Button, Card, EmptyState, Input, PageHeader, ProgressBar, Select, StatusBadge, cx, useConfirm } from '../components/ui.jsx';
import StepModal from '../components/StepModal.jsx';
import PatientFormModal from '../components/PatientFormModal.jsx';
import PatientDrawer from '../components/PatientDrawer.jsx';
import { ProgressStrip, ProgressSummary, RowMenu, WaitingBadge, shortDoctor, waitingDays } from '../components/TrackerParts.jsx';

const SORTS = {
  recent: { label: 'Last activity (newest)', fn: (a, b) => (b.pr.lastActivity || '').localeCompare(a.pr.lastActivity || '') },
  oldest: { label: 'Last activity (oldest)', fn: (a, b) => (a.pr.lastActivity || '9').localeCompare(b.pr.lastActivity || '9') },
  name: { label: 'Name (A–Z)', fn: (a, b) => a.p.name.localeCompare(b.p.name) },
  waiting: { label: 'Waiting longest', fn: (a, b) => (b.wait ?? -1) - (a.wait ?? -1) },
  progress: { label: 'Progress (most)', fn: (a, b) => b.pr.percent - a.pr.percent },
  created: { label: 'Recently added', fn: (a, b) => b.p.createdAt.localeCompare(a.p.createdAt) },
};

const FILTER_KEYS = ['q', 'doctor', 'status', 'stage', 'waiting', 'dateField', 'from', 'to', 'archived'];

export default function Tracker() {
  const { patients, doctors, doctorName, updatePatient, deletePatient } = useData();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(() => FILTER_KEYS.slice(1).some((k) => params.get(k)));
  const [stepTarget, setStepTarget] = useState(null);
  const [form, setForm] = useState({ open: false, patient: null });
  const [drawerId, setDrawerId] = useState(null);

  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const sort = params.get('sort') || 'recent';
  const program = PROGRAMS[params.get('program')] ? params.get('program') : 'tanam';
  const TREATMENT_STEPS = PROGRAMS[program].steps;
  const showDates = params.get('view') === 'dates';
  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const clearFilters = () => {
    const keep = {};
    if (sort !== 'recent') keep.sort = sort;
    if (program !== 'tanam') keep.program = program;
    if (showDates) keep.view = 'dates';
    setParams(keep, { replace: true });
  };
  // Step-based filters don't carry over between programs because the step lists differ.
  const switchProgram = (next) => {
    const nextParams = new URLSearchParams(params);
    ['stage', 'dateField'].forEach((k) => nextParams.delete(k));
    if (next === 'tanam') nextParams.delete('program');
    else nextParams.set('program', next);
    setParams(nextParams, { replace: true });
  };
  const programCounts = useMemo(() => {
    const counts = Object.fromEntries(Object.keys(PROGRAMS).map((k) => [k, 0]));
    patients.forEach((p) => { if (!p.archived) counts[programOf(p)]++; });
    return counts;
  }, [patients]);
  const activeFilterCount = FILTER_KEYS.slice(1).filter((k) => f[k]).length;

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const from = toDate(f.from);
    const to = toDate(f.to);
    return patients
      .map((p) => { const pr = getProgress(p); return { p, pr, wait: waitingDays(p, pr) }; })
      .filter(({ p, pr, wait }) => {
        if (programOf(p) !== program) return false;
        if (!!p.archived !== (f.archived === '1')) return false;
        if (q && ![p.name, p.phone, doctorName(p.doctorId)].some((v) => v?.toLowerCase().includes(q))) return false;
        if (f.doctor === 'none' ? doctors.some((d) => d.id === p.doctorId) : f.doctor && p.doctorId !== f.doctor) return false;
        if (f.status && pr.status !== f.status) return false;
        if (f.stage && pr.nextStep?.id !== f.stage) return false;
        if (f.waiting && !(wait >= Number(f.waiting))) return false;
        if (from || to) {
          const iso = !f.dateField || f.dateField === 'activity' ? pr.lastActivity : p.steps?.[f.dateField]?.date;
          const d = toDate(iso);
          if (!d || (from && d < from) || (to && d > to)) return false;
        }
        return true;
      })
      .sort(SORTS[sort]?.fn || SORTS.recent.fn);
  }, [patients, doctors, doctorName, f.q, f.doctor, f.status, f.stage, f.waiting, f.dateField, f.from, f.to, f.archived, sort, program]);

  // Clicking a column heading sorts by it; clicking the active heading goes back to the default.
  const sortBy = (key) => setParam('sort', sort === key ? '' : key);
  const recordNext = (p, pr) => pr.nextStep && setStepTarget({ patient: p, stepId: pr.nextStep.id });
  const menuItems = (p) => [
    { label: t('Edit patient'), icon: <Pencil size={14} />, onClick: () => setForm({ open: true, patient: p }) },
    { label: p.archived ? t('Restore') : t('Archive'), icon: p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />, onClick: () => toggleArchive(p) },
    isAdmin && { label: t('Delete'), icon: <Trash2 size={14} />, danger: true, onClick: () => handleDelete(p) },
  ];

  const toggleArchive = (p) => updatePatient(p.id, { archived: !p.archived });
  const handleDelete = async (p) => {
    const ok = await confirm({
      title: t('Delete patient?'),
      message: t('{name} and all of their treatment dates and notes will be permanently deleted. Consider archiving instead.', { name: p.name }),
      confirmLabel: t('Delete'),
      danger: true,
    });
    if (ok) deletePatient(p.id);
  };

  return (
    <>
      <PageHeader
        title={t('Patient Tracker')}
        description={`${PROGRAMS[program].label} · ${t(f.archived ? (rows.length === 1 ? '{n} archived patient' : '{n} archived patients') : (rows.length === 1 ? '{n} active patient' : '{n} active patients'), { n: rows.length })}${activeFilterCount ? ` ${t('matching filters')}` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportPatientsCsv(rows.map((r) => r.p), doctorName, program)} disabled={!rows.length}>
              <Download size={16} /> {t('Export CSV')}
            </Button>
            <Button onClick={() => setForm({ open: true, patient: null, program })}>
              <Plus size={16} /> {t('Add patient')}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {Object.entries(PROGRAMS).map(([key, prog]) => (
          <button
            key={key}
            role="tab"
            aria-selected={program === key}
            onClick={() => switchProgram(key)}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              program === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <span className="sm:hidden">{prog.short}</span><span className="hidden sm:inline">{prog.label}</span>
            <span className={cx('rounded-full px-2 py-0.5 text-xs tabular-nums', program === key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>
              {programCounts[key]}
            </span>
          </button>
        ))}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder={t('Search by patient, phone or doctor…')} value={f.q} onChange={(e) => setParam('q', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select className="min-w-0 flex-1 md:w-64 md:flex-none" value={sort} onChange={(e) => setParam('sort', e.target.value === 'recent' ? '' : e.target.value)} aria-label={t('Sort by')}>
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{t(s.label)}</option>)}
            </Select>
            {/* Phones show cards, so the date-columns switch only appears on wider screens. */}
            <div className="hidden md:block">
              <Button
                variant={showDates ? 'primary' : 'secondary'}
                onClick={() => setParam('view', showDates ? '' : 'dates')}
                aria-pressed={showDates}
                title={t("Show every step's date in its own column")}
              >
                <CalendarDays size={16} /> {showDates ? t('Hide dates') : t('Show dates')}
              </Button>
            </div>
            <Button variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((s) => !s)}>
              <SlidersHorizontal size={16} /> {t('Filters')}
              {activeFilterCount > 0 && (
                <span className={cx('rounded-full px-1.5 text-xs', showFilters ? 'bg-white/20' : 'bg-brand-100 text-brand-800')}>{activeFilterCount}</span>
              )}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Doctor">
              <Select value={f.doctor} onChange={(e) => setParam('doctor', e.target.value)}>
                <option value="">{t('All doctors')}</option>
                <option value="none">{t('Unassigned')}</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={f.status} onChange={(e) => setParam('status', e.target.value)}>
                <option value="">{t('Any status')}</option>
                {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Next step">
              <Select value={f.stage} onChange={(e) => setParam('stage', e.target.value)}>
                <option value="">{t('Any step')}</option>
                {TREATMENT_STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Waiting">
              <Select value={f.waiting} onChange={(e) => setParam('waiting', e.target.value)}>
                <option value="">{t('Any time')}</option>
                <option value={WAITING_DAYS.warn}>{t('{n}+ days since last step', { n: WAITING_DAYS.warn })}</option>
                <option value={WAITING_DAYS.alert}>{t('{n}+ days since last step', { n: WAITING_DAYS.alert })}</option>
              </Select>
            </FilterField>
            <FilterField label="Date of">
              <Select value={f.dateField} onChange={(e) => setParam('dateField', e.target.value)}>
                <option value="">{t('Last activity')}</option>
                {TREATMENT_STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="From">
              <Input type="date" value={f.from} onChange={(e) => setParam('from', e.target.value)} />
            </FilterField>
            <FilterField label="To">
              <Input type="date" value={f.to} onChange={(e) => setParam('to', e.target.value)} />
            </FilterField>
            <FilterField label="Show">
              <Select value={f.archived} onChange={(e) => setParam('archived', e.target.value)}>
                <option value="">{t('Active patients')}</option>
                <option value="1">{t('Archived patients')}</option>
              </Select>
            </FilterField>
            {activeFilterCount > 0 && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}><X size={14} /> {t('Clear all filters')}</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Phones: one card per patient (wide tables don't fit). */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <Card>{<EmptyState icon={Users} title={t('No patients found')}>
                {activeFilterCount || f.q ? t('Try adjusting your search or filters.') : t('Add your first patient to get started.')}
              </EmptyState>}</Card>
        ) : (
          rows.map(({ p, pr, wait }) => (
            <Card key={p.id} className="cursor-pointer p-4" onClick={() => setDrawerId(p.id)}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.doctorId ? shortDoctor(doctorName(p.doctorId)) : t('No doctor assigned')}
                    {p.notes?.length > 0 && <span className="ml-2 inline-flex items-center gap-0.5"><MessageSquare size={11} />{p.notes.length}</span>}
                  </p>
                </div>
                {wait != null && <WaitingBadge days={wait} />}
                <div onClick={(e) => e.stopPropagation()}><RowMenu items={menuItems(p)} /></div>
              </div>
              <div className="mt-3">
                <ProgressStrip patient={p} progress={pr} size="lg" onStep={(stepId) => setStepTarget({ patient: p, stepId })} />
                <ProgressSummary progress={pr} />
              </div>
              {pr.nextStep && (
                <Button className="mt-3 w-full" variant="secondary" onClick={(e) => { e.stopPropagation(); recordNext(p, pr); }}>
                  <CalendarPlus size={16} /> {t('Record {step}', { step: pr.nextStep.label })}
                </Button>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Tablets and computers: table. Compact by default; "Show dates" adds a column per step. */}
      <Card className="hidden overflow-hidden md:block">
        <div className="max-h-[calc(100vh-17rem)] min-h-[300px] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Th className="sticky left-0 z-30 min-w-[200px] bg-slate-50"><SortHead label={t('Patient')} active={sort === 'name'} onClick={() => sortBy('name')} /></Th>
                <Th className="min-w-[150px]">{t('Doctor')}</Th>
                <Th className={showDates ? 'min-w-[150px]' : 'min-w-[280px] w-full'}><SortHead label={t('Progress')} active={sort === 'progress'} onClick={() => sortBy('progress')} /></Th>
                <Th className="min-w-[96px]"><SortHead label={t('Waiting')} active={sort === 'waiting'} onClick={() => sortBy('waiting')} /></Th>
                {showDates
                  ? TREATMENT_STEPS.map((s) => <Th key={s.id} className="min-w-[112px] text-center">{s.label}</Th>)
                  : <Th className="hidden min-w-[190px] xl:table-cell"><span className="sr-only">{t('Next step')}</span></Th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showDates ? TREATMENT_STEPS.length + 4 : 5}>
                    <EmptyState icon={Users} title={t('No patients found')}>
                {activeFilterCount || f.q ? t('Try adjusting your search or filters.') : t('Add your first patient to get started.')}
              </EmptyState>
                  </td>
                </tr>
              ) : (
                rows.map(({ p, pr, wait }) => (
                  <tr key={p.id} className="group cursor-pointer" onClick={() => setDrawerId(p.id)}>
                    <Td className="sticky left-0 z-10 bg-white shadow-[1px_0_0_0_#e2e8f0] group-hover:bg-slate-50">
                      <div className="flex items-start gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setDrawerId(p.id); }} className="min-w-0 flex-1 text-left">
                          <span className="block font-medium text-slate-900 group-hover:text-brand-700">{p.name}</span>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            {p.phone || '—'}
                            {p.notes?.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-slate-400" title={t('{n} note(s)', { n: p.notes.length })}>
                                <MessageSquare size={11} />{p.notes.length}
                              </span>
                            )}
                          </span>
                        </button>
                        <div onClick={(e) => e.stopPropagation()}><RowMenu items={menuItems(p)} /></div>
                      </div>
                    </Td>
                    <Td className="text-slate-600" title={doctorName(p.doctorId)}>
                      <span className="line-clamp-2">{p.doctorId ? shortDoctor(doctorName(p.doctorId)) : <span className="text-slate-400">{t('Unassigned')}</span>}</span>
                    </Td>
                    <Td>
                      {showDates ? (
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={pr.status} />
                          <ProgressBar percent={pr.percent} />
                        </div>
                      ) : (
                        <>
                          <ProgressStrip patient={p} progress={pr} onStep={(stepId) => setStepTarget({ patient: p, stepId })} />
                          <ProgressSummary progress={pr} />
                          {/* Narrower screens: the Record button lives here instead of its own column. */}
                          {pr.nextStep && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); recordNext(p, pr); }}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand-700 hover:underline xl:hidden"
                            >
                              <CalendarPlus size={13} /> {t('Record {step}', { step: pr.nextStep.label })}
                            </button>
                          )}
                        </>
                      )}
                    </Td>
                    <Td><WaitingBadge days={wait} /></Td>
                    {showDates ? (
                      TREATMENT_STEPS.map((s) => {
                        const st = p.steps?.[s.id];
                        const isNext = pr.nextStep?.id === s.id;
                        const skipped = !pr.inPlan(s.id) && !st?.date;
                        return (
                          <Td key={s.id} className="p-1 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); setStepTarget({ patient: p, stepId: s.id }); }}
                              title={skipped ? t('Not needed — treatment ends at {step}', { step: pr.finalStep.label }) : st?.note ? `${t('Note')}: ${st.note}` : st?.date ? t('Edit date / note') : t('Set date')}
                              className={cx(
                                'relative w-full rounded-md px-2 py-1.5 text-xs tabular-nums transition-colors',
                                st?.date
                                  ? 'bg-brand-50 font-medium text-brand-800 hover:bg-brand-100'
                                  : skipped
                                    ? 'bg-slate-50 text-slate-300 hover:text-slate-500'
                                    : isNext
                                      ? 'border border-orange-400 bg-orange-50 font-medium text-orange-700 hover:bg-orange-100'
                                      : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                              )}
                            >
                              {st?.date ? fmtDate(st.date) : skipped ? t('n/a') : isNext ? t('Next') : '+'}
                              {st?.note && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                            </button>
                          </Td>
                        );
                      })
                    ) : (
                      <Td className="hidden text-right xl:table-cell">
                        {pr.nextStep ? (
                          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={(e) => { e.stopPropagation(); recordNext(p, pr); }}>
                            <CalendarPlus size={14} /> {t('Record {step}', { step: pr.nextStep.label })}
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-brand-700">{t('Done')}</span>
                        )}
                      </Td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{t('Tap a patient to see their timeline and notes. Tap a step in the bar to set its date or add a note.')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-brand-600" /> {t('done')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-orange-500 outline outline-2 outline-offset-2 outline-orange-400" /> {t('next')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full border border-dashed border-slate-300" /> {t('not needed')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {t('has note')}</span>
        <span>{t('Waiting turns amber after {warn} days and red after {alert}.', { warn: WAITING_DAYS.warn, alert: WAITING_DAYS.alert })}</span>
      </p>

      <StepModal target={stepTarget} onClose={() => setStepTarget(null)} />
      <PatientFormModal open={form.open} patient={form.patient} program={form.program || program} onClose={() => setForm({ open: false, patient: null })} />
      <PatientDrawer
        patientId={drawerId}
        onClose={() => setDrawerId(null)}
        onEditStep={(patient, stepId) => setStepTarget({ patient, stepId })}
        onEditPatient={(patient) => setForm({ open: true, patient })}
      />
    </>
  );
}

const Th = ({ className, ...props }) => (
  <th className={cx('sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-3', className)} {...props} />
);
const Td = ({ className, ...props }) => (
  <td className={cx('border-b border-slate-100 px-3 py-2.5 group-hover:bg-slate-50', className)} {...props} />
);

function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{t(label)}</span>
      {children}
    </label>
  );
}

// Column heading that sorts the table; an arrow marks the active sort.
function SortHead({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cx('inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800', active && 'text-brand-700')}>
      {label}
      <ChevronDown size={12} className={active ? 'opacity-100' : 'opacity-0'} />
    </button>
  );
}
