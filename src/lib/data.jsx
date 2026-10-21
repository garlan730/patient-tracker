import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { PROGRAMS, SEED_DOCTORS, SEED_PATIENTS } from './constants.js';
import { load, save, uid } from './storage.js';
import { useAuth } from './auth.jsx';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState(() => load('patients', SEED_PATIENTS));
  const [doctors, setDoctors] = useState(() => load('doctors', SEED_DOCTORS));

  useEffect(() => save('patients', patients), [patients]);
  useEffect(() => save('doctors', doctors), [doctors]);

  const updatePatientById = (id, fn) =>
    setPatients((list) => list.map((p) => (p.id === id ? fn(p) : p)));

  const addPatient = useCallback(({ program, name, phone, doctorId, firstDate }) => {
    const firstStep = PROGRAMS[program].steps[0].id;
    const patient = {
      id: uid('p'),
      program,
      name: name.trim(),
      phone: phone?.trim() || '',
      doctorId,
      createdAt: new Date().toISOString(),
      archived: false,
      notes: [],
      steps: firstDate ? { [firstStep]: { date: firstDate, note: '' } } : {},
    };
    setPatients((list) => [patient, ...list]);
    return patient;
  }, []);

  const updatePatient = useCallback((id, changes) => {
    updatePatientById(id, (p) => ({ ...p, ...changes }));
  }, []);

  const deletePatient = useCallback((id) => {
    setPatients((list) => list.filter((p) => p.id !== id));
  }, []);

  const setStep = useCallback((id, stepId, { date, note }) => {
    updatePatientById(id, (p) => ({
      ...p,
      steps: { ...p.steps, [stepId]: { date, note: note?.trim() || '', updatedBy: user?.name, updatedAt: new Date().toISOString() } },
    }));
  }, [user]);

  const clearStep = useCallback((id, stepId) => {
    updatePatientById(id, (p) => {
      const steps = { ...p.steps };
      delete steps[stepId];
      return { ...p, steps };
    });
  }, []);

  const addNote = useCallback((id, text) => {
    const note = {
      id: uid('n'),
      text: text.trim(),
      authorId: user?.id,
      authorName: user?.name,
      createdAt: new Date().toISOString(),
    };
    updatePatientById(id, (p) => ({ ...p, notes: [note, ...(p.notes || [])] }));
  }, [user]);

  const deleteNote = useCallback((id, noteId) => {
    updatePatientById(id, (p) => ({ ...p, notes: p.notes.filter((n) => n.id !== noteId) }));
  }, []);

  const addDoctor = useCallback((name) => {
    setDoctors((list) => [...list, { id: uid('d'), name: name.trim() }]);
  }, []);

  const updateDoctor = useCallback((id, name) => {
    setDoctors((list) => list.map((d) => (d.id === id ? { ...d, name: name.trim() } : d)));
  }, []);

  const removeDoctor = useCallback((id) => {
    setDoctors((list) => list.filter((d) => d.id !== id));
  }, []);

  const resetDemoData = useCallback(() => {
    setPatients(SEED_PATIENTS);
    setDoctors(SEED_DOCTORS);
  }, []);

  const doctorName = useCallback(
    (id) => doctors.find((d) => d.id === id)?.name || 'Unassigned',
    [doctors]
  );

  const value = {
    patients,
    doctors,
    doctorName,
    addPatient,
    updatePatient,
    deletePatient,
    setStep,
    clearStep,
    addNote,
    deleteNote,
    addDoctor,
    updateDoctor,
    removeDoctor,
    resetDemoData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
