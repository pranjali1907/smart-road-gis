import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const DEFAULT_USERS = [
  { id: 1, username: 'admin', email: 'admin@smartroad.gov', password: 'admin123', role: 'admin', fullName: 'System Admin', createdAt: '2025-01-01T00:00:00Z' },
  { id: 2, username: 'user', email: 'user@smartroad.gov', password: 'user123', role: 'user', fullName: 'Regular User', createdAt: '2025-01-15T00:00:00Z' },
];

/* ─── Storage helpers ─── */

function getStoredUsers() {
  try {
    const stored = localStorage.getItem('smartroad_users');
    return stored ? JSON.parse(stored) : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

/** Check both localStorage (remember‑me) and sessionStorage (session‑only) */
function getStoredSession() {
  try {
    // Priority: localStorage (remember me) > sessionStorage (session only)
    const remembered = localStorage.getItem('smartroad_session');
    if (remembered) return JSON.parse(remembered);
    const session = sessionStorage.getItem('smartroad_session');
    if (session) return JSON.parse(session);
    return null;
  } catch {
    return null;
  }
}

function getStoredActivity() {
  try {
    const stored = localStorage.getItem('smartroad_activity');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/* ─── Validation helpers ─── */

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
  return null; // no error
}

export function validateLoginFields({ username, password }) {
  if (!username || !username.trim()) return 'Username is required';
  if (!password) return 'Password is required';
  return null;
}

/* ─── Provider ─── */

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(getStoredUsers);
  const [currentUser, setCurrentUser] = useState(getStoredSession);
  const [loginActivity, setLoginActivity] = useState(getStoredActivity);

  // Persist users
  useEffect(() => {
    localStorage.setItem('smartroad_users', JSON.stringify(users));
  }, [users]);

  // Persist session — the correct storage is decided during login/signup
  useEffect(() => {
    if (!currentUser) {
      localStorage.removeItem('smartroad_session');
      sessionStorage.removeItem('smartroad_session');
    }
  }, [currentUser]);

  // Persist activity log
  useEffect(() => {
    localStorage.setItem('smartroad_activity', JSON.stringify(loginActivity));
  }, [loginActivity]);

  /* ─── Login ─── */
  const login = useCallback((username, password, remember = false) => {
    // Client‑side field validation
    const fieldErr = validateLoginFields({ username, password });
    if (fieldErr) return { success: false, error: fieldErr };

    const user = users.find(u => u.username === username.trim() && u.password === password);
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    const session = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    // Choose storage based on "remember me"
    if (remember) {
      localStorage.setItem('smartroad_session', JSON.stringify(session));
      sessionStorage.removeItem('smartroad_session');
    } else {
      sessionStorage.setItem('smartroad_session', JSON.stringify(session));
      localStorage.removeItem('smartroad_session');
    }

    setCurrentUser(session);
    setLoginActivity(prev => [
      { userId: user.id, username: user.username, action: 'login', timestamp: new Date().toISOString() },
      ...prev.slice(0, 99),
    ]);
    return { success: true, user: session };
  }, [users]);

  /* ─── Signup ─── */
  const signup = useCallback((username, email, password, role, fullName, confirmPassword) => {
    // Full validation
    const fieldErr = validateSignupFields({ username, email, password, confirmPassword, fullName });
    if (fieldErr) return { success: false, error: fieldErr };

    const trimUser = username.trim();
    const trimEmail = email.trim().toLowerCase();

    if (users.find(u => u.username.toLowerCase() === trimUser.toLowerCase())) {
      return { success: false, error: 'Username already exists' };
    }
    if (users.find(u => u.email.toLowerCase() === trimEmail)) {
      return { success: false, error: 'Email already registered' };
    }

    const newUser = {
      id: Math.max(...users.map(u => u.id)) + 1,
      username: trimUser,
      email: trimEmail,
      password,
      role: role || 'user',
      fullName: fullName.trim(),
      createdAt: new Date().toISOString(),
    };

    setUsers(prev => [...prev, newUser]);

    const session = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      fullName: newUser.fullName,
    };

    // After signup, store session in sessionStorage (user can choose "remember me" on next login)
    sessionStorage.setItem('smartroad_session', JSON.stringify(session));
    localStorage.removeItem('smartroad_session');

    setCurrentUser(session);
    setLoginActivity(prev => [
      { userId: newUser.id, username: newUser.username, action: 'signup', timestamp: new Date().toISOString() },
      ...prev.slice(0, 99),
    ]);
    return { success: true, user: session };
  }, [users]);

  /* ─── Logout ─── */
  const logout = useCallback(() => {
    if (currentUser) {
      setLoginActivity(prev => [
        { userId: currentUser.id, username: currentUser.username, action: 'logout', timestamp: new Date().toISOString() },
        ...prev.slice(0, 99),
      ]);
    }
    setCurrentUser(null);
    localStorage.removeItem('smartroad_session');
    sessionStorage.removeItem('smartroad_session');
  }, [currentUser]);

  /* ─── User management ─── */
  const updateUser = useCallback((userId, updates) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
  }, [currentUser]);

  const deleteUser = useCallback((userId) => {
    if (userId === 1) return { success: false, error: 'Cannot delete default admin' };
    setUsers(prev => prev.filter(u => u.id !== userId));
    return { success: true };
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const isAuthenticated = !!currentUser;

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      isAdmin,
      isAuthenticated,
      loginActivity,
      login,
      signup,
      logout,
      updateUser,
      deleteUser,
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
