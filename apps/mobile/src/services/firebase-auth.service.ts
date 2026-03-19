import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
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

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}

export async function signInWithGoogle(): Promise<FirebaseSession> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    if (!idToken) throw new Error('Google Sign-In did not return an ID token.');

    const auth = getFirebaseAuth();
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);

    const session = await sessionFromCurrentUser(true);
    if (!session) throw new Error('Could not start session.');
    return session;
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function signInWithApple(): Promise<FirebaseSession> {
  try {
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken } = appleCredential;
    if (!identityToken) throw new Error('Apple Sign-In did not return an identity token.');

    const auth = getFirebaseAuth();
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken });
    await signInWithCredential(auth, credential);

    const session = await sessionFromCurrentUser(true);
    if (!session) throw new Error('Could not start session.');
    return session;
  } catch (error) {
    // User cancelled — don't surface as an error
    const appleError = error as { code?: string };
    if (appleError?.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('CANCELLED');
    }
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

export async function resetPassword(email: string): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw toAuthError(error);
  }
}

export function subscribeToTokenRefresh(onToken: (token: string) => void): () => void {
  const auth = getFirebaseAuth();
  return auth.onIdTokenChanged(async (user) => {
    if (user) {
      const token = await user.getIdToken();
      onToken(token);
    }
  });
}
