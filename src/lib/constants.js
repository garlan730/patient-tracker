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

// Demo accounts created the first time the app runs (passwords are hashed before storage).
export const SEED_USERS = [
  { id: 'u-admin', username: 'admin', name: 'Administrator', role: 'admin', password: 'admin123' },
  { id: 'u-staff', username: 'staff', name: 'Front Desk Staff', role: 'staff', password: 'staff123' },
];

export const SEED_DOCTORS = [
  { id: 'd1', name: 'drg. Laras Pertiwi, Sp.Pros' },
  { id: 'd2', name: 'drg. Bima Santoso, Sp.Pros' },
  { id: 'd3', name: 'drg. Citra Maharani, Sp.Pros' },
  { id: 'd4', name: 'drg. Dimas Aryanto, Sp.BMM' },
  { id: 'd5', name: 'drg. Eka Puspita, Sp.Perio' },
];

const steps = (dates, list = TREATMENT_STEPS) =>
  Object.fromEntries(
    dates.map((date, i) => [list[i].id, { date, note: '' }])
  );

export const SEED_PATIENTS = [
  { id: 'p1', name: 'Arif Nugroho', phone: '', doctorId: 'd1', createdAt: '2023-10-12T08:00:00.000Z', archived: false, notes: [], steps: steps(['2023-10-12', '2023-10-15']) },
  { id: 'p2', name: 'Galih Saputra', phone: '', doctorId: 'd2', createdAt: '2023-11-01T08:00:00.000Z', archived: false, notes: [], steps: steps(['2023-11-01', '2023-11-05']) },
  { id: 'p3', name: 'Hana Wulandari', phone: '', doctorId: 'd3', createdAt: '2023-11-10T08:00:00.000Z', archived: false, notes: [], steps: steps(['2023-11-10', '2023-11-12']) },
  { id: 'p4', name: 'Indah Permata', phone: '0800-0000-0001', doctorId: 'd1', createdAt: '2026-04-02T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-04-02', '2026-04-09', '2026-04-20', '2026-05-04', '2026-05-18', '2026-06-15', '2026-07-13', '2026-08-10', '2026-09-07', '2026-09-28', '2026-10-12']) },
  { id: 'p5', name: 'Joko Prasetyo', phone: '0800-0000-0002', doctorId: 'd4', createdAt: '2026-06-10T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-06-10', '2026-06-17', '2026-06-30', '2026-07-14', '2026-07-28', '2026-08-25', '2026-09-22']) },
  { id: 'p6', name: 'Kirana Ayu', phone: '0800-0000-0003', doctorId: 'd2', createdAt: '2026-08-05T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-08-05', '2026-08-12', '2026-08-26', '2026-09-09', '2026-09-23']) },
  { id: 'p7', name: 'Lukman Hakim', phone: '0800-0000-0004', doctorId: 'd5', createdAt: '2026-09-15T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-09-15', '2026-09-22', '2026-10-06']) },
  { id: 'p8', name: 'Mega Anggraini', phone: '0800-0000-0005', doctorId: 'd3', createdAt: '2026-10-08T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-10-08']) },
  { id: 'p9', name: 'Nanda Firmansyah', phone: '0800-0000-0006', doctorId: 'd1', createdAt: '2026-10-20T08:00:00.000Z', archived: false, notes: [], steps: {} },
  { id: 'p10', program: 'internal', name: 'Okta Saraswati', phone: '0800-0000-0007', doctorId: 'd2', createdAt: '2026-09-01T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-09-01', '2026-09-08', '2026-09-10', '2026-09-24', '2026-10-01'], INTERNAL_STEPS) },
  { id: 'p11', program: 'internal', name: 'Putra Wibisono', phone: '0800-0000-0008', doctorId: 'd1', createdAt: '2026-09-29T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-09-29', '2026-10-06', '2026-10-08'], INTERNAL_STEPS) },
  { id: 'p12', program: 'internal', name: 'Ratna Sari', phone: '0800-0000-0009', doctorId: 'd3', createdAt: '2026-10-14T08:00:00.000Z', archived: false, notes: [], steps: steps(['2026-10-14'], INTERNAL_STEPS) },
];
