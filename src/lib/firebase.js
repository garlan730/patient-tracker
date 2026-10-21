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
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/user-not-found': 'Invalid email or password.',
    'auth/invalid-email': 'That email address is not valid.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/email-already-in-use': 'An account with this email already exists. If it was deactivated, reactivate it from the list.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/password-does-not-meet-requirements': 'Password does not meet the password policy set in Firebase.',
    'auth/network-request-failed': 'No internet connection. Check your network and try again.',
    'permission-denied': 'You do not have permission to do that.',
    unavailable: 'Cannot reach the server. Check your internet connection.',
  };
  return messages[code] || err?.message || 'Something went wrong.';
}
