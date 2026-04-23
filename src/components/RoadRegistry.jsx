import { useState, useEffect, useCallback } from 'react';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { useDatasets } from '../context/DatasetContext';
import { fetchRoads, getRoadsExportUrl, getRoadsGpkgUrl } from '../api';
import { ROAD_TYPE_COLORS, STATUS_COLORS, ROAD_TYPES, ROAD_STATUSES } from '../data/sampleRoads';
import {
  Search, Filter, Plus, MapPin, ArrowUpDown,
  Eye, Trash2, ChevronLeft, ChevronRight, AlertTriangle, X, RefreshCw, Download
} from 'lucide-react';

const PAGE_SIZE = 15;

export default function RoadRegistry({ onSelectRoad, onAddRoad, onViewOnMap }) {
  const { deleteRoad } = useRoads();
  const { isAdmin, isRestrictedUser } = useAuth();
  const { activeDatasetId } = useDatasets();

  // API State
  const [data, setData] = useState({ roads: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch data from API
  const loadData = useCallback(async () => {
    if (!activeDatasetId) return;
    setLoading(true);
    try {
      const result = await fetchRoads({
        datasetId: activeDatasetId,
        page,
        limit: PAGE_SIZE,
        search: searchQuery,
        type: typeFilter,
        status: statusFilter,
        sortField,
        sortDir
      });
      setData(result);
    } catch (err) {
      console.error('Failed to fetch roads:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDatasetId, page, searchQuery, typeFilter, statusFilter, sortField, sortDir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleFilterChange = (type, val) => {
    if (type === 'type') setTypeFilter(val);
    if (type === 'status') setStatusFilter(val);
    setPage(1);
  };

  const handleDeleteClick = (road) => {
    setDeleteTarget(road);
    setDeleteConfirmText('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteRoad(deleteTarget.id, currentUser?.username || 'admin');
    setDeleteTarget(null);
    setDeleteConfirmText('');
    loadData(); // Refresh current page
  };

  return (
    <div className="registry">
      {/* Toolbar */}
      <div className="registry-toolbar">
        <div className="registry-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, ID, zone, contractor..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="registry-filters">
          <div className="filter-select">
            <Filter size={14} />
            <select value={typeFilter} onChange={e => handleFilterChange('type', e.target.value)}>
              <option value="All">All Types</option>
              {ROAD_TYPES.map(t => <option key={t} value={t}>{t || 'Unknown'}</option>)}
            </select>
          </div>
          <div className="filter-select">
            <select value={statusFilter} onChange={e => handleFilterChange('status', e.target.value)}>
              <option value="All">All Status</option>
              {ROAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {activeDatasetId && (
            <>
              <button
                className="btn-secondary"
                onClick={() => window.open(getRoadsExportUrl(activeDatasetId), '_blank')}
                title="Export full attribute table to Excel"
              >
                <Download size={15} />
                Export Excel
              </button>
              <button
                className="btn-secondary"
                onClick={() => window.open(getRoadsGpkgUrl(activeDatasetId), '_blank')}
                title="Download as GeoPackage (.gpkg) for QGIS"
                style={{ color: 'var(--success)' }}
              >
                <Download size={15} />
                Export GPKG
              </button>
            </>
          )}

          {isAdmin && (
            <button className="btn-primary" onClick={onAddRoad}>
              <Plus size={16} /> Add Road
            </button>
          )}
        </div>

      </div>

      {/* Results summary */}
      <div className="registry-summary">
        {loading ? (
          <span className="loading-indicator"><RefreshCw size={14} className="spin-icon" /> Updating...</span>
        ) : (
          <span>Showing {data.roads.length} of {data.total} road{data.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className={`registry-table-wrap ${loading ? 'loading-opacity' : ''}`}>
        <table className="registry-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('sr_no')}>
                Sr. No. <ArrowUpDown size={12} className={sortField === 'sr_no' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('name')}>
                Road Name <ArrowUpDown size={12} className={sortField === 'name' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('road_type')}>
                Type <ArrowUpDown size={12} className={sortField === 'road_type' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('length')}>
                Length (km) <ArrowUpDown size={12} className={sortField === 'length' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('width')}>
                Width (m) <ArrowUpDown size={12} className={sortField === 'width' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('status')}>
                Status <ArrowUpDown size={12} className={sortField === 'status' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('zone')}>
                Zone <ArrowUpDown size={12} className={sortField === 'zone' ? 'active' : ''} />
              </th>
              <th onClick={() => toggleSort('ward_no')}>
                Ward <ArrowUpDown size={12} className={sortField === 'ward_no' ? 'active' : ''} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.roads.map(road => (
              <tr
                key={road.id}
                onClick={() => !isRestrictedUser && onSelectRoad(road.id)}
                className={`registry-row ${isRestrictedUser ? 'viewer-row' : ''}`}
              >
                <td className="road-id">{road.srNo ?? '—'}</td>
                <td className="road-name-cell">
                  <span className="road-name-text">{road.name || '—'}</span>
                </td>
                <td>
                  <span className="type-badge" style={{ '--badge-color': ROAD_TYPE_COLORS[road.roadType] || '#94a3b8' }}>
                    {road.roadType || 'Unknown'}
                  </span>
                </td>
                <td>{road.length}</td>
                <td>{road.width}</td>
                <td>
                  <span className="status-badge" style={{ '--badge-color': STATUS_COLORS[road.status] || '#94a3b8' }}>
                    {road.status}
                  </span>
                </td>
                <td className="zone-cell">{road.zone || '—'}</td>
                <td>{road.wardNo || '—'}</td>
                <td className="actions-cell" onClick={e => e.stopPropagation()}>
                  {!isRestrictedUser && (
                    <>
                      <button className="action-btn" title="View on Map" onClick={() => onViewOnMap(road.id)}>
                        <MapPin size={14} />
                      </button>
                      <button className="action-btn" title="View Details" onClick={() => onSelectRoad(road.id)}>
                        <Eye size={14} />
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <button
                      className="action-btn danger"
                      title="Move to Trash"
                      onClick={() => handleDeleteClick(road)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {isRestrictedUser && (
                    <span className="viewer-read-only">Read Only</span>
                  )}
                </td>
              </tr>
            ))}
            {data.roads.length === 0 && !loading && (
              <tr>
                <td colSpan="9" className="empty-table">
                  No roads found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="delete-confirm-modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon">
                <AlertTriangle size={28} />
              </div>
              <button className="btn-icon" onClick={() => setDeleteTarget(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="delete-confirm-body">
              <h3>Move Road to Trash?</h3>
              <p>You are about to move <strong>{deleteTarget.name || deleteTarget.id}</strong> to the trash.</p>
              <div className="delete-confirm-input-group">
                <label>Type <strong>DELETE</strong> to confirm:</label>
                <input
                  type="text"
                  placeholder="Type DELETE here"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="delete-confirm-footer">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText.toUpperCase() !== 'DELETE'}
              >
                <Trash2 size={14} /> Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
