import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { PROGRAMS } from './constants.js';
import { db, friendlyError } from './firebase.js';
import { useAuth } from './auth.jsx';

// Firestore layout:
//   doctors/{id}                 { name }
//   patients/{id}                { program, name, phone, doctorId, createdAt, archived, steps: { [stepId]: { date, note, updatedBy, updatedAt } } }
//   patients/{id}/notes/{noteId} { text, authorId, authorName, createdAt }
// Notes live in a subcollection so the security rules can limit deleting to the note's author or an admin.

const DataContext = createContext(null);
const EMPTY = { patients: false, doctors: false, notes: false };

export function DataProvider({ children }) {
  const { user, users } = useAuth();
  const [patientDocs, setPatientDocs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loaded, setLoaded] = useState(EMPTY);
  const [error, setError] = useState('');

  const userId = user?.id;
  useEffect(() => {
    setPatientDocs([]);
    setNotes([]);
    setDoctors([]);
    setLoaded(EMPTY);
    if (!userId) return;

    const done = (key) => setLoaded((l) => (l[key] ? l : { ...l, [key]: true }));
    const fail = (err) => setError(friendlyError(err));
    const unsubs = [
      onSnapshot(collection(db, 'patients'), (snap) => {
        setPatientDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        done('patients');
      }, fail),
      onSnapshot(collection(db, 'doctors'), (snap) => {
        setDoctors(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
        done('doctors');
      }, fail),
      onSnapshot(collectionGroup(db, 'notes'), (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, patientId: d.ref.parent.parent.id, ...d.data() })));
        done('notes');
      }, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [userId]);

  // Same patient shape the UI used before: notes attached, newest first.
  const patients = useMemo(() => {
    const byPatient = {};
    for (const n of notes) (byPatient[n.patientId] ||= []).push(n);
    return patientDocs.map((p) => ({
      ...p,
      steps: p.steps || {},
      notes: (byPatient[p.id] || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }));
  }, [patientDocs, notes]);

  // Writes show up through the listeners above; failures surface in the error banner.
  const run = useCallback((promise) => promise.catch((err) => setError(friendlyError(err))), []);
  const patientRef = (id) => doc(db, 'patients', id);

  const addPatient = useCallback(({ program, name, phone, doctorId, firstDate }) => {
    const firstStep = PROGRAMS[program].steps[0].id;
    return run(addDoc(collection(db, 'patients'), {
      program,
      name: name.trim(),
      phone: phone?.trim() || '',
      doctorId,
      createdAt: new Date().toISOString(),
      archived: false,
      steps: firstDate ? { [firstStep]: { date: firstDate, note: '' } } : {},
    }));
  }, [run]);

  const updatePatient = useCallback((id, changes) => run(updateDoc(patientRef(id), changes)), [run]);

  const deletePatient = useCallback((id) => run((async () => {
    const batch = writeBatch(db);
    const noteSnap = await getDocs(collection(db, 'patients', id, 'notes'));
    noteSnap.forEach((n) => batch.delete(n.ref));
    batch.delete(patientRef(id));
    await batch.commit();
  })()), [run]);

  const setStep = useCallback((id, stepId, { date, note }) => run(updateDoc(patientRef(id), {
    [`steps.${stepId}`]: { date, note: note?.trim() || '', updatedBy: user?.name, updatedAt: new Date().toISOString() },
  })), [run, user]);

  const clearStep = useCallback((id, stepId) => run(updateDoc(patientRef(id), { [`steps.${stepId}`]: deleteField() })), [run]);

  const addNote = useCallback((id, text) => run(addDoc(collection(db, 'patients', id, 'notes'), {
    text: text.trim(),
    authorId: user?.id,
    authorName: user?.name,
    createdAt: new Date().toISOString(),
  })), [run, user]);

  const deleteNote = useCallback((id, noteId) => run(deleteDoc(doc(db, 'patients', id, 'notes', noteId))), [run]);

  const addDoctor = useCallback((name) => run(addDoc(collection(db, 'doctors'), { name: name.trim() })), [run]);
  const updateDoctor = useCallback((id, name) => run(updateDoc(doc(db, 'doctors', id), { name: name.trim() })), [run]);
  const removeDoctor = useCallback((id) => run(deleteDoc(doc(db, 'doctors', id))), [run]);

  const doctorName = useCallback(
    (id) => doctors.find((d) => d.id === id)?.name || 'Unassigned',
    [doctors]
  );

  const downloadBackup = useCallback(() => {
    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: user?.email,
      doctors,
      patients,
      users: users.map(({ id, name, email, role, active, createdAt }) => ({ id, name, email, role, active, createdAt })),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-tracker-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doctors, patients, users, user]);

  const value = {
    loading: !(loaded.patients && loaded.doctors && loaded.notes),
    error,
    clearError: () => setError(''),
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
    downloadBackup,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
