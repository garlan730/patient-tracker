import { stepsFor } from './constants.js';
import { toDate } from './dates.js';

// Derived, read-only view of a patient's progress through their program's steps.
export function getProgress(patient) {
  const TREATMENT_STEPS = stepsFor(patient);
  const steps = patient.steps || {};
  const done = TREATMENT_STEPS.filter((s) => steps[s.id]?.date);
  const lastIndex = TREATMENT_STEPS.reduce((acc, s, i) => (steps[s.id]?.date ? i : acc), -1);
  const lastStep = lastIndex >= 0 ? TREATMENT_STEPS[lastIndex] : null;
  const nextStep = TREATMENT_STEPS.find((s) => !steps[s.id]?.date) || null;
  const lastActivity = done
    .map((s) => steps[s.id].date)
    .sort()
    .at(-1) || null;

  let status = 'in_progress';
  if (done.length === 0) status = 'not_started';
  else if (steps[TREATMENT_STEPS.at(-1).id]?.date) status = 'completed';

  return {
    completed: done.length,
    total: TREATMENT_STEPS.length,
    percent: Math.round((done.length / TREATMENT_STEPS.length) * 100),
    lastStep,
    nextStep: status === 'completed' ? null : nextStep,
    lastActivity,
    status,
  };
}

// Returns the label of an earlier step whose date is after `date`, if any (sanity check for data entry).
export function findOutOfOrder(patient, stepId, date) {
  const TREATMENT_STEPS = stepsFor(patient);
  const d = toDate(date);
  if (!d) return null;
  const idx = TREATMENT_STEPS.findIndex((s) => s.id === stepId);
  for (let i = 0; i < idx; i++) {
    const prev = toDate(patient.steps?.[TREATMENT_STEPS[i].id]?.date);
    if (prev && prev > d) return TREATMENT_STEPS[i].label;
  }
  for (let i = idx + 1; i < TREATMENT_STEPS.length; i++) {
    const next = toDate(patient.steps?.[TREATMENT_STEPS[i].id]?.date);
    if (next && next < d) return TREATMENT_STEPS[i].label;
  }
  return null;
}
