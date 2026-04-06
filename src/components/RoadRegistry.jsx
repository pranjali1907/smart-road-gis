import { useState, useMemo } from 'react';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { ROAD_TYPE_COLORS, STATUS_COLORS, ROAD_TYPES, ROAD_STATUSES } from '../data/sampleRoads';
import {
  Search, Filter, Plus, MapPin, ChevronDown, ArrowUpDown,
  Eye, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';

const PAGE_SIZE = 10;

export default function RoadRegistry({ onSelectRoad, onAddRoad, onViewOnMap }) {
  const { roads, deleteRoad } = useRoads();
  const { isAdmin, currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = [...roads];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q) ||
        r.contractor?.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'All') list = list.filter(r => r.roadType === typeFilter);
    if (statusFilter !== 'All') list = list.filter(r => r.status === statusFilter);

    list.sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [roads, searchQuery, typeFilter, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleDelete = (road) => {
    if (confirm(`Delete "${road.name}"? This action cannot be undone.`)) {
      deleteRoad(road.id, currentUser?.username || 'admin');
    }
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
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>

        <div className="registry-filters">
          <div className="filter-select">
            <Filter size={14} />
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="All">All Types</option>
              {ROAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-select">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="All">All Status</option>
              {ROAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button className="btn-primary" onClick={onAddRoad}>
            <Plus size={16} /> Add Road
          </button>
        </div>
      </div>

      {/* Results summary */}
      <div className="registry-summary">
        <span>Showing {paged.length} of {filtered.length} road{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="registry-table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('id')}>
                ID <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('name')}>
                Road Name <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('roadType')}>
                Type <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('length')}>
                Length (km) <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('width')}>
                Width (m) <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('status')}>
                Status <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('zone')}>
                Zone <ArrowUpDown size={12} />
              </th>
              <th onClick={() => toggleSort('wardNo')}>
                Ward <ArrowUpDown size={12} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(road => (
              <tr key={road.id} onClick={() => onSelectRoad(road.id)} className="registry-row">
                <td className="road-id">{road.id}</td>
                <td className="road-name-cell">
                  <span className="road-name-text">{road.name}</span>
                </td>
                <td>
                  <span className="type-badge" style={{ '--badge-color': ROAD_TYPE_COLORS[road.roadType] || '#94a3b8' }}>
                    {road.roadType}
                  </span>
                </td>
                <td>{road.length}</td>
                <td>{road.width}</td>
                <td>
                  <span className="status-badge" style={{ '--badge-color': STATUS_COLORS[road.status] || '#94a3b8' }}>
                    {road.status}
                  </span>
                </td>
                <td className="zone-cell">{road.zone}</td>
                <td>{road.wardNo || '—'}</td>
                <td className="actions-cell" onClick={e => e.stopPropagation()}>
                  <button className="action-btn" title="View on Map" onClick={() => onViewOnMap(road.id)}>
                    <MapPin size={14} />
                  </button>
                  <button className="action-btn" title="View Details" onClick={() => onSelectRoad(road.id)}>
                    <Eye size={14} />
                  </button>
                  {isAdmin && (
                    <button className="action-btn danger" title="Delete" onClick={() => handleDelete(road)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
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
      {totalPages > 1 && (
        <div className="registry-pagination">
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`page-btn ${page === i + 1 ? 'active' : ''}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
