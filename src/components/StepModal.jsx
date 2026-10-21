import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { stepsFor } from '../lib/constants.js';
import { findOutOfOrder } from '../lib/patients.js';
import { fmtDateTime, todayISO } from '../lib/dates.js';
import { useData } from '../lib/data.jsx';
import { Button, Field, Input, Modal, Textarea, useConfirm } from './ui.jsx';

// Edit the date + note for a single treatment step. `target` = { patient, stepId } or null.
export default function StepModal({ target, onClose }) {
  const { setStep, clearStep, updatePatient } = useData();
  const confirm = useConfirm();
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [endsHere, setEndsHere] = useState(false);

  const current = target ? target.patient.steps?.[target.stepId] : null;
  const step = target && stepsFor(target.patient).find((s) => s.id === target.stepId);
  const isProgramEnd = target && stepsFor(target.patient).at(-1).id === target.stepId;

  useEffect(() => {
    if (!target) return;
    setDate(current?.date || todayISO());
    setNote(current?.note || '');
    setEndsHere(target.patient.endStep === target.stepId);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;
  const outOfOrder = findOutOfOrder(target.patient, target.stepId, date);

  const handleSave = (e) => {
    e.preventDefault();
    if (!date) return;
    setStep(target.patient.id, target.stepId, { date, note });
    const wasEnd = target.patient.endStep === target.stepId;
    if (endsHere !== wasEnd) updatePatient(target.patient.id, { endStep: endsHere ? target.stepId : null });
    onClose();
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Clear this step?',
      message: `Remove the ${step.label} date and note for ${target.patient.name}.`,
      confirmLabel: 'Clear',
      danger: true,
    });
    if (ok) {
      clearStep(target.patient.id, target.stepId);
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
            <Button variant="danger-ghost" className="mr-auto" onClick={handleClear}>Clear step</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="step-form" disabled={!date}>Save</Button>
        </>
      }
    >
      <form id="step-form" onSubmit={handleSave} className="space-y-4">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required autoFocus />
        </Field>
        {outOfOrder && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            This date is out of order with {outOfOrder}. Double-check before saving.
          </p>
        )}
        <Field label="Note" hint="Optional — e.g. shade used, complications, next appointment.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for this step…" />
        </Field>
        {!isProgramEnd && (
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 accent-brand-600" checked={endsHere} onChange={(e) => setEndsHere(e.target.checked)} />
            <span>
              Treatment ends at this step
              <span className="block text-xs text-slate-500">The patient is done after {step.label}; later steps aren't needed.</span>
            </span>
          </label>
        )}
        {current?.updatedBy && (
          <p className="text-xs text-slate-400">
            Last updated by {current.updatedBy} · {fmtDateTime(current.updatedAt)}
          </p>
        )}
      </form>
    </Modal>
  );
}
