import { useState, useMemo } from 'react';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { Search, Clock, ArrowRight, LogIn, LogOut, UserPlus, Filter } from 'lucide-react';

export default function EditHistory() {
  const { history } = useRoads();
  const { loginActivity } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'edits' | 'activity'

  // Merge road edit history and user login/signup/logout activity into one timeline
  const mergedTimeline = useMemo(() => {
    const edits = history.map(e => ({ ...e, type: 'edit' }));
    const activities = (loginActivity || []).map(a => ({
      id: `activity-${a.timestamp}-${a.userId}`,
      type: 'activity',
      action: a.action,
      username: a.username,
      timestamp: a.timestamp,
    }));

    let combined;
    if (filter === 'edits') combined = edits;
    else if (filter === 'activity') combined = activities;
    else combined = [...edits, ...activities];

    // Sort by timestamp descending (newest first)
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return combined;
  }, [history, loginActivity, filter]);

  const filtered = useMemo(() => {
    if (!search) return mergedTimeline;
    const q = search.toLowerCase();
    return mergedTimeline.filter(e => {
      if (e.type === 'edit') {
        return (
          e.roadName?.toLowerCase().includes(q) ||
          e.fieldName?.toLowerCase().includes(q) ||
          e.editedBy?.toLowerCase().includes(q) ||
          e.roadId?.toLowerCase().includes(q)
        );
      }
      // activity entries
      return (
        e.username?.toLowerCase().includes(q) ||
        e.action?.toLowerCase().includes(q)
      );
    });
  }, [mergedTimeline, search]);

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case 'login': return <LogIn size={14} />;
      case 'logout': return <LogOut size={14} />;
      case 'signup': return <UserPlus size={14} />;
      default: return <LogIn size={14} />;
    }
  };

  const getActivityLabel = (action) => {
    switch (action) {
      case 'login': return 'signed in';
      case 'logout': return 'signed out';
      case 'signup': return 'registered';
      default: return action;
    }
  };

  const editCount = filtered.filter(e => e.type === 'edit').length;
  const activityCount = filtered.filter(e => e.type === 'activity').length;

  return (
    <div className="edit-history">
      <div className="history-toolbar">
        <div className="history-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search edits by road, field, editor, or user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="history-filter-group">
          <div className="history-filter-buttons">
            <button
              className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-chip ${filter === 'edits' ? 'active' : ''}`}
              onClick={() => setFilter('edits')}
            >
              Road Edits
            </button>
            <button
              className={`filter-chip ${filter === 'activity' ? 'active' : ''}`}
              onClick={() => setFilter('activity')}
            >
              User Activity
            </button>
          </div>
          <span className="history-count">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            {filter === 'all' && ` (${editCount} edits, ${activityCount} logins)`}
          </span>
        </div>
      </div>

      <div className="history-list">
        {filtered.length === 0 ? (
          <div className="history-empty">
            <Clock size={40} />
            <p>No history yet</p>
            <span>Changes and user activity will appear here</span>
          </div>
        ) : (
          filtered.map(entry => (
            entry.type === 'edit' ? (
              /* Road edit entry */
              <div key={entry.id} className="history-card">
                <div className="history-timeline-dot" />
                <div className="history-card-body">
                  <div className="history-card-top">
                    <span className="history-road">{entry.roadName || 'Unnamed Road'}</span>
                    <span className="history-road-id">{entry.roadId}</span>
                    <span className="history-time">{formatTime(entry.timestamp)}</span>
                  </div>
                  <div className="history-card-detail">
                    <span className="history-field">{entry.fieldName}</span>
                    {entry.oldValue && entry.newValue && entry.fieldName !== 'Created' && entry.fieldName !== 'Deleted' ? (
                      <div className="history-diff">
                        <span className="diff-old">{entry.oldValue}</span>
                        <ArrowRight size={12} />
                        <span className="diff-new">{entry.newValue}</span>
                      </div>
                    ) : (
                      <span className="history-action-text">{entry.newValue}</span>
                    )}
                  </div>
                  <span className="history-editor">by {entry.editedBy || 'System'}</span>
                </div>
              </div>
            ) : (
              /* User activity entry */
              <div key={entry.id} className="history-card activity-card">
                <div className={`history-timeline-dot activity-dot ${entry.action}`} />
                <div className="history-card-body">
                  <div className="history-card-top">
                    <span className="history-activity-icon">{getActivityIcon(entry.action)}</span>
                    <span className="history-road">
                      <strong>{entry.username}</strong> {getActivityLabel(entry.action)}
                    </span>
                    <span className="history-time">{formatTime(entry.timestamp)}</span>
                  </div>
                  <div className="history-card-detail">
                    <span className={`activity-badge ${entry.action}`}>
                      {entry.action === 'login' ? '🔓 Sign In' : entry.action === 'logout' ? '🔒 Sign Out' : '✨ New Registration'}
                    </span>
                  </div>
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}
