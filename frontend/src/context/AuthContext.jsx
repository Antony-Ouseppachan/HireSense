// src/context/AuthContext.jsx

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    loginWithGoogle as firebaseGoogleLogin,
    loginWithEmail as firebaseEmailLogin,
    registerWithEmail,
    logout as firebaseLogout,
    observeAuthState,
    resendVerificationEmail as firebaseResendVerification,
    refreshEmailVerificationStatus as firebaseRefreshEmailStatus,
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

    /* Forces re-render after Firebase user mutation (reload) */
    const [verifyVersion, setVerifyVersion] = useState(0);

    /* Tracks when a Login/Register function is handling the backend
       sync so the onAuthStateChanged listener doesn't also sync,
       which would create a race with two concurrent requests. */
    const loginInProgressRef = useRef(false);

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

                // Only sync if a dedicated login/register function is
                // NOT already handling it, to avoid race conditions.
                if (!loginInProgressRef.current) {
                    await syncUserWithBackend();
                }

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
        loginInProgressRef.current = true;
        try {
            await firebaseEmailLogin(email, password);
            const backend = await syncUserWithBackend();
            return backend;
        } finally {
            loginInProgressRef.current = false;
        }
    };

    /* ==========================================================
       Email Registration
    ========================================================== */

    const signupWithEmail = async (email, password) => {
        loginInProgressRef.current = true;
        try {
            await registerWithEmail(email, password);
            const backend = await syncUserWithBackend();
            return backend;
        } finally {
            loginInProgressRef.current = false;
        }
    };

    /* ==========================================================
       Google Login
    ========================================================== */

    const loginWithGoogle = async () => {
        loginInProgressRef.current = true;
        try {
            await firebaseGoogleLogin();
            const backend = await syncUserWithBackend();
            return backend;
        } finally {
            loginInProgressRef.current = false;
        }
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
        const isVerified = await firebaseRefreshEmailStatus();

        if (isVerified) {
            await syncUserWithBackend();
        }

        return isVerified;
    };

    const refreshVerificationStatus = async () => {
        const isVerified = await firebaseRefreshEmailStatus();

        if (isVerified) {
            await syncUserWithBackend();
        }

        /* Force re-render so emailVerified re-evaluates */
        setVerifyVersion(v => v + 1);

        return isVerified;
    };

    /* ==========================================================
       Helper Flags
    ========================================================== */

    /* verifyVersion forces re-evaluation after reload() */
    // eslint-disable-next-line no-unused-vars
    const _vv = verifyVersion;

    const emailVerified =
        firebaseUser?.emailVerified ?? false;

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
            emailVerified,

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
            refreshVerificationStatus,
        }),
        [
            firebaseUser,
            backendUser,
            loading,
            emailVerified,
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
