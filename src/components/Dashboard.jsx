import { useMemo } from 'react';
import { useRoads } from '../context/RoadsContext';
import { ROAD_TYPE_COLORS, STATUS_COLORS } from '../data/sampleRoads';
import {
  Route, MapPin, Ruler, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, ArrowRight, Construction
} from 'lucide-react';

export default function Dashboard({ onViewOnMap }) {
  const { roads, history } = useRoads();

  const stats = useMemo(() => {
    const totalLength = roads.reduce((sum, r) => sum + (r.length || 0), 0);
    const avgWidth = roads.length ? (roads.reduce((sum, r) => sum + (r.width || 0), 0) / roads.length) : 0;
    const good = roads.filter(r => r.status === 'Good').length;
    const fair = roads.filter(r => r.status === 'Fair').length;
    const poor = roads.filter(r => r.status === 'Poor').length;
    const underConstruction = roads.filter(r => r.status === 'Under Construction').length;

    const byType = {};
    roads.forEach(r => { byType[r.roadType] = (byType[r.roadType] || 0) + 1; });

    const byZone = {};
    roads.forEach(r => { byZone[r.zone] = (byZone[r.zone] || 0) + 1; });

    const bySurface = {};
    roads.forEach(r => { bySurface[r.surfaceMaterial] = (bySurface[r.surfaceMaterial] || 0) + 1; });

    return { totalLength, avgWidth, good, fair, poor, underConstruction, byType, byZone, bySurface };
  }, [roads]);

  const recentEdits = history.slice(0, 5);
  const poorRoads = roads.filter(r => r.status === 'Poor');

  return (
    <div className="dashboard">
      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card" style={{ '--accent': '#2563eb' }}>
          <div className="stat-icon">
            <Route size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{roads.length}</span>
            <span className="stat-label">Total Roads</span>
          </div>
          <div className="stat-trend up">
            <TrendingUp size={14} /> Active
          </div>
        </div>

        <div className="stat-card" style={{ '--accent': '#6366f1' }}>
          <div className="stat-icon">
            <Ruler size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.totalLength.toFixed(1)}</span>
            <span className="stat-label">Total Length (km)</span>
          </div>
          <div className="stat-trend up">
            <TrendingUp size={14} /> Tracked
          </div>
        </div>

        <div className="stat-card" style={{ '--accent': '#10b981' }}>
          <div className="stat-icon">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.good}</span>
            <span className="stat-label">Good Condition</span>
          </div>
          <div className="stat-trend up">
            <TrendingUp size={14} /> {roads.length ? ((stats.good / roads.length) * 100).toFixed(0) : 0}%
          </div>
        </div>

        <div className="stat-card" style={{ '--accent': '#ef4444' }}>
          <div className="stat-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="stat-body">
            <span className="stat-value">{stats.poor}</span>
            <span className="stat-label">Needs Repair</span>
          </div>
          <div className="stat-trend down">
            <AlertTriangle size={14} /> Attention
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="dashboard-row">
        {/* Road type breakdown */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3><BarChart3 size={18} /> Roads by Type</h3>
          </div>
          <div className="dash-card-body">
            <div className="type-bars">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="type-bar-row">
                    <div className="type-bar-label">
                      <span
                        className="type-dot"
                        style={{ background: ROAD_TYPE_COLORS[type] || '#94a3b8' }}
                      />
                      <span>{type}</span>
                      <span className="type-count">{count}</span>
                    </div>
                    <div className="type-bar-track">
                      <div
                        className="type-bar-fill"
                        style={{
                          width: `${(count / roads.length) * 100}%`,
                          background: ROAD_TYPE_COLORS[type] || '#94a3b8'
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3><CheckCircle2 size={18} /> Condition Overview</h3>
          </div>
          <div className="dash-card-body">
            <div className="status-grid">
              {[
                { label: 'Good', count: stats.good, color: STATUS_COLORS.Good, icon: CheckCircle2 },
                { label: 'Fair', count: stats.fair, color: STATUS_COLORS.Fair, icon: AlertTriangle },
                { label: 'Poor', count: stats.poor, color: STATUS_COLORS.Poor, icon: AlertTriangle },
                { label: 'Under Construction', count: stats.underConstruction, color: STATUS_COLORS['Under Construction'], icon: Construction },
              ].map(s => (
                <div key={s.label} className="status-tile" style={{ '--status-color': s.color }}>
                  <s.icon size={20} />
                  <span className="status-tile-count">{s.count}</span>
                  <span className="status-tile-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Surface material */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3><MapPin size={18} /> Surface Material</h3>
          </div>
          <div className="dash-card-body">
            <div className="surface-list">
              {Object.entries(stats.bySurface).map(([mat, count]) => (
                <div key={mat} className="surface-item">
                  <span className="surface-name">{mat}</span>
                  <div className="surface-bar-track">
                    <div
                      className="surface-bar-fill"
                      style={{ width: `${(count / roads.length) * 100}%` }}
                    />
                  </div>
                  <span className="surface-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="dashboard-row">
        {/* Roads needing attention */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3><AlertTriangle size={18} /> Roads Needing Attention</h3>
          </div>
          <div className="dash-card-body">
            {poorRoads.length === 0 ? (
              <p className="empty-msg">All roads are in acceptable condition</p>
            ) : (
              <div className="attention-list">
                {poorRoads.map(road => (
                  <div key={road.id} className="attention-item">
                    <div className="attention-info">
                      <span className="attention-name">{road.name}</span>
                      <span className="attention-meta">{road.zone} · {road.roadType} · {road.length} km</span>
                    </div>
                    <button
                      className="attention-action"
                      onClick={() => onViewOnMap(road.id)}
                    >
                      View <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent edits */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3><History size={18} /> Recent Activity</h3>
          </div>
          <div className="dash-card-body">
            {recentEdits.length === 0 ? (
              <p className="empty-msg">No recent activity</p>
            ) : (
              <div className="activity-list">
                {recentEdits.map(entry => (
                  <div key={entry.id} className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <span className="activity-text">
                        <strong>{entry.editedBy || 'System'}</strong> changed <strong>{entry.fieldName}</strong> on {entry.roadName}
                      </span>
                      <span className="activity-time">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function History({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
