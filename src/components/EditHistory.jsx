import { useState, useMemo } from 'react';
import { useRoads } from '../context/RoadsContext';
import { Search, Clock, ArrowRight } from 'lucide-react';

export default function EditHistory() {
  const { history } = useRoads();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return history;
    const q = search.toLowerCase();
    return history.filter(e =>
      e.roadName?.toLowerCase().includes(q) ||
      e.fieldName?.toLowerCase().includes(q) ||
      e.editedBy?.toLowerCase().includes(q) ||
      e.roadId?.toLowerCase().includes(q)
    );
  }, [history, search]);

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

  return (
    <div className="edit-history">
      <div className="history-toolbar">
        <div className="history-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search edits by road, field, or editor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="history-count">{filtered.length} edit{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="history-list">
        {filtered.length === 0 ? (
          <div className="history-empty">
            <Clock size={40} />
            <p>No edit history yet</p>
            <span>Changes made to road attributes will appear here</span>
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} className="history-card">
              <div className="history-timeline-dot" />
              <div className="history-card-body">
                <div className="history-card-top">
                  <span className="history-road">{entry.roadName}</span>
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
          ))
        )}
      </div>
    </div>
  );
}
