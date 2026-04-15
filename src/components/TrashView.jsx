import { useState, useMemo } from 'react';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { ROAD_TYPE_COLORS } from '../data/sampleRoads';
import {
  Search, Trash2, RotateCcw, AlertTriangle, X, Clock,
  Undo2, Trash, CheckCircle2
} from 'lucide-react';

export default function TrashView() {
  const { trash, restoreRoad, permanentDeleteRoad, restoreAllTrash, emptyTrash } = useRoads();
  const { currentUser, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showPermDeleteId, setShowPermDeleteId] = useState(null);
  const [permDeleteText, setPermDeleteText] = useState('');
  const [restoredToast, setRestoredToast] = useState('');

  const filtered = useMemo(() => {
    if (!search) return trash;
    const q = search.toLowerCase();
    return trash.filter(r =>
      r.id?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.zone?.toLowerCase().includes(q) ||
      r._deletedBy?.toLowerCase().includes(q)
    );
  }, [trash, search]);

  const handleRestore = async (road) => {
    await restoreRoad(road.id, currentUser?.username || 'admin');
    setRestoredToast(`"${road.name || road.id}" has been restored successfully`);
    setTimeout(() => setRestoredToast(''), 3000);
  };

  const handleRestoreAll = async () => {
    await restoreAllTrash(currentUser?.username || 'admin');
    setRestoredToast(`All ${trash.length} roads have been restored`);
    setTimeout(() => setRestoredToast(''), 3000);
  };

  const handleEmptyTrash = async () => {
    await emptyTrash(currentUser?.username || 'admin');
    setShowEmptyConfirm(false);
  };

  const handlePermanentDelete = async (id) => {
    await permanentDeleteRoad(id, currentUser?.username || 'admin');
    setShowPermDeleteId(null);
    setPermDeleteText('');
  };

  const formatDeleteTime = (iso) => {
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
    <div className="trash-view">
      <div className="trash-header">
        <div className="trash-header-text">
          <h2><Trash2 size={22} /> Trash</h2>
          <p>
            {trash.length === 0
              ? 'No deleted roads. Items moved to trash can be restored at any time.'
              : `${trash.length} road${trash.length !== 1 ? 's' : ''} in trash. These can be restored or permanently deleted.`
            }
          </p>
        </div>

        {trash.length > 0 && (
          <div className="trash-actions">
            <button className="btn-restore-all" onClick={handleRestoreAll}>
              <RotateCcw size={14} />
              Restore All
            </button>
            {isSuperAdmin && (
              <button className="btn-empty-trash" onClick={() => setShowEmptyConfirm(true)}>
                <Trash size={14} />
                Empty Trash
              </button>
            )}
          </div>
        )}
      </div>

      {/* Restored toast */}
      {restoredToast && (
        <div className="trash-toast animate-fade-in">
          <CheckCircle2 size={16} />
          <span>{restoredToast}</span>
        </div>
      )}

      {/* Search */}
      {trash.length > 0 && (
        <div className="trash-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search trashed roads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Trash list */}
      <div className="trash-list">
        {trash.length === 0 ? (
          <div className="trash-empty">
            <Trash2 size={48} />
            <h3>Trash is Empty</h3>
            <p>Roads that you move to trash will appear here.<br />You can always restore them back.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="trash-empty">
            <Search size={40} />
            <p>No trashed roads match your search</p>
          </div>
        ) : (
          filtered.map(road => (
            <div key={road.id} className="trash-card">
              <div className="trash-card-main">
                <div className="trash-card-header">
                  <span className="trash-card-id">{road.id}</span>
                  <span className="trash-card-srno">Sr. No. {road.srNo}</span>
                  {road.roadType && (
                    <span
                      className="type-badge"
                      style={{ '--badge-color': ROAD_TYPE_COLORS[road.roadType] || '#94a3b8' }}
                    >
                      {road.roadType}
                    </span>
                  )}
                </div>
                <div className="trash-card-name">
                  {road.name || 'Unnamed Road'}
                </div>
                <div className="trash-card-meta">
                  <span className="trash-meta-item">
                    <Clock size={12} />
                    Deleted {formatDeleteTime(road._deletedAt)}
                  </span>
                  <span className="trash-meta-item">
                    by <strong>{road._deletedBy || 'Unknown'}</strong>
                  </span>
                  {road.zone && (
                    <span className="trash-meta-item">Zone: {road.zone}</span>
                  )}
                  {road.wardNo && (
                    <span className="trash-meta-item">Ward: {road.wardNo}</span>
                  )}
                </div>
              </div>

              <div className="trash-card-actions">
                <button
                  className="btn-restore"
                  onClick={() => handleRestore(road)}
                  title="Restore this road"
                >
                  <Undo2 size={14} />
                  Restore
                </button>
                {isSuperAdmin && (
                  <button
                    className="btn-perm-delete"
                    onClick={() => { setShowPermDeleteId(road.id); setPermDeleteText(''); }}
                    title="Permanently delete (cannot be undone)"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Empty Trash Confirmation ─── */}
      {showEmptyConfirm && (
        <div className="modal-overlay" onClick={() => setShowEmptyConfirm(false)}>
          <div className="delete-confirm-modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon warning">
                <AlertTriangle size={28} />
              </div>
              <button className="btn-icon" onClick={() => setShowEmptyConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="delete-confirm-body">
              <h3>Empty Trash?</h3>
              <p>
                This will <strong>permanently delete {trash.length} road{trash.length !== 1 ? 's' : ''}</strong> from the system. This action <strong>cannot be undone</strong>.
              </p>
              <div className="delete-confirm-safe-note danger">
                <span>⚠ These roads cannot be recovered after permanent deletion.</span>
              </div>
            </div>
            <div className="delete-confirm-footer">
              <button className="btn-secondary" onClick={() => setShowEmptyConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleEmptyTrash}>
                <Trash size={14} />
                Permanently Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Permanent Delete Single Confirmation ─── */}
      {showPermDeleteId && (() => {
        const road = trash.find(r => r.id === showPermDeleteId);
        if (!road) return null;
        const isPDConfirmed = permDeleteText.trim().toUpperCase() === 'PERMANENT';
        return (
          <div className="modal-overlay" onClick={() => { setShowPermDeleteId(null); setPermDeleteText(''); }}>
            <div className="delete-confirm-modal animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="delete-confirm-header">
                <div className="delete-confirm-icon warning">
                  <AlertTriangle size={28} />
                </div>
                <button className="btn-icon" onClick={() => { setShowPermDeleteId(null); setPermDeleteText(''); }}>
                  <X size={18} />
                </button>
              </div>
              <div className="delete-confirm-body">
                <h3>Permanently Delete Road?</h3>
                <p>
                  You are about to permanently delete <strong>{road.name || road.id}</strong>. This action <strong>cannot be undone</strong>.
                </p>
                <div className="delete-confirm-safe-note danger">
                  <span>⚠ This road cannot be recovered after permanent deletion.</span>
                </div>
                <div className="delete-confirm-input-group">
                  <label>Type <strong>PERMANENT</strong> to confirm:</label>
                  <input
                    type="text"
                    placeholder="Type PERMANENT here"
                    value={permDeleteText}
                    onChange={e => setPermDeleteText(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && isPDConfirmed) handlePermanentDelete(road.id); }}
                  />
                </div>
              </div>
              <div className="delete-confirm-footer">
                <button className="btn-secondary" onClick={() => { setShowPermDeleteId(null); setPermDeleteText(''); }}>Cancel</button>
                <button
                  className="btn-danger"
                  onClick={() => handlePermanentDelete(road.id)}
                  disabled={!isPDConfirmed}
                >
                  <Trash2 size={14} />
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
