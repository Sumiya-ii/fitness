import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';
import { getFirebaseAuth } from '../lib/firebase';

export interface FirebaseSessionUser {
  id: string;
  email: string | null;
}

export interface FirebaseSession {
  token: string;
  user: FirebaseSessionUser;
}

function toAuthError(error: unknown): Error {
  const firebaseError = error as FirebaseError;

  switch (firebaseError?.code) {
    case 'auth/invalid-email':
      return new Error('Invalid email address.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Invalid email or password.');
    case 'auth/email-already-in-use':
      return new Error('This email is already in use.');
    case 'auth/weak-password':
      return new Error('Password is too weak.');
    case 'auth/network-request-failed':
      return new Error('Network error. Please try again.');
    default:
      return new Error(firebaseError?.message ?? 'Authentication failed.');
  }
}

async function sessionFromCurrentUser(forceRefresh = false): Promise<FirebaseSession | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;

  const token = await user.getIdToken(forceRefresh);

  return {
    token,
    user: {
      id: user.uid,
      email: user.email,
    },
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<FirebaseSession> {
  try {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
    const session = await sessionFromCurrentUser(true);
    if (!session) throw new Error('Could not start session.');
    return session;
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
): Promise<FirebaseSession> {
  try {
    const auth = getFirebaseAuth();
    await createUserWithEmailAndPassword(auth, email, password);
    const session = await sessionFromCurrentUser(true);
    if (!session) throw new Error('Could not start session.');
    return session;
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function restoreFirebaseSession(): Promise<FirebaseSession | null> {
  const auth = getFirebaseAuth();

  // Wait for Firebase to finish restoring persisted auth state before reading currentUser.
  await new Promise<void>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      unsubscribe();
      resolve();
    });
  });

  return sessionFromCurrentUser(true);
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}
