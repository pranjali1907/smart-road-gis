import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatasets } from '../context/DatasetContext';
import { fetchHistory, getHistoryExportUrl } from '../api';
import {
  History, User, Calendar, FileEdit, ArrowUpRight,
  Download, Search, RefreshCw, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';

const PAGE_SIZE = 25;

export default function EditHistory() {
  const { activeDataset, activeDatasetId } = useDatasets();
  const { currentUser } = useAuth();

  // API State
  const [data, setData] = useState({ entries: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    if (!activeDatasetId) return;
    setLoading(true);
    try {
      const result = await fetchHistory({
        datasetId: activeDatasetId,
        page,
        limit: PAGE_SIZE,
        search: searchQuery
      });
      setData(result);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDatasetId, page, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    if (!activeDatasetId) return;
    setExporting(true);
    try {
      const url = getHistoryExportUrl(activeDatasetId);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const getActivityIcon = (field) => {
    if (field === 'Road Created') return <ArrowUpRight size={14} className="icon-success" />;
    if (field === 'Road Deleted') return <ArrowUpRight size={14} className="icon-danger" />;
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
          <h2><History size={20} /> Edit History & Audit Logs</h2>
          <p className="header-subtitle">
            Tracking changes for <strong>{activeDataset?.name || 'Selected Dataset'}</strong>
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn-export-excel"
            onClick={handleExport}
            disabled={exporting || loading || !activeDatasetId}
          >
            {exporting ? <RefreshCw size={16} className="spin-icon" /> : <Download size={16} />}
            {exporting ? 'Preparing Excel...' : 'Export History (XLSX)'}
          </button>
        </div>
      </div>

      <div className="history-toolbar">
        <div className="history-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by road name, user, or field..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="history-stats">
          <span>Total entries: <strong>{data.total}</strong></span>
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
                <p>No edit history found for this dataset.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
