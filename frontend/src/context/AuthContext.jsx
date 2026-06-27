// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase/config";

const AuthContext = createContext({
  user: null,
  loading: false,
  loginWithGoogle: async () => {},
  signupWithEmail: async () => {},
  loginWithEmail: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!auth);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Dynamic import of firebase/auth methods
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not configured");
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signupWithEmail = async (email, password) => {
    if (!auth) throw new Error("Firebase not configured");
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithEmail = async (email, password) => {
    if (!auth) throw new Error("Firebase not configured");
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loginWithGoogle, signupWithEmail, loginWithEmail, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
