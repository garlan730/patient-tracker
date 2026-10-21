import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SEED_USERS } from './constants.js';
import { load, save, remove, uid } from './storage.js';

// Local demo authentication: users live in localStorage with salted SHA-256 password hashes.
// Swap this provider for a real backend (Supabase, Firebase, your API) before storing real patient data.

const SESSION_HOURS = 8;
const AuthContext = createContext(null);

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function makeUser({ id, username, name, role, password }) {
  const salt = crypto.getRandomValues(new Uint32Array(2)).join('');
  return {
    id: id || uid('u'),
    username: username.trim().toLowerCase(),
    name: name.trim(),
    role,
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
}

const publicUser = ({ salt, passwordHash, ...rest }) => rest;

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => load('users', null));
  const [session, setSession] = useState(() => load('session', null));

  useEffect(() => {
    if (users) return;
    Promise.all(SEED_USERS.map(makeUser)).then((seeded) => {
      setUsers(seeded);
      save('users', seeded);
    });
  }, [users]);

  const persistUsers = useCallback((next) => {
    setUsers(next);
    save('users', next);
  }, []);

  const sessionValid = session && new Date(session.expiresAt) > new Date();
  const currentUser = useMemo(() => {
    if (!sessionValid || !users) return null;
    const u = users.find((x) => x.id === session.userId);
    return u ? publicUser(u) : null;
  }, [sessionValid, session, users]);

  const login = useCallback(
    async (username, password) => {
      const u = users?.find((x) => x.username === username.trim().toLowerCase());
      if (!u || (await hashPassword(password, u.salt)) !== u.passwordHash) {
        throw new Error('Invalid username or password.');
      }
      const s = {
        userId: u.id,
        expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
      };
      setSession(s);
      save('session', s);
    },
    [users]
  );

  const logout = useCallback(() => {
    setSession(null);
    remove('session');
  }, []);

  const addUser = useCallback(
    async (data) => {
      if (users.some((u) => u.username === data.username.trim().toLowerCase())) {
        throw new Error('That username is already taken.');
      }
      persistUsers([...users, await makeUser(data)]);
    },
    [users, persistUsers]
  );

  const updateUser = useCallback(
    async (id, { name, role, password }) => {
      const next = await Promise.all(
        users.map(async (u) => {
          if (u.id !== id) return u;
          const updated = { ...u, name: name ?? u.name, role: role ?? u.role };
          if (password) updated.passwordHash = await hashPassword(password, u.salt);
          return updated;
        })
      );
      if (!next.some((u) => u.role === 'admin')) throw new Error('At least one admin is required.');
      persistUsers(next);
    },
    [users, persistUsers]
  );

  const deleteUser = useCallback(
    (id) => {
      const next = users.filter((u) => u.id !== id);
      if (!next.some((u) => u.role === 'admin')) throw new Error('At least one admin is required.');
      persistUsers(next);
    },
    [users, persistUsers]
  );

  const value = {
    ready: !!users,
    user: currentUser,
    isAdmin: currentUser?.role === 'admin',
    users: (users || []).map(publicUser),
    login,
    logout,
    addUser,
    updateUser,
    deleteUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
