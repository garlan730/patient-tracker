import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isFlexible, stepsFor } from '../lib/constants.js';
import { findOutOfOrder, planFor, suggestNextAfter } from '../lib/patients.js';
import { fmtDate, fmtDateTime, todayISO } from '../lib/dates.js';
import { useData } from '../lib/data.jsx';
import { Button, Field, Input, Modal, Select, Textarea, useConfirm } from './ui.jsx';
import { t } from '../lib/i18n.jsx';

// Edit the date + note for a treatment step. `target` = { patient, stepId, visit? } or null.
// Visit-log patients (Internal) add a new visit, or edit `visit` when one is passed.
export default function StepModal({ target, onClose }) {
  const { setStep, clearStep, saveVisit, deleteVisit, updatePatient } = useData();
  const confirm = useConfirm();
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [endsHere, setEndsHere] = useState(false);
  const [nextId, setNextId] = useState('');

  const flexible = !!target && isFlexible(target.patient);
  const current = !target ? null : flexible ? target.visit || null : target.patient.steps?.[target.stepId];
  const step = target && stepsFor(target.patient).find((s) => s.id === target.stepId);
  const isProgramEnd = target && stepsFor(target.patient).at(-1).id === target.stepId;
  // Planned steps still open after recording this one.
  // (Visit log: every step can come next, including this one again.)
  const nextOptions = !target ? [] : flexible
    ? planFor(target.patient)
    : planFor(target.patient).filter((s) => s.id !== target.stepId && !target.patient.steps?.[s.id]?.date);
  const nextValue = nextOptions.some((s) => s.id === nextId) ? nextId : nextOptions[0]?.id || '';

  useEffect(() => {
    if (!target) return;
    setDate(current?.date || todayISO());
    setNote(current?.note || '');
    setEndsHere(target.patient.endStep === target.stepId);
    // Keep a next step staff already chose (if it's still open); otherwise suggest the one after this step.
    const p = target.patient;
    const chosen = flexible
      ? (target.visit ? p.nextStepId || '' : '')
      : p.nextStepId && p.nextStepId !== target.stepId && !p.steps?.[p.nextStepId]?.date ? p.nextStepId : '';
    setNextId(chosen || suggestNextAfter(p, target.stepId)?.id || '');
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;
  const outOfOrder = flexible ? null : findOutOfOrder(target.patient, target.stepId, date);

  const handleSave = (e) => {
    e.preventDefault();
    if (!date) return;
    if (flexible) saveVisit(target.patient, { id: current?.id, stepId: target.stepId, date, note });
    else setStep(target.patient.id, target.stepId, { date, note });
    const wasEnd = target.patient.endStep === target.stepId;
    const changes = {};
    if (endsHere !== wasEnd) changes.endStep = endsHere ? target.stepId : null;
    if (!endsHere && nextValue !== (target.patient.nextStepId || '')) changes.nextStepId = nextValue || null;
    if (Object.keys(changes).length) updatePatient(target.patient.id, changes);
    onClose();
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: flexible ? t('Delete this visit?') : t('Clear this step?'),
      message: flexible
        ? t('Remove the {step} visit on {date} for {name}.', { step: step.label, date: fmtDate(current.date), name: target.patient.name })
        : t('Remove the {step} date and note for {name}.', { step: step.label, name: target.patient.name }),
      confirmLabel: t('Clear'),
      danger: true,
    });
    if (ok) {
      if (flexible) deleteVisit(target.patient, current.id);
      else clearStep(target.patient.id, target.stepId);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${step.label} · ${target.patient.name}`}
      footer={
        <>
          {current?.date && (
            <Button variant="danger-ghost" className="mr-auto" onClick={handleClear}>{flexible ? t('Delete visit') : t('Clear step')}</Button>
          )}
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" form="step-form" disabled={!date}>{t('Save')}</Button>
        </>
      }
    >
      <form id="step-form" onSubmit={handleSave} className="space-y-4">
        <Field label={t('Date')}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required autoFocus />
        </Field>
        {outOfOrder && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {t('This date is out of order with {step}. Double-check before saving.', { step: outOfOrder })}
          </p>
        )}
        <Field label={t('Note')} hint={t('Optional — e.g. shade used, complications, next appointment.')}>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Add a note for this step…')} />
        </Field>
        {!isProgramEnd && (
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 accent-brand-600" checked={endsHere} onChange={(e) => setEndsHere(e.target.checked)} />
            <span>
              {t('Treatment ends at this step')}
              <span className="block text-xs text-slate-500">{t("The patient is done after {step}; later steps aren't needed.", { step: step.label })}</span>
            </span>
          </label>
        )}
        {!endsHere && nextOptions.length > 0 && (
          <Field label={t('Next step')} hint={t('Pick what the patient comes back for next.')}>
            <Select value={nextValue} onChange={(e) => setNextId(e.target.value)}>
              {nextOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        )}
        {current?.updatedBy && (
          <p className="text-xs text-slate-400">
            {t('Last updated by {name}', { name: current.updatedBy })} · {fmtDateTime(current.updatedAt)}
          </p>
        )}
      </form>
    </Modal>
  );
}
