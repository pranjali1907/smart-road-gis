import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMapEvents, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { ROAD_TYPES, SURFACE_MATERIALS, DRAINAGE_TYPES, ROAD_STATUSES, ZONES, WARDS } from '../data/sampleRoads';
import { X, Plus, Route, Undo2, MousePointer2, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const SANGLI_CENTER = [16.855, 74.570];

const dotIcon = L.divIcon({
  className: 'draw-point-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Invalidate map size after mount so it fills the container correctly
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

// Registers clicks on the map to add points
function DrawHandler({ onPointAdded }) {
  useMapEvents({
    click(e) {
      onPointAdded([e.latlng.lng, e.latlng.lat]);
    },
  });
  return null;
}

const EMPTY = {
  name: '', fromChainage: 0, toChainage: 0, length: 0, width: 0,
  roadType: '', contractor: '', constructionDate: '', maintenanceDate: '',
  lastRepair: '', surfaceMaterial: '', drainageType: '', dividerOnRoad: 'No',
  numberOfLanes: 2, zone: '', wardNo: '',
  remarks: '', status: 'Good',
};

export default function AddRoadModal({ onClose }) {
  const { addRoad } = useRoads();
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [drawnPoints, setDrawnPoints] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'map'

  const handleChange = (field, value) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleAddPoint = useCallback((coord) => {
    setDrawnPoints(prev => [...prev, [
      parseFloat(coord[0].toFixed(6)),
      parseFloat(coord[1].toFixed(6)),
    ]]);
  }, []);

  const polylinePositions = drawnPoints.map(([lng, lat]) => [lat, lng]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const roadData = {
      ...form,
      geometry: drawnPoints.length >= 2
        ? { type: 'LineString', coordinates: drawnPoints }
        : { type: 'LineString', coordinates: [] },
    };
    await addRoad(roadData, currentUser?.username || 'admin');
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-road-modal animate-scale-in" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-title">
            <Route size={20} />
            <h2>Add New Road</h2>
          </div>
          <button className="btn-icon" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {/* ── Tabs ── */}
        <div className="add-road-tabs">
          <button
            type="button"
            className={`add-road-tab ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => setActiveTab('form')}
          >
            📋 Road Attributes
          </button>
          <button
            type="button"
            className={`add-road-tab ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            🗺️ Draw on Map
            {drawnPoints.length > 0 && (
              <span className="tab-badge">{drawnPoints.length} pts</span>
            )}
          </button>
        </div>

        {/* ── Map Tab ── */}
        <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Map instructions */}
          <div className="draw-instructions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', background: 'var(--primary-50)', color: 'var(--primary)', fontSize: '0.82rem', borderBottom: '1px solid var(--primary-200)', flexShrink: 0 }}>
            <MousePointer2 size={14} />
            <span><strong>Click on the map</strong> to place road points. Connect at least 2 points.</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <button type="button" className="btn-secondary btn-sm"
                onClick={() => setDrawnPoints(p => p.slice(0, -1))}
                disabled={drawnPoints.length === 0}>
                <Undo2 size={13} /> Undo
              </button>
              <button type="button" className="btn-secondary btn-sm"
                onClick={() => setDrawnPoints([])}
                disabled={drawnPoints.length === 0}>
                Clear
              </button>
            </div>
          </div>

          {/* Map — always mounted so Leaflet initialises properly */}
          <div style={{ flex: 1, minHeight: '400px', position: 'relative' }}>
            <MapContainer
              key="add-road-map"
              center={SANGLI_CENTER}
              zoom={14}
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
              zoomControl={true}
            >
              <MapResizer />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DrawHandler onPointAdded={handleAddPoint} />
              {drawnPoints.map(([lng, lat], idx) => (
                <Marker key={idx} position={[lat, lng]} icon={dotIcon} />
              ))}
              {polylinePositions.length >= 2 && (
                <Polyline
                  positions={polylinePositions}
                  pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9 }}
                />
              )}
            </MapContainer>
          </div>

          {/* Point count bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', fontSize: '0.82rem', color: drawnPoints.length >= 2 ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}>
            <MapPin size={14} />
            <span>
              {drawnPoints.length === 0 && 'No points placed yet — click the map above'}
              {drawnPoints.length === 1 && '1 point placed — place at least 1 more'}
              {drawnPoints.length >= 2 && `✓ ${drawnPoints.length} points placed — road geometry ready`}
            </span>
            {drawnPoints.length >= 2 && (
              <button type="button" className="btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setActiveTab('form')}>
                Next: Fill Attributes →
              </button>
            )}
          </div>
        </div>

        {/* ── Form Tab ── */}
        <form
          onSubmit={handleSubmit}
          style={{ display: activeTab === 'form' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          {drawnPoints.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'var(--success-light)', color: 'var(--success)', fontSize: '0.8rem', borderBottom: '1px solid rgba(16,185,129,0.2)', flexShrink: 0 }}>
              <MapPin size={13} />
              Road geometry: <strong>{drawnPoints.length} points</strong> drawn
              <button type="button" style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }} onClick={() => setActiveTab('map')}>
                ← Edit path
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
            <div className="modal-grid">

              <div className="form-group full">
                <label>Road Name</label>
                <input type="text" value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="Enter road name" />
              </div>

              <div className="form-group">
                <label>Road Type</label>
                <select value={form.roadType} onChange={e => handleChange('roadType', e.target.value)}>
                  <option value="">— Select —</option>
                  {ROAD_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => handleChange('status', e.target.value)}>
                  {ROAD_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Zone</label>
                <select value={form.zone} onChange={e => handleChange('zone', e.target.value)}>
                  <option value="">— Select —</option>
                  {ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Ward No.</label>
                <select value={form.wardNo} onChange={e => handleChange('wardNo', e.target.value)}>
                  <option value="">— Select —</option>
                  {WARDS.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>From Chainage</label>
                <input type="number" step="0.1" value={form.fromChainage}
                  onChange={e => handleChange('fromChainage', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>To Chainage</label>
                <input type="number" step="0.1" value={form.toChainage}
                  onChange={e => handleChange('toChainage', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>Length (km)</label>
                <input type="number" step="0.01" value={form.length}
                  onChange={e => handleChange('length', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>Width (m)</label>
                <input type="number" step="0.1" value={form.width}
                  onChange={e => handleChange('width', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>Divider on Road</label>
                <select value={form.dividerOnRoad} onChange={e => handleChange('dividerOnRoad', e.target.value)}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="form-group">
                <label>Number of Lanes</label>
                <input type="number" value={form.numberOfLanes}
                  onChange={e => handleChange('numberOfLanes', parseInt(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>Surface Material</label>
                <select value={form.surfaceMaterial} onChange={e => handleChange('surfaceMaterial', e.target.value)}>
                  <option value="">— Select —</option>
                  {SURFACE_MATERIALS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Drainage Type</label>
                <select value={form.drainageType} onChange={e => handleChange('drainageType', e.target.value)}>
                  <option value="">— Select —</option>
                  {DRAINAGE_TYPES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Contractor</label>
                <input type="text" value={form.contractor}
                  onChange={e => handleChange('contractor', e.target.value)}
                  placeholder="Contractor name" />
              </div>

              <div className="form-group">
                <label>Year of Construction</label>
                <input type="text" value={form.constructionDate}
                  onChange={e => handleChange('constructionDate', e.target.value)}
                  placeholder="e.g. 2023" />
              </div>

              <div className="form-group">
                <label>Last Repair</label>
                <input type="text" value={form.lastRepair}
                  onChange={e => handleChange('lastRepair', e.target.value)}
                  placeholder="e.g. 2024" />
              </div>

              <div className="form-group full">
                <label>Remarks</label>
                <textarea rows={2} value={form.remarks}
                  onChange={e => handleChange('remarks', e.target.value)}
                  placeholder="Additional notes..." />
              </div>

            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Plus size={16} />
              {saving ? 'Saving...' : 'Add Road'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
