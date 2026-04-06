import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Eye, EyeOff, LogIn, UserPlus, Shield, User } from 'lucide-react';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'user',
    remember: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate tiny network delay for polish
    await new Promise(r => setTimeout(r, 400));

    if (mode === 'login') {
      const result = login(form.username, form.password, form.remember);
      if (!result.success) setError(result.error);
    } else {
      // Signup — pass confirmPassword for validation
      const result = signup(
        form.username,
        form.email,
        form.password,
        form.role,
        form.fullName,
        form.confirmPassword,
      );
      if (!result.success) setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Left decorative panel */}
      <div className="login-hero">
        <div className="login-hero-content">
          <div className="login-hero-icon">
            <MapPin size={48} strokeWidth={1.5} />
          </div>
          <h1>Sangli Roads GIS</h1>
          <p className="login-hero-subtitle">Smart Road Infrastructure Management System</p>
          <div className="login-hero-features">
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Interactive GIS Mapping</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Road Attribute Management</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Infrastructure Analytics</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Role-Based Access Control</span>
            </div>
          </div>
          <p className="login-hero-footer">Sangli-Miraj-Kupwad Municipal Corporation</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-form-panel">
        <div className="login-form-container animate-fade-in-up">
          {/* Tab switcher */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              <LogIn size={16} />
              Sign In
            </button>
            <button
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}
            >
              <UserPlus size={16} />
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p className="login-form-desc">
              {mode === 'login'
                ? 'Sign in to access the road management portal'
                : 'Register to start managing road infrastructure'}
            </p>

            {error && (
              <div className="login-error animate-fade-in">
                <span>{error}</span>
              </div>
            )}

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Enter full name"
                  value={form.fullName}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-with-icon">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re‑enter password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="form-group">
                <label>Account Type</label>
                <div className="role-select">
                  <button
                    type="button"
                    className={`role-btn ${form.role === 'user' ? 'active' : ''}`}
                    onClick={() => setForm(p => ({ ...p, role: 'user' }))}
                  >
                    <User size={16} /> Viewer
                  </button>
                  <button
                    type="button"
                    className={`role-btn ${form.role === 'admin' ? 'active' : ''}`}
                    onClick={() => setForm(p => ({ ...p, role: 'admin' }))}
                  >
                    <Shield size={16} /> Admin
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <label className="remember-check">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                />
                <span>Remember me</span>
              </label>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <span className="spinner" />
              ) : mode === 'login' ? (
                <>
                  <LogIn size={18} /> Sign In
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Create Account
                </>
              )}
            </button>

            {mode === 'login' && (
              <div className="login-hint">
                <p>Demo credentials:</p>
                <code>admin / admin123</code> or <code>user / user123</code>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
