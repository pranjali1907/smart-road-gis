import { useMemo } from 'react';
import { useRoads } from '../context/RoadsContext';
import { useDatasets } from '../context/DatasetContext';
import { useAuth } from '../context/AuthContext';
import { ROAD_TYPE_COLORS, STATUS_COLORS } from '../data/sampleRoads';
import {
  Route, MapPin, Ruler, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, ArrowRight, Construction, History, Database,
  Layers, Activity, Clock, User, ChevronRight, Zap, Shield
} from 'lucide-react';

export default function Dashboard({ onViewOnMap }) {
  const { roads, history, loading } = useRoads();
  const { activeDataset } = useDatasets();
  const { currentUser } = useAuth();

  const stats = useMemo(() => {
    const totalLength = roads.reduce((sum, r) => sum + (r.length || 0), 0);
    const totalWidth  = roads.reduce((sum, r) => sum + (r.width  || 0), 0);
    const avgWidth    = roads.length ? totalWidth / roads.length : 0;
    const good             = roads.filter(r => r.status === 'Good').length;
    const fair             = roads.filter(r => r.status === 'Fair').length;
    const poor             = roads.filter(r => r.status === 'Poor').length;
    const underConstruction= roads.filter(r => r.status === 'Under Construction').length;
    const withDivider      = roads.filter(r => r.dividerOnRoad === 'Yes').length;

    const byType    = {};
    const byZone    = {};
    const bySurface = {};
    roads.forEach(r => {
      byType[r.roadType]         = (byType[r.roadType]         || 0) + 1;
      if (r.zone) byZone[r.zone] = (byZone[r.zone]             || 0) + 1;
      if (r.surfaceMaterial) bySurface[r.surfaceMaterial] = (bySurface[r.surfaceMaterial] || 0) + 1;
    });

    return {
      totalLength, avgWidth, good, fair, poor, underConstruction, withDivider,
      byType, byZone, bySurface,
      healthPct: roads.length ? Math.round((good / roads.length) * 100) : 0,
    };
  }, [roads]);

  const recentEdits = history.slice(0, 6);
  const poorRoads   = roads.filter(r => r.status === 'Poor');
  const fairRoads   = roads.filter(r => r.status === 'Fair');
  const atRiskRoads = [...poorRoads, ...fairRoads].slice(0, 8);

  const topZones = Object.entries(stats.byZone)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topTypes = Object.entries(stats.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const getTimeAgo = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Condition ring: convert percentages to stroke-dashoffset values for SVG circle
  const CIRCUMFERENCE = 2 * Math.PI * 42; // r=42
  const conditionSegments = [
    { label: 'Good',               count: stats.good,             color: '#10b981', pct: roads.length ? stats.good / roads.length : 0 },
    { label: 'Fair',               count: stats.fair,             color: '#f59e0b', pct: roads.length ? stats.fair / roads.length : 0 },
    { label: 'Poor',               count: stats.poor,             color: '#ef4444', pct: roads.length ? stats.poor / roads.length : 0 },
    { label: 'Under Construction', count: stats.underConstruction, color: '#6366f1', pct: roads.length ? stats.underConstruction / roads.length : 0 },
  ];

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="db-load-spinner" />
          <p>Loading dashboard data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard db2">

      {/* ── Hero Header ── */}
      <div className="db2-hero">
        <div className="db2-hero-left">
          <div className="db2-hero-badge">
            <Zap size={13} /> Live Data
          </div>
          <h1 className="db2-hero-title">
            Road Network Overview
          </h1>
          <p className="db2-hero-sub">
            {activeDataset
              ? <><strong>{activeDataset.name}</strong> · {roads.length.toLocaleString()} roads · {stats.totalLength.toFixed(1)} km</>
              : 'No dataset selected'}
          </p>
        </div>
        <div className="db2-hero-right">
          <div className="db2-health-ring">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
              {(() => {
                let offset = 0;
                return conditionSegments.map((seg, i) => {
                  const dash = seg.pct * CIRCUMFERENCE;
                  const gap  = CIRCUMFERENCE - dash;
                  const el   = (
                    <circle
                      key={i}
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="8"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="butt"
                      transform="rotate(-90 50 50)"
                    />
                  );
                  offset += dash;
                  return el;
                });
              })()}
              <text x="50" y="46" textAnchor="middle" fill="var(--text)" fontSize="16" fontWeight="800">{stats.healthPct}%</text>
              <text x="50" y="60" textAnchor="middle" fill="var(--text-muted)" fontSize="8">Good</text>
            </svg>
          </div>
          <div className="db2-health-legend">
            {conditionSegments.map(s => (
              <div key={s.label} className="db2-legend-item">
                <span className="db2-legend-dot" style={{ background: s.color }} />
                <span className="db2-legend-label">{s.label}</span>
                <span className="db2-legend-val">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="db2-kpi-grid">
        {[
          { icon: Route,        label: 'Total Roads',      value: roads.length.toLocaleString(),         sub: 'in network',           accent: '#2563eb', bg: '#eff6ff' },
          { icon: Ruler,        label: 'Total Length',     value: `${stats.totalLength.toFixed(1)} km`,  sub: 'road coverage',        accent: '#7c3aed', bg: '#f5f3ff' },
          { icon: MapPin,       label: 'Avg. Width',       value: `${stats.avgWidth.toFixed(1)} m`,      sub: 'across all roads',     accent: '#0891b2', bg: '#ecfeff' },
          { icon: CheckCircle2, label: 'Good Condition',   value: stats.good.toLocaleString(),           sub: `${stats.healthPct}% of total`, accent: '#059669', bg: '#ecfdf5' },
          { icon: AlertTriangle,label: 'Needs Repair',     value: stats.poor.toLocaleString(),           sub: 'poor condition',       accent: '#dc2626', bg: '#fff1f2' },
          { icon: Layers,       label: 'With Divider',     value: stats.withDivider.toLocaleString(),    sub: 'roads w/ divider',     accent: '#d97706', bg: '#fffbeb' },
        ].map(({ icon: Icon, label, value, sub, accent, bg }) => (
          <div key={label} className="db2-kpi" style={{ '--kpi-accent': accent, '--kpi-bg': bg }}>
            <div className="db2-kpi-icon">
              <Icon size={20} />
            </div>
            <div className="db2-kpi-body">
              <span className="db2-kpi-value">{value}</span>
              <span className="db2-kpi-label">{label}</span>
              <span className="db2-kpi-sub">{sub}</span>
            </div>
            <div className="db2-kpi-glow" />
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="db2-grid-2">

        {/* Road types */}
        <div className="db2-card">
          <div className="db2-card-header">
            <BarChart3 size={16} />
            <span>Roads by Type</span>
          </div>
          <div className="db2-card-body">
            <div className="db2-bar-list">
              {topTypes.map(([type, count]) => {
                const pct = roads.length ? (count / roads.length) * 100 : 0;
                const color = ROAD_TYPE_COLORS[type] || '#94a3b8';
                return (
                  <div key={type} className="db2-bar-row">
                    <div className="db2-bar-meta">
                      <span className="db2-bar-dot" style={{ background: color }} />
                      <span className="db2-bar-name">{type || 'Unclassified'}</span>
                      <span className="db2-bar-pct">{pct.toFixed(0)}%</span>
                      <span className="db2-bar-count">{count}</span>
                    </div>
                    <div className="db2-bar-track">
                      <div className="db2-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(stats.byType).length === 0 && (
                <p className="db2-empty">No data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Zone breakdown */}
        <div className="db2-card">
          <div className="db2-card-header">
            <MapPin size={16} />
            <span>Top Zones by Road Count</span>
          </div>
          <div className="db2-card-body">
            <div className="db2-zone-list">
              {topZones.map(([zone, count], idx) => {
                const pct = roads.length ? (count / roads.length) * 100 : 0;
                const colors = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706'];
                return (
                  <div key={zone} className="db2-zone-row">
                    <div className="db2-zone-rank" style={{ background: colors[idx] }}>{idx + 1}</div>
                    <div className="db2-zone-info">
                      <span className="db2-zone-name">{zone || 'Unknown'}</span>
                      <div className="db2-bar-track">
                        <div className="db2-bar-fill" style={{ width: `${pct}%`, background: colors[idx] }} />
                      </div>
                    </div>
                    <span className="db2-zone-count">{count}</span>
                  </div>
                );
              })}
              {topZones.length === 0 && <p className="db2-empty">No zone data</p>}
            </div>
          </div>
        </div>

      </div>

      {/* ── Bottom Row ── */}
      <div className="db2-grid-2">

        {/* Roads needing attention */}
        <div className="db2-card">
          <div className="db2-card-header">
            <AlertTriangle size={16} />
            <span>Roads Needing Attention</span>
            {atRiskRoads.length > 0 && (
              <span className="db2-card-badge danger">{atRiskRoads.length}</span>
            )}
          </div>
          <div className="db2-card-body db2-scroll">
            {atRiskRoads.length === 0 ? (
              <div className="db2-empty-state">
                <Shield size={32} style={{ color: 'var(--success)', opacity: 0.7 }} />
                <p>All roads are in good condition</p>
              </div>
            ) : (
              <div className="db2-attention-list">
                {atRiskRoads.map(road => (
                  <div key={road.id} className={`db2-attention-item ${road.status === 'Poor' ? 'poor' : 'fair'}`}>
                    <div className="db2-attention-left">
                      <span
                        className="db2-status-pill"
                        style={{ background: STATUS_COLORS[road.status] + '22', color: STATUS_COLORS[road.status], border: `1px solid ${STATUS_COLORS[road.status]}44` }}
                      >
                        {road.status}
                      </span>
                      <div className="db2-attention-info">
                        <span className="db2-attention-name">{road.name || 'Unnamed Road'}</span>
                        <span className="db2-attention-meta">
                          {[road.zone, road.roadType, road.length ? `${road.length} km` : null].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </div>
                    <button className="db2-view-btn" onClick={() => onViewOnMap(road.id)}>
                      <MapPin size={12} /> View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="db2-card">
          <div className="db2-card-header">
            <Activity size={16} />
            <span>Recent Activity</span>
            {recentEdits.length > 0 && (
              <span className="db2-card-badge primary">{recentEdits.length}</span>
            )}
          </div>
          <div className="db2-card-body db2-scroll">
            {recentEdits.length === 0 ? (
              <div className="db2-empty-state">
                <Clock size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="db2-activity-list">
                {recentEdits.map((entry, idx) => (
                  <div key={entry.id || idx} className="db2-activity-item">
                    <div className="db2-activity-avatar">
                      {(entry.editedBy || 'S')[0].toUpperCase()}
                    </div>
                    <div className="db2-activity-content">
                      <span className="db2-activity-text">
                        <strong>{entry.editedBy || 'System'}</strong>
                        {' '}
                        <span className="db2-activity-field">{entry.fieldName}</span>
                        {' on '}
                        <span className="db2-activity-road">{entry.roadName || '—'}</span>
                      </span>
                      {entry.oldValue !== undefined && entry.newValue !== undefined && entry.fieldName !== 'Created' && (
                        <span className="db2-activity-change">
                          {entry.oldValue || '—'} → {entry.newValue || '—'}
                        </span>
                      )}
                      <span className="db2-activity-time">
                        <Clock size={10} /> {getTimeAgo(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Surface Material ── */}
      {Object.keys(stats.bySurface).length > 0 && (
        <div className="db2-card">
          <div className="db2-card-header">
            <Layers size={16} />
            <span>Surface Material Distribution</span>
          </div>
          <div className="db2-card-body">
            <div className="db2-surface-grid">
              {Object.entries(stats.bySurface)
                .sort(([, a], [, b]) => b - a)
                .map(([mat, count], idx) => {
                  const pct = roads.length ? ((count / roads.length) * 100).toFixed(1) : 0;
                  const surfaceColors = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#64748b'];
                  const color = surfaceColors[idx % surfaceColors.length];
                  return (
                    <div key={mat} className="db2-surface-chip" style={{ '--chip-color': color }}>
                      <div className="db2-surface-bar" style={{ height: `${Math.max(pct, 5)}%`, background: color }} />
                      <span className="db2-surface-pct">{pct}%</span>
                      <span className="db2-surface-count">{count}</span>
                      <span className="db2-surface-name">{mat || 'Unknown'}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
