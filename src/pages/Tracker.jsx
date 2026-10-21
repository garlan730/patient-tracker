import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Archive, ArchiveRestore, Trash2, Pencil, MessageSquare, SlidersHorizontal, X, Users } from 'lucide-react';
import { PROGRAMS, STATUS, programOf } from '../lib/constants.js';
import { getProgress } from '../lib/patients.js';
import { fmtDate, toDate } from '../lib/dates.js';
import { exportPatientsCsv } from '../lib/csv.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { Button, Card, EmptyState, Input, PageHeader, ProgressBar, Select, StatusBadge, cx, useConfirm } from '../components/ui.jsx';
import StepModal from '../components/StepModal.jsx';
import PatientFormModal from '../components/PatientFormModal.jsx';
import PatientDrawer from '../components/PatientDrawer.jsx';

const SORTS = {
  recent: { label: 'Last activity (newest)', fn: (a, b) => (b.pr.lastActivity || '').localeCompare(a.pr.lastActivity || '') },
  oldest: { label: 'Last activity (oldest)', fn: (a, b) => (a.pr.lastActivity || '9').localeCompare(b.pr.lastActivity || '9') },
  name: { label: 'Name (A–Z)', fn: (a, b) => a.p.name.localeCompare(b.p.name) },
  progress: { label: 'Progress (most)', fn: (a, b) => b.pr.percent - a.pr.percent },
  created: { label: 'Recently added', fn: (a, b) => b.p.createdAt.localeCompare(a.p.createdAt) },
};

const FILTER_KEYS = ['q', 'doctor', 'status', 'stage', 'dateField', 'from', 'to', 'archived'];

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
      .map((p) => ({ p, pr: getProgress(p) }))
      .filter(({ p, pr }) => {
        if (programOf(p) !== program) return false;
        if (!!p.archived !== (f.archived === '1')) return false;
        if (q && ![p.name, p.phone, doctorName(p.doctorId)].some((v) => v?.toLowerCase().includes(q))) return false;
        if (f.doctor && p.doctorId !== f.doctor) return false;
        if (f.status && pr.status !== f.status) return false;
        if (f.stage && pr.nextStep?.id !== f.stage) return false;
        if (from || to) {
          const iso = !f.dateField || f.dateField === 'activity' ? pr.lastActivity : p.steps?.[f.dateField]?.date;
          const d = toDate(iso);
          if (!d || (from && d < from) || (to && d > to)) return false;
        }
        return true;
      })
      .sort(SORTS[sort]?.fn || SORTS.recent.fn);
  }, [patients, doctorName, f.q, f.doctor, f.status, f.stage, f.dateField, f.from, f.to, f.archived, sort, program]);

  const toggleArchive = (p) => updatePatient(p.id, { archived: !p.archived });
  const handleDelete = async (p) => {
    const ok = await confirm({
      title: 'Delete patient?',
      message: `${p.name} and all of their treatment dates and notes will be permanently deleted. Consider archiving instead.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deletePatient(p.id);
  };

  return (
    <>
      <PageHeader
        title="Patient Tracker"
        description={`${PROGRAMS[program].label} · ${rows.length} ${f.archived ? 'archived' : 'active'} patient${rows.length === 1 ? '' : 's'}${activeFilterCount ? ' matching filters' : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportPatientsCsv(rows.map((r) => r.p), doctorName, program)} disabled={!rows.length}>
              <Download size={16} /> Export CSV
            </Button>
            <Button onClick={() => setForm({ open: true, patient: null, program })}>
              <Plus size={16} /> Add patient
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
            {prog.label}
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
            <Input className="pl-9" placeholder="Search by patient, phone or doctor…" value={f.q} onChange={(e) => setParam('q', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Select className="md:w-56" value={sort} onChange={(e) => setParam('sort', e.target.value === 'recent' ? '' : e.target.value)} aria-label="Sort by">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </Select>
            <Button variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((s) => !s)}>
              <SlidersHorizontal size={16} /> Filters
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
                <option value="">All doctors</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Status">
              <Select value={f.status} onChange={(e) => setParam('status', e.target.value)}>
                <option value="">Any status</option>
                {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Next step">
              <Select value={f.stage} onChange={(e) => setParam('stage', e.target.value)}>
                <option value="">Any step</option>
                {TREATMENT_STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Date of">
              <Select value={f.dateField} onChange={(e) => setParam('dateField', e.target.value)}>
                <option value="">Last activity</option>
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
                <option value="">Active patients</option>
                <option value="1">Archived patients</option>
              </Select>
            </FilterField>
            {activeFilterCount > 0 && (
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}><X size={14} /> Clear all filters</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-17rem)] min-h-[300px] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Th className="sticky left-0 z-30 min-w-[220px] bg-slate-50">Patient</Th>
                <Th className="min-w-[200px]">Doctor</Th>
                <Th className="min-w-[150px]">Progress</Th>
                {TREATMENT_STEPS.map((s) => (
                  <Th key={s.id} className="min-w-[120px] text-center">{s.label}</Th>
                ))}
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={TREATMENT_STEPS.length + 4}>
                    <EmptyState icon={Users} title="No patients found">
                      {activeFilterCount || f.q ? 'Try adjusting your search or filters.' : 'Add your first patient to get started.'}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                rows.map(({ p, pr }) => (
                  <tr key={p.id} className="group">
                    <Td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                      <button onClick={() => setDrawerId(p.id)} className="text-left">
                        <span className="block font-medium text-slate-900 hover:text-brand-700 hover:underline">{p.name}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {p.phone || '—'}
                          {p.notes?.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-slate-400" title={`${p.notes.length} note(s)`}>
                              <MessageSquare size={11} />{p.notes.length}
                            </span>
                          )}
                        </span>
                      </button>
                    </Td>
                    <Td className="max-w-[220px] truncate text-slate-600" title={doctorName(p.doctorId)}>{doctorName(p.doctorId)}</Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={pr.status} />
                        <ProgressBar percent={pr.percent} />
                      </div>
                    </Td>
                    {TREATMENT_STEPS.map((s) => {
                      const st = p.steps?.[s.id];
                      const isNext = pr.nextStep?.id === s.id;
                      return (
                        <Td key={s.id} className="p-1 text-center">
                          <button
                            onClick={() => setStepTarget({ patient: p, stepId: s.id })}
                            title={st?.note ? `Note: ${st.note}` : st?.date ? 'Edit date / note' : 'Set date'}
                            className={cx(
                              'relative w-full rounded-md px-2 py-1.5 text-xs tabular-nums transition-colors',
                              st?.date
                                ? 'bg-brand-50 font-medium text-brand-800 hover:bg-brand-100'
                                : isNext
                                  ? 'border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50'
                                  : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                            )}
                          >
                            {st?.date ? fmtDate(st.date) : isNext ? 'Next' : '+'}
                            {st?.note && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                          </button>
                        </Td>
                      );
                    })}
                    <Td className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-0.5">
                        <IconBtn label="Edit patient" onClick={() => setForm({ open: true, patient: p })}><Pencil size={15} /></IconBtn>
                        <IconBtn label={p.archived ? 'Restore' : 'Archive'} onClick={() => toggleArchive(p)}>
                          {p.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                        </IconBtn>
                        {isAdmin && (
                          <IconBtn label="Delete" danger onClick={() => handleDelete(p)}><Trash2 size={15} /></IconBtn>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-slate-500">
        Click a date cell to set the date or add a step note. Click a patient's name to see their timeline and notes.
        <span className="ml-2 inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> has note</span>
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
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({ label, danger, ...props }) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cx('rounded-md p-1.5 text-slate-400 transition-colors', danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-slate-700')}
      {...props}
    />
  );
}
