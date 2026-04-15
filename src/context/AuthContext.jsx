import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiLogin, apiSignup, apiLogActivity, fetchActivity, setToken, clearToken, getToken } from '../api';

const AuthContext = createContext(null);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupFields({ username, email, password, confirmPassword, fullName }) {
  if (!fullName || !fullName.trim()) return 'Full name is required';
  if (!username || !username.trim()) return 'Username is required';
  if (username.trim().length < 3) return 'Username must be at least 3 characters';
  if (/[^a-zA-Z0-9_]/.test(username.trim())) return 'Username may only contain letters, digits, or underscores';
  if (!email || !email.trim()) return 'Email is required';
  if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address';
  if (!password) return 'Password is required';
  if (password.length < 4) return 'Password must be at least 4 characters';
  if (confirmPassword !== undefined && password !== confirmPassword) return 'Passwords do not match';
  return null;
}

export function validateLoginFields({ username, password }) {
  if (!username || !username.trim()) return 'Username is required';
  if (!password) return 'Password is required';
  return null;
}

/* ─── Session storage helpers ─── */
function getStoredSession() {
  try {
    const remembered = localStorage.getItem('smartroad_session');
    if (remembered) return JSON.parse(remembered);
    const session = sessionStorage.getItem('smartroad_session');
    if (session) return JSON.parse(session);
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(getStoredSession);
  const [loginActivity, setLoginActivity] = useState([]);
  const [authError, setAuthError] = useState('');

  // Load activity on mount
  useEffect(() => {
    if (currentUser) {
      fetchActivity().then(data => {
        if (data && data.length > 0) setLoginActivity(data);
      });
    }
  }, [currentUser]);

  // Check if token exists on mount — if session exists but no token, clear it
  useEffect(() => {
    const token = getToken();
    if (currentUser && !token) {
      setCurrentUser(null);
      localStorage.removeItem('smartroad_session');
      sessionStorage.removeItem('smartroad_session');
    }
  }, []);

  /* ─── Login ─── */
  const login = useCallback(async (username, password, remember = false) => {
    const fieldErr = validateLoginFields({ username, password });
    if (fieldErr) return { success: false, error: fieldErr };

    try {
      const result = await apiLogin(username.trim(), password);

      if (result.error) {
        return { success: false, error: result.error };
      }

      if (result.success && result.token) {
        setToken(result.token, remember);

        const session = result.user;
        if (remember) {
          localStorage.setItem('smartroad_session', JSON.stringify(session));
          sessionStorage.removeItem('smartroad_session');
        } else {
          sessionStorage.setItem('smartroad_session', JSON.stringify(session));
          localStorage.removeItem('smartroad_session');
        }

        setCurrentUser(session);
        setAuthError('');

        // Refresh activity
        const activity = await fetchActivity();
        if (activity) setLoginActivity(activity);

        return { success: true, user: session };
      }

      return { success: false, error: 'Login failed' };
    } catch (err) {
      return { success: false, error: 'Server unavailable. Please try again.' };
    }
  }, []);

  /* ─── Signup ─── */
  const signup = useCallback(async (username, email, password, role, fullName, confirmPassword) => {
    const fieldErr = validateSignupFields({ username, email, password, confirmPassword, fullName });
    if (fieldErr) return { success: false, error: fieldErr };

    try {
      const result = await apiSignup({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        role: 'user', // Always user for self-signup
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      if (result.success && result.token) {
        setToken(result.token, false);

        const session = result.user;
        sessionStorage.setItem('smartroad_session', JSON.stringify(session));
        localStorage.removeItem('smartroad_session');

        setCurrentUser(session);
        setAuthError('');

        return { success: true, user: session };
      }

      return { success: false, error: 'Signup failed' };
    } catch (err) {
      return { success: false, error: 'Server unavailable. Please try again.' };
    }
  }, []);

  /* ─── Logout ─── */
  const logout = useCallback(async () => {
    if (currentUser) {
      await apiLogActivity({ userId: currentUser.id, username: currentUser.username, action: 'logout' });
    }
    setCurrentUser(null);
    clearToken();
    localStorage.removeItem('smartroad_session');
    sessionStorage.removeItem('smartroad_session');
    localStorage.removeItem('smartroad_active_dataset');
  }, [currentUser]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAuthenticated = !!currentUser && !!getToken();

  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Administrator';
      default: return 'Viewer';
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAdmin,
      isSuperAdmin,
      isAuthenticated,
      loginActivity,
      authError,
      login,
      signup,
      logout,
      getRoleLabel,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
