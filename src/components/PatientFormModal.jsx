import { useEffect, useState } from 'react';
import { PROGRAMS, programOf } from '../lib/constants.js';
import { useData } from '../lib/data.jsx';
import { Button, Field, Input, Modal, Select } from './ui.jsx';

// Add (patient = null) or edit an existing patient's details.
export default function PatientFormModal({ open, patient, program = 'tanam', onClose }) {
  const { doctors, addPatient, updatePatient } = useData();
  const [form, setForm] = useState({ program, name: '', phone: '', doctorId: '', firstDate: '', endStep: '' });

  useEffect(() => {
    if (!open) return;
    setForm(
      patient
        ? { program: programOf(patient), name: patient.name, phone: patient.phone || '', doctorId: patient.doctorId, firstDate: '', endStep: patient.endStep || '' }
        : { program, name: '', phone: '', doctorId: '', firstDate: '', endStep: '' }
    );
  }, [open, patient, program]);

  // Step ids differ between programs, so switching program resets the end step.
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'program' ? { endStep: '' } : {}) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.doctorId) return;
    if (patient) updatePatient(patient.id, { name: form.name.trim(), phone: form.phone.trim(), doctorId: form.doctorId, endStep: form.endStep || null });
    else addPatient(form);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? 'Edit patient' : 'Add new patient'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="patient-form">{patient ? 'Save changes' : 'Add patient'}</Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={handleSubmit} className="space-y-4">
        {!patient && (
          <Field label="Patient type">
            <Select value={form.program} onChange={set('program')}>
              {Object.entries(PROGRAMS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Patient name">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Sinta Rahayu" required autoFocus />
        </Field>
        <Field label="Phone" hint="Optional">
          <Input type="tel" value={form.phone} onChange={set('phone')} placeholder="0812-…" />
        </Field>
        <Field label="Assigned doctor">
          <Select value={form.doctorId} onChange={set('doctorId')} required>
            <option value="">Select a doctor…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Treatment ends at" hint="Pick an earlier step if this patient doesn't need the full treatment.">
          <Select value={form.endStep} onChange={set('endStep')}>
            {PROGRAMS[form.program].steps.map((s, i, all) => (
              <option key={s.id} value={i === all.length - 1 ? '' : s.id}>
                {s.label}{i === all.length - 1 ? ' (full treatment)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        {!patient && (
          <Field label={`${PROGRAMS[form.program].steps[0].label} date`} hint="Optional — you can set it later from the tracker.">
            <Input type="date" value={form.firstDate} onChange={set('firstDate')} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
