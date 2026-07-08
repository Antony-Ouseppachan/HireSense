// src/context/AuthContext.jsx

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    loginWithGoogle as firebaseGoogleLogin,
    loginWithEmail as firebaseEmailLogin,
    registerWithEmail,
    logout as firebaseLogout,
    observeAuthState,
    resendVerificationEmail as firebaseResendVerification,
    refreshEmailVerificationStatus,
} from "../services/authService";

import {
    authenticateUser,
    getAuthenticatedUser,
} from "../services/apiService";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [backendUser, setBackendUser] = useState(null);

    const [loading, setLoading] = useState(true);

    /* ==========================================================
       Sync Firebase user with Express + Neon
    ========================================================== */

    const syncUserWithBackend = async () => {
        try {
            // Creates user if first login,
            // updates last_login otherwise.
            const loginResponse = await authenticateUser();

            if (loginResponse.success) {
                setBackendUser(loginResponse.user);
                return loginResponse.user;
            }

            return null;
        } catch (error) {
            console.error("Backend Authentication Failed:", error);
            setBackendUser(null);
            return null;
        }
    };

    /* ==========================================================
       Firebase Auth Listener
    ========================================================== */

    useEffect(() => {
        const unsubscribe = observeAuthState(async (user) => {
            try {
                setLoading(true);

                if (!user) {
                    setFirebaseUser(null);
                    setBackendUser(null);
                    setLoading(false);
                    return;
                }

                setFirebaseUser(user);

                // Sync/Login with backend
                await syncUserWithBackend();

            } catch (error) {
                console.error(error);
                setBackendUser(null);
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    /* ==========================================================
       Email Login
    ========================================================== */

    const loginWithEmail = async (email, password) => {
        await firebaseEmailLogin(email, password);

        const backend = await syncUserWithBackend();

        return backend;
    };

    /* ==========================================================
       Email Registration
    ========================================================== */

    const signupWithEmail = async (email, password) => {
        await registerWithEmail(email, password);

        const backend = await syncUserWithBackend();

        return backend;
    };

    /* ==========================================================
       Google Login
    ========================================================== */

    const loginWithGoogle = async () => {
        await firebaseGoogleLogin();

        const backend = await syncUserWithBackend();

        return backend;
    };

    /* ==========================================================
       Logout
    ========================================================== */

    const logout = async () => {
        await firebaseLogout();

        setFirebaseUser(null);
        setBackendUser(null);
    };

    /* ==========================================================
       Refresh Backend User
    ========================================================== */

    const refreshUser = async () => {
        try {
            const response = await getAuthenticatedUser();

            if (response.success) {
                setBackendUser(response.user);
                return response.user;
            }

            return null;
        } catch (error) {
            console.error(error);
            return null;
        }
    };

    /* ==========================================================
       Email Verification
    ========================================================== */

    const resendVerificationEmail = async () => {
        await firebaseResendVerification();
    };

    const checkEmailVerification = async () => {
        const isVerified = await refreshEmailVerificationStatus();

        if (isVerified) {
            // Re-sync backend with the refreshed token so is_verified
            // updates in Neon without needing a dedicated endpoint.
            await syncUserWithBackend();
        }

        return isVerified;
    };

    /* ==========================================================
       Helper Flags
    ========================================================== */

    const isAuthenticated =
        firebaseUser !== null &&
        backendUser !== null;

    const isCandidate =
        backendUser?.role === "candidate";

    const isRecruiter =
        backendUser?.role === "recruiter";

    const isAdmin =
        backendUser?.role === "admin";

    /* ==========================================================
       Context Value
    ========================================================== */

    const value = useMemo(
        () => ({
            firebaseUser,
            backendUser,

            user: backendUser,

            loading,

            isAuthenticated,
            isCandidate,
            isRecruiter,
            isAdmin,

            loginWithEmail,
            signupWithEmail,
            loginWithGoogle,
            logout,

            refreshUser,
            resendVerificationEmail,
            checkEmailVerification,
        }),
        [
            firebaseUser,
            backendUser,
            loading,
            isAuthenticated,
            isCandidate,
            isRecruiter,
            isAdmin,
        ]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
