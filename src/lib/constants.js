export const TREATMENT_STEPS = [
  { id: 'consultation', label: 'Consultation' },
  { id: 'anatomic', label: 'Anatomic Impression' },
  { id: 'vertical', label: 'Vertical Dim.' },
  { id: 'material', label: 'Material' },
  { id: 'implant', label: 'Implant' },
  { id: 'control1', label: 'Control 1' },
  { id: 'control2', label: 'Control 2' },
  { id: 'control3', label: 'Control 3' },
  { id: 'healing', label: 'Healing Abutment' },
  { id: 'crown_imp', label: 'Crown Impression' },
  { id: 'crown_place', label: 'Crown Placement' },
];

export const INTERNAL_STEPS = [
  { id: 'anatomic', label: 'Anatomic Impression' },
  { id: 'vertical', label: 'Vertical Dim.' },
  { id: 'sent_lab', label: 'Sent to Lab' },
  { id: 'arrived', label: 'Arrived at Clinic' },
  { id: 'placement', label: 'Placement' },
];

// Each patient belongs to one program; the program decides which steps are tracked.
export const PROGRAMS = {
  tanam: { label: "Tanam's Patients", short: 'Tanam', steps: TREATMENT_STEPS },
  internal: { label: 'Internal Patients', short: 'Internal', steps: INTERNAL_STEPS },
};

// Patients saved before programs existed have no `program` field and are Tanam patients.
export const programOf = (patient) => (PROGRAMS[patient?.program] ? patient.program : 'tanam');
export const stepsFor = (patient) => PROGRAMS[programOf(patient)].steps;

export const STATUS = {
  not_started: { label: 'Not started', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  in_progress: { label: 'In progress', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  completed: { label: 'Completed', className: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

export const ROLES = {
  admin: { label: 'Admin', description: 'Full access: doctors, users, delete patients' },
  staff: { label: 'Staff', description: 'Track progress, add patients and notes' },
};
