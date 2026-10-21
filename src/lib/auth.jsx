import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig, friendlyError } from './firebase.js';

// Sign-in is Firebase Auth (email + password). Each person also needs a `users/{uid}` document
// with { name, email, role, active } — that is what grants access and decides admin vs staff.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(undefined); // undefined while Firebase restores the session
  const [profile, setProfile] = useState(undefined);
  const [users, setUsers] = useState([]);
  const [authError, setAuthError] = useState('');

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setAuthUser(u);
        if (!u) setProfile(null);
      }),
    []
  );

  // Watch the signed-in person's profile so deactivation or role changes apply immediately.
  useEffect(() => {
    if (!authUser) return;
    setProfile(undefined);
    return onSnapshot(
      doc(db, 'users', authUser.uid),
      (snap) => {
        const data = snap.exists() ? { id: snap.id, email: authUser.email, ...snap.data() } : null;
        if (!data || !data.active) {
          setAuthError(
            data
              ? 'Your account has been deactivated. Contact an admin.'
              : 'This account has no access to the Patient Tracker yet. Ask an admin to add you.'
          );
          setProfile(null);
          signOut(auth);
          return;
        }
        setProfile(data);
      },
      (err) => {
        setAuthError(friendlyError(err));
        setProfile(null);
        signOut(auth);
      }
    );
  }, [authUser]);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    return onSnapshot(collection(db, 'users'), (snap) =>
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
    );
  }, [isAdmin]);

  const login = useCallback(async (email, password) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  // Creating a login from the browser would normally sign the admin out, so it runs on a
  // short-lived second Firebase app instance instead.
  const addUser = useCallback(async ({ name, email, role, password }) => {
    const secondary = initializeApp(firebaseConfig, `add-user-${Date.now()}`);
    try {
      const cred = await createUserWithEmailAndPassword(getAuth(secondary), email.trim(), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        active: true,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      throw new Error(friendlyError(err));
    } finally {
      await deleteApp(secondary);
    }
  }, []);

  const updateUser = useCallback(
    async (id, changes) => {
      const next = users.map((u) => (u.id === id ? { ...u, ...changes } : u));
      if (!next.some((u) => u.role === 'admin' && u.active)) {
        throw new Error('At least one active admin is required.');
      }
      try {
        await updateDoc(doc(db, 'users', id), changes);
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    },
    [users]
  );

  const value = {
    ready: authUser !== undefined && (authUser === null || profile !== undefined),
    user: profile || null,
    isAdmin,
    users,
    authError,
    login,
    logout,
    resetPassword,
    addUser,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
