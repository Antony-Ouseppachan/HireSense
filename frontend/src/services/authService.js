import {
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendEmailVerification,
    reload,
} from "firebase/auth";

import { auth } from "../firebase/config";

/* ============================================================
   Google Authentication
============================================================ */

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
}

/* ============================================================
   Email Authentication
============================================================ */

export async function registerWithEmail(email, password) {
    const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
    );

    // Google accounts arrive pre-verified via the federated provider;
    // email/password accounts need an explicit verification email.
    await sendEmailVerification(result.user);

    return result.user;
}

export async function loginWithEmail(email, password) {
    const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
    );

    return result.user;
}

/* ============================================================
   Logout
============================================================ */

export async function logout() {
    await signOut(auth);
}

/* ============================================================
   Forgot Password
============================================================ */

export async function forgotPassword(email) {
    await sendPasswordResetEmail(auth, email);
}

/* ============================================================
   Email Verification
============================================================ */

export async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("No authenticated user.");
    }
    await sendEmailVerification(user);
}

/**
 * Firebase caches `emailVerified` on the client user object and in the
 * ID token at issue time. After the user clicks the link in their inbox,
 * we need to (1) reload the client-side user record, and (2) force a
 * fresh ID token, so the *next* backend call carries an up-to-date
 * `email_verified` claim for the server to trust.
 */
export async function refreshEmailVerificationStatus() {
    const user = auth.currentUser;
    if (!user) return false;

    await reload(user);
    await user.getIdToken(true);

    return user.emailVerified;
}

/* ============================================================
   Current User
============================================================ */

export function getCurrentUser() {
    return auth.currentUser || null;
}

/* ============================================================
   Firebase ID Token
============================================================ */

export async function getIdToken(forceRefresh = false) {
    const user = auth.currentUser;

    if (!user) {
        return null;
    }

    return await user.getIdToken(forceRefresh);
}

/* ============================================================
   Authentication State Listener
============================================================ */

export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

/* ============================================================
   Firebase Auth Instance
============================================================ */

export { auth };