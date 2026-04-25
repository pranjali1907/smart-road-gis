import { useState, useEffect, useCallback } from 'react';
import { fetchAllUsers, updateUserRole, deleteUser } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Shield, Crown, User, RefreshCw, CheckCircle2,
  AlertTriangle, ChevronDown, Search, Trash2
} from 'lucide-react';

// Roles the SuperAdmin can assign
const ROLES = [
  { value: 'user',       label: 'User',       desc: 'Map View only — read-only, no attribute table',            color: '#0891b2', icon: User   },
  { value: 'admin',      label: 'Admin',      desc: 'Dashboard, Map, Registry, Audit Log, Upload (no Trash)',   color: '#7c3aed', icon: Shield },
  { value: 'superadmin', label: 'Super Admin', desc: 'Full access — Trash, User Management, all features',      color: '#dc2626', icon: Crown  },
];

function RoleBadge({ role }) {
  const map = {
    user:       { label: 'User',        color: '#0891b2' },
    admin:      { label: 'Admin',       color: '#7c3aed' },
    superadmin: { label: 'Super Admin', color: '#dc2626' },
  };
  const r = map[role] || { label: role, color: '#64748b' };
  return (
    <span
      className="role-badge-pill"
      style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44` }}
    >
      {r.label}
    </span>
  );
}

export default function UserManagement() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRoleChange = async (user, newRole) => {
    if (user.role === newRole) { setOpenDropdown(null); return; }
    setSaving(user.id);
    setOpenDropdown(null);
    try {
      const result = await updateUserRole(user.id, newRole);
      if (result.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: result.user.role } : u));
        showToast(`Role updated: ${user.username} → ${newRole}`, 'success');
      } else {
        showToast(result.error || 'Failed to update role', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) return;
    if (!confirm(`Are you sure you want to permanently delete the user "${user.username}"?`)) return;
    
    setSaving(user.id);
    try {
      const result = await deleteUser(user.id);
      if (result.success) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        showToast(`User ${user.username} deleted successfully`, 'success');
      } else {
        showToast(result.error || 'Failed to delete user', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(null);
    }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="user-mgmt-view">
      {/* Toast */}
      {toast && (
        <div className={`toast-notification animate-fade-in ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="view-header">
        <div className="header-main">
          <h2><Users size={20} /> User Management</h2>
          <p className="header-subtitle">
            Manage user roles and access permissions. Only <strong>Super Admin</strong> can change roles.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Role Legend */}
      <div className="role-legend">
        {ROLES.map(r => (
          <div key={r.value} className="role-legend-item" style={{ '--role-color': r.color }}>
            <r.icon size={14} />
            <strong>{r.label}</strong>
            <span>{r.desc}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="history-toolbar">
        <div className="history-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by username, name, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="history-stats">
          <span>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="registry-table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Change Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  <RefreshCw size={18} className="spin-icon" /> Loading users...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">No users found</td>
              </tr>
            ) : (
              filtered.map((user, idx) => (
                <tr key={user.id} className="registry-row">
                  <td className="road-id">{idx + 1}</td>
                  <td><strong>{user.username}</strong></td>
                  <td>{user.fullName || '—'}</td>
                  <td className="email-cell">{user.email || '—'}</td>
                  <td><RoleBadge role={user.role} /></td>
                  <td className="actions-cell" onClick={e => e.stopPropagation()}>
                    {user.id === currentUser?.id ? (
                      // Can't change your own role
                      <span className="superadmin-lock" title="You cannot change your own role">
                        <Crown size={14} /> You
                      </span>
                    ) : saving === user.id ? (
                      <span className="saving-indicator">
                        <RefreshCw size={14} className="spin-icon" /> Saving...
                      </span>
                    ) : (
                      <div className="role-dropdown-wrapper">
                        <button
                          className="role-change-btn"
                          onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                        >
                          Change <ChevronDown size={12} className={openDropdown === user.id ? 'rotate-180' : ''} />
                        </button>
                        {openDropdown === user.id && (
                          <>
                            <div className="dropdown-overlay" onClick={() => setOpenDropdown(null)} />
                            <div className="role-dropdown animate-fade-in">
                              {ROLES.map(r => (
                                <button
                                  key={r.value}
                                  className={`role-dropdown-item ${user.role === r.value ? 'active' : ''}`}
                                  onClick={() => handleRoleChange(user, r.value)}
                                  style={{ '--role-color': r.color }}
                                >
                                  <r.icon size={14} />
                                  <div>
                                    <span className="role-item-label">{r.label}</span>
                                    <span className="role-item-desc">{r.desc}</span>
                                  </div>
                                  {user.role === r.value && <CheckCircle2 size={14} className="role-check" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="history-time" style={{ fontSize: '0.8rem' }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {user.id !== currentUser?.id && (
                      <button
                        className="btn-icon danger-icon"
                        onClick={() => handleDeleteUser(user)}
                        title="Delete User"
                        disabled={saving === user.id}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
