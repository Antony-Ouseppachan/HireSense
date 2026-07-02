// src/services/authService.js

import {
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
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