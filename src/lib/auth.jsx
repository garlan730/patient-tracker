import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { USERNAME_PATTERN, auth, db, firebaseConfig, friendlyError, loginName, toLoginEmail } from './firebase.js';

// Sign-in is Firebase Auth with a username (or email) + password; see toLoginEmail. Each person also needs a `users/{uid}` document
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
        const data = snap.exists() ? { id: snap.id, email: authUser.email, username: loginName(authUser.email), ...snap.data() } : null;
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
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data(), username: loginName(d.data().email) })).filter((u) => !u.replacedBy).sort((a, b) => a.name.localeCompare(b.name)))
    );
  }, [isAdmin]);

  const login = useCallback(async (username, password) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, toLoginEmail(username), password);
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
  const addUser = useCallback(async ({ name, username, role, password }) => {
    const login = username.trim().toLowerCase();
    if (!login.includes('@') && !USERNAME_PATTERN.test(login)) {
      throw new Error('Username must be 3–30 characters: lowercase letters, numbers, dot, dash or underscore.');
    }
    const secondary = initializeApp(firebaseConfig, `add-user-${Date.now()}`);
    try {
      const cred = await createUserWithEmailAndPassword(getAuth(secondary), toLoginEmail(login), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name.trim(),
        email: toLoginEmail(login),
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

  // Without a paid plan an admin can't set someone else's password directly. Instead the admin
  // deletes the old login in the Firebase console, then this creates a fresh login with the same
  // username and new password, and retires the old profile.
  const recreateLogin = useCallback(async (oldUser, password) => {
    const secondary = initializeApp(firebaseConfig, `reset-user-${Date.now()}`);
    try {
      const cred = await createUserWithEmailAndPassword(getAuth(secondary), oldUser.email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: oldUser.name,
        email: oldUser.email,
        role: oldUser.role,
        active: true,
        createdAt: oldUser.createdAt || new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', oldUser.id), { active: false, replacedBy: cred.user.uid });
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('The old login still exists. Delete it in the Firebase console first (step 1).');
      }
      throw new Error(friendlyError(err));
    } finally {
      await deleteApp(secondary);
    }
  }, []);

  // Changing your own password needs the current one (Firebase requires a recent sign-in).
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const me = auth.currentUser;
    try {
      await reauthenticateWithCredential(me, EmailAuthProvider.credential(me.email, currentPassword));
      await updatePassword(me, newPassword);
    } catch (err) {
      throw new Error(err.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : friendlyError(err));
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
    changePassword,
    recreateLogin,
    addUser,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
