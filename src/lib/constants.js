import { t } from './i18n-core.js';

// Labels are getters so they're looked up in the current language each time they're shown.
export const TREATMENT_STEPS = [
  { id: 'consultation', get label() { return t('Consultation'); } },
  { id: 'anatomic', get label() { return t('Anatomic Impression'); } },
  { id: 'vertical', get label() { return t('Vertical Dim.'); } },
  { id: 'material', get label() { return t('Material'); } },
  { id: 'implant', get label() { return t('Implant'); } },
  { id: 'control1', get label() { return t('Control 1'); } },
  { id: 'control2', get label() { return t('Control 2'); } },
  { id: 'control3', get label() { return t('Control 3'); } },
  { id: 'healing', get label() { return t('Healing Abutment'); } },
  { id: 'crown_imp', get label() { return t('Crown Impression'); } },
  { id: 'crown_place', get label() { return t('Crown Placement'); } },
];

// Denture steps. Staff pick the next step from this list (the program is `flexible`), so the order
// here is only the usual order used for suggestions. Ids anatomic/vertical/sent_lab/placement are kept
// from the earlier 5-step list so existing dates still show.
export const INTERNAL_STEPS = [
  { id: 'consultation', get label() { return t('Consultation'); } },
  { id: 'anatomic', get label() { return t('Anatomic Impression'); } },
  { id: 'physio', get label() { return t('Physiological Impression'); } },
  { id: 'vertical', get label() { return t('Bite (Vertical Dim.)'); } },
  { id: 'tryin', get label() { return t('Try-in'); } },
  { id: 'sent_lab', get label() { return t('Sent to Lab'); } },
  { id: 'placement', get label() { return t('Insertion'); } },
  { id: 'control1', get label() { return t('Control 1'); } },
  { id: 'control2', get label() { return t('Control 2'); } },
];

// Each patient belongs to one program; the program decides which steps are tracked.
export const PROGRAMS = {
  // Order here is the order of the tabs.
  internal: { get label() { return t('Internal Patients'); }, get short() { return t('Internal'); }, steps: INTERNAL_STEPS, flexible: true },
  tanam: { get label() { return t("Tanam's Patients"); }, get short() { return t('Tanam'); }, steps: TREATMENT_STEPS },
};

// The tab that opens when no program is chosen (in the address, ?program=…).
export const DEFAULT_PROGRAM = 'internal';

// Patients saved before programs existed have no `program` field and are Tanam patients.
export const programOf = (patient) => (PROGRAMS[patient?.program] ? patient.program : 'tanam');
export const stepsFor = (patient) => PROGRAMS[programOf(patient)].steps;
// Flexible programs show only the steps done plus the chosen next one, instead of a fixed row of steps.
export const isFlexible = (patient) => !!PROGRAMS[programOf(patient)].flexible;

export const STATUS = {
  not_started: { get label() { return t('Not started'); }, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  in_progress: { get label() { return t('In progress'); }, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  completed: { get label() { return t('Completed'); }, className: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

export const ROLES = {
  admin: { get label() { return t('Admin'); }, get description() { return t('Full access: doctors, users, delete patients'); } },
  staff: { get label() { return t('Staff'); }, get description() { return t('Track progress, add patients and notes'); } },
};

// Days since a patient's last step before the tracker flags them as waiting (amber) or overdue (red).
export const WAITING_DAYS = { warn: 30, alert: 60 };
