import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// The web config is public by design (it ships in the website).
// Access to data is controlled by Firebase Auth and the rules in firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyDJj5YCiIbJjLo5NQsmJaLvMSJQRu88gjw',
  authDomain: 'patient-tracker-8a04c.firebaseapp.com',
  projectId: 'patient-tracker-8a04c',
  storageBucket: 'patient-tracker-8a04c.firebasestorage.app',
  messagingSenderId: '33593281409',
  appId: '1:33593281409:web:de8138b3cd366a1d45f680',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Turns Firebase error codes into messages staff can act on.
export function friendlyError(err) {
  const code = err?.code || '';
  const messages = {
    'auth/invalid-credential': 'Invalid username or password.',
    'auth/wrong-password': 'Invalid username or password.',
    'auth/user-not-found': 'Invalid username or password.',
    'auth/invalid-email': 'That username or email is not valid.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/email-already-in-use': 'That username is already taken. If the user was deactivated, reactivate them from the list.',
    'auth/requires-recent-login': 'For security, sign out and sign in again, then retry.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/password-does-not-meet-requirements': 'Password does not meet the password policy set in Firebase.',
    'auth/network-request-failed': 'No internet connection. Check your network and try again.',
    'permission-denied': 'You do not have permission to do that.',
    unavailable: 'Cannot reach the server. Check your internet connection.',
  };
  return messages[code] || err?.message || 'Something went wrong.';
}

// Firebase sign-in needs an email address, so usernames are mapped to an internal address on the
// project's own domain (no mailbox). Anything containing "@" is treated as a real email, so
// accounts created with an email keep working.
const LOGIN_DOMAIN = `${firebaseConfig.projectId}.firebaseapp.com`;

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export const toLoginEmail = (login) => {
  const value = login.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${LOGIN_DOMAIN}`;
};

// The name shown in the app: the username for username accounts, the email otherwise.
export const loginName = (email = '') =>
  email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email;

export const hasRealEmail = (email = '') => !!email && !email.endsWith(`@${LOGIN_DOMAIN}`);
