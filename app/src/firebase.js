import { getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env
const useEmulators = env.VITE_USE_EMULATORS === 'true'

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-squad-games',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}
const app = initializeApp(config)

export const auth = getAuth(app)
export const db = getFirestore(app)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8085)
}

/** Lets teams create their own account from the login screen. */
export const allowSignup = env.VITE_ALLOW_SIGNUP !== 'false'

/**
 * Creates a login account without touching the current session (used by the admin to add hosts).
 * A second Firebase app instance signs up the new user, then signs it out again.
 */
export async function createAccountAside(email, password) {
  const helper = getApps().find((a) => a.name === 'account-helper') ?? initializeApp(config, 'account-helper')
  const helperAuth = getAuth(helper)
  if (useEmulators && !helperAuth.emulatorConfig) {
    connectAuthEmulator(helperAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  }
  const { user } = await createUserWithEmailAndPassword(helperAuth, email, password)
  await signOut(helperAuth)
  return user.uid
}
