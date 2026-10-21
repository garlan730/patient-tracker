import { useEffect, useState } from 'react';
import { X, CheckCircle2, Circle, Trash2, MessageSquare, Phone, Stethoscope, Pencil } from 'lucide-react';
import { PROGRAMS, programOf, stepsFor } from '../lib/constants.js';
import { getProgress } from '../lib/patients.js';
import { fmtDate, fmtDateTime } from '../lib/dates.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { Button, ProgressBar, StatusBadge, Textarea, cx, useConfirm } from './ui.jsx';

// Side panel with a patient's step timeline and the timestamped note log.
export default function PatientDrawer({ patientId, onClose, onEditStep, onEditPatient }) {
  const { patients, doctorName, addNote, deleteNote } = useData();
  const { user, isAdmin } = useAuth();
  const confirm = useConfirm();
  const [text, setText] = useState('');
  const patient = patients.find((p) => p.id === patientId);

  useEffect(() => setText(''), [patientId]);
  useEffect(() => {
    if (!patientId) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [patientId, onClose]);

  if (!patient) return null;
  const pr = getProgress(patient);

  const submitNote = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addNote(patient.id, text);
    setText('');
  };

  const removeNote = async (n) => {
    if (await confirm({ title: 'Delete note?', message: 'This note will be permanently removed.', confirmLabel: 'Delete', danger: true })) {
      deleteNote(patient.id, n.id);
    }
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{patient.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{PROGRAMS[programOf(patient)].short}</span>
              <span className="flex items-center gap-1"><Stethoscope size={12} />{doctorName(patient.doctorId)}</span>
              {patient.phone && <span className="flex items-center gap-1"><Phone size={12} />{patient.phone}</span>}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge status={pr.status} />
              <ProgressBar percent={pr.percent} />
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEditPatient(patient)} aria-label="Edit patient"><Pencil size={16} /></Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={18} /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="px-5 py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Treatment timeline{pr.endsEarly && <span className="ml-1 font-normal normal-case tracking-normal">· ends at {pr.finalStep.label}</span>}
            </h3>
            <ol className="space-y-1">
              {stepsFor(patient).map((s) => {
                const st = patient.steps?.[s.id];
                const skipped = !pr.inPlan(s.id) && !st?.date;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => onEditStep(patient, s.id)}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                    >
                      {st?.date ? (
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-600" />
                      ) : (
                        <Circle size={18} className={cx('mt-0.5 shrink-0', pr.nextStep?.id === s.id ? 'text-amber-500' : 'text-slate-300')} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={cx('text-sm', st?.date ? 'font-medium text-slate-800' : skipped ? 'text-slate-300 line-through' : 'text-slate-500')}>{s.label}</span>
                          <span className="text-xs tabular-nums text-slate-500">
                            {st?.date ? fmtDate(st.date) : skipped ? 'Not needed' : pr.nextStep?.id === s.id ? 'Next' : ''}
                          </span>
                        </div>
                        {st?.note && <p className="mt-0.5 text-xs text-slate-500 whitespace-pre-line">{st.note}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="border-t border-slate-200 px-5 py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h3>
            <form onSubmit={submitNote} className="mb-4">
              <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note about this patient…" />
              <div className="mt-2 flex justify-end">
                <Button type="submit" size="sm" disabled={!text.trim()}>Add note</Button>
              </div>
            </form>
            {(patient.notes || []).length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-400"><MessageSquare size={14} />No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {patient.notes.map((n) => (
                  <li key={n.id} className="group rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700">
                        {n.authorName} <span className="font-normal text-slate-400">· {fmtDateTime(n.createdAt)}</span>
                      </p>
                      {(isAdmin || n.authorId === user.id) && (
                        <button onClick={() => removeNote(n)} className="text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600" aria-label="Delete note">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
