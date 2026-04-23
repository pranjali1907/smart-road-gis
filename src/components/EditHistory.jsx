import { useState, useEffect, useCallback } from 'react';
import { fetchHistory } from '../api';
import {
  History, User, Calendar, FileEdit, ArrowUpRight,
  Search, RefreshCw, ChevronLeft, ChevronRight, Globe
} from 'lucide-react';

const PAGE_SIZE = 25;

export default function EditHistory() {
  // API State
  const [data, setData] = useState({ entries: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // No datasetId — fetches ALL history across ALL datasets
      const result = await fetchHistory({ page, limit: PAGE_SIZE, search: searchQuery });
      setData(result);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getActivityIcon = (field) => {
    if (field === 'Created' || field === 'Road Created') return <ArrowUpRight size={14} className="icon-success" />;
    if (field === 'Moved to Trash' || field === 'Road Deleted') return <ArrowUpRight size={14} className="icon-danger" />;
    return <FileEdit size={14} className="icon-primary" />;
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  };

  return (
    <div className="history-view">
      <div className="view-header">
        <div className="header-main">
          <h2><Globe size={20} /> Global Audit Log</h2>
          <p className="header-subtitle">
            Complete edit history across <strong>all datasets</strong> — visible to all users in real time
          </p>
        </div>
      </div>

      <div className="history-toolbar">
        <div className="history-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by road name, user, field, or dataset..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="history-stats">
          <span>Total entries: <strong>{data.total}</strong></span>
          {loading && <RefreshCw size={14} className="spin-icon" style={{ marginLeft: 8 }} />}
        </div>
      </div>

      <div className={`history-container ${loading ? 'loading-opacity' : ''}`}>
        {data.entries.length > 0 ? (
          <>
            <div className="history-timeline">
              {data.entries.map((entry) => (
                <div key={entry.id} className="history-item animate-fade-in">
                  <div className="history-marker">
                    {getActivityIcon(entry.fieldName)}
                  </div>

                  <div className="history-content">
                    <div className="history-top">
                      <span className="history-road">
                        {entry.roadName || 'Unnamed Road'}
                        <small>{entry.roadId}</small>
                      </span>
                      <span className="history-time">
                        <Calendar size={12} />
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>

                    <div className="history-body">
                      <span className="history-field">{entry.fieldName}</span>
                      <div className="history-change">
                        <span className="val-old">{entry.oldValue || '∅'}</span>
                        <span className="change-arrow">→</span>
                        <span className="val-new">{entry.newValue || '∅'}</span>
                      </div>
                    </div>

                    <div className="history-footer">
                      <span className="history-user">
                        <User size={12} />
                        Edited by <strong>{entry.editedBy}</strong>
                      </span>
                      {entry.datasetId && (
                        <span className="history-dataset-tag">
                          Dataset #{entry.datasetId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="registry-pagination">
                <button
                  className="page-nav-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div className="page-info">
                  <span className="page-current">Page {page}</span>
                  <span className="page-total">of {data.totalPages}</span>
                </div>

                <button
                  className="page-nav-btn"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages || loading}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            {!loading && (
              <>
                <History size={48} className="empty-icon" />
                <p>No edit history found. Changes made by any user will appear here.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
