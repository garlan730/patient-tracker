import { isFlexible, stepsFor } from './constants.js';
import { toDate } from './dates.js';

// The steps this patient actually needs: their program's steps up to `endStep`
// (a patient can finish early, e.g. after Implant), or the whole program if none is set.
export function planFor(patient) {
  const all = stepsFor(patient);
  const end = all.findIndex((s) => s.id === patient.endStep);
  return end >= 0 ? all.slice(0, end + 1) : all;
}

// Every recorded step as a visit { id, stepId, step, date, note, … }, oldest first.
// Flexible programs (Internal) keep `patient.visits`, where a step can repeat. Fixed programs, and
// Internal patients recorded before visits existed, use the one-date-per-step `patient.steps` map.
export function visitsOf(patient) {
  const byId = Object.fromEntries(stepsFor(patient).map((s) => [s.id, s]));
  const list = isFlexible(patient) && Array.isArray(patient.visits)
    ? patient.visits
    : Object.entries(patient.steps || {}).filter(([, v]) => v?.date).map(([stepId, v]) => ({ id: `v-${stepId}`, stepId, ...v }));
  return list
    .filter((v) => byId[v.stepId] && v.date)
    .map((v) => ({ ...v, step: byId[v.stepId] }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || '').localeCompare(b.updatedAt || ''));
}

// Visit log for a flexible program: any step can come next (including one already done).
function flexibleProgress(patient) {
  const plan = planFor(patient);
  const visits = visitsOf(patient);
  const last = visits.at(-1) || null;
  const finalStep = plan.at(-1);
  let status = visits.length ? 'in_progress' : 'not_started';
  if (visits.some((v) => v.stepId === finalStep.id)) status = 'completed';
  const manualNext = plan.find((s) => s.id === patient.nextStepId);
  const nextStep = status === 'completed' ? null : manualNext || suggestNextAfter(patient, last?.stepId);
  const distinct = new Set(visits.map((v) => v.stepId)).size;
  return {
    completed: visits.length,
    total: plan.length,
    percent: Math.min(100, Math.round((distinct / plan.length) * 100)),
    lastStep: last?.step || null,
    nextStep,
    nextIsManual: !!manualNext && status !== 'completed',
    flexible: true,
    visits,
    remaining: plan,
    lastActivity: last?.date || null,
    status,
    endsEarly: plan.length < stepsFor(patient).length,
    finalStep,
    inPlan: (stepId) => plan.some((s) => s.id === stepId),
  };
}

// Derived, read-only view of a patient's progress through their planned steps.
export function getProgress(patient) {
  if (isFlexible(patient)) return flexibleProgress(patient);
  const TREATMENT_STEPS = planFor(patient);
  const steps = patient.steps || {};
  const done = TREATMENT_STEPS.filter((s) => steps[s.id]?.date);
  const lastIndex = TREATMENT_STEPS.reduce((acc, s, i) => (steps[s.id]?.date ? i : acc), -1);
  const lastStep = lastIndex >= 0 ? TREATMENT_STEPS[lastIndex] : null;
  // Staff can pick the next step (patient.nextStepId). Otherwise suggest the first empty step after the
  // furthest one done, so a skipped earlier step doesn't stay "next" forever.
  const manualNext = TREATMENT_STEPS.find((s) => s.id === patient.nextStepId && !steps[s.id]?.date);
  const nextStep = manualNext || suggestNext(TREATMENT_STEPS, steps, lastIndex);
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
    nextIsManual: !!manualNext && status !== 'completed',
    flexible: false,
    visits: visitsOf(patient),
    // Steps that can be chosen as the next one: planned and not yet done.
    remaining: TREATMENT_STEPS.filter((s) => !steps[s.id]?.date),
    lastActivity,
    status,
    endsEarly: TREATMENT_STEPS.length < stepsFor(patient).length,
    finalStep: TREATMENT_STEPS.at(-1),
    inPlan: (stepId) => TREATMENT_STEPS.some((s) => s.id === stepId),
  };
}

function suggestNext(plan, steps, afterIndex) {
  const isEmpty = (s) => !steps[s.id]?.date;
  return plan.slice(afterIndex + 1).find(isEmpty) || plan.find(isEmpty) || null;
}

// Suggested next step once `stepId` is recorded (used to pre-fill the step editor).
export function suggestNextAfter(patient, stepId) {
  const plan = planFor(patient);
  // Visit log: the step after this one in the usual order (repeats allowed, so nothing is "used up").
  if (isFlexible(patient)) {
    if (!stepId) return plan[0] || null;
    const i = plan.findIndex((s) => s.id === stepId);
    return i >= 0 ? plan[i + 1] || null : plan[0] || null;
  }
  const steps = { ...(patient.steps || {}), [stepId]: { date: 'x' } };
  const furthest = plan.reduce((acc, s, i) => (steps[s.id]?.date ? i : acc), -1);
  return suggestNext(plan, steps, furthest);
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
