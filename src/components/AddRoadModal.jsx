import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMapEvents, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { ROAD_TYPES, SURFACE_MATERIALS, DRAINAGE_TYPES, ROAD_STATUSES, ZONES, WARDS } from '../data/sampleRoads';
import { X, Plus, Route, Trash2, Undo2, MousePointer2, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const SANGLI_CENTER = [16.855, 74.570];

// Custom dot icon for placed points
const dotIcon = L.divIcon({
  className: 'draw-point-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Click handler component for drawing on map
function DrawHandler({ onPointAdded }) {
  useMapEvents({
    click(e) {
      onPointAdded([e.latlng.lng, e.latlng.lat]);
    },
  });
  return null;
}

const EMPTY = {
  name: '',
  fromChainage: 0,
  toChainage: 0,
  length: 0,
  width: 0,
  roadType: '',
  contractor: '',
  constructionDate: '',
  maintenanceDate: '',
  lastRepair: '',
  surfaceMaterial: '',
  drainageType: '',
  zone: '',
  wardNo: '',
  remarks: '',
  status: 'Good',
};

export default function AddRoadModal({ onClose }) {
  const { addRoad } = useRoads();
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const [drawnPoints, setDrawnPoints] = useState([]); // [[lng, lat], ...]
  const [step, setStep] = useState(1); // 1 = draw, 2 = fill attributes

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleAddPoint = useCallback((coord) => {
    setDrawnPoints(prev => [...prev, [
      parseFloat(coord[0].toFixed(6)),
      parseFloat(coord[1].toFixed(6))
    ]]);
  }, []);

  const handleUndoPoint = () => {
    setDrawnPoints(prev => prev.slice(0, -1));
  };

  const handleClearPoints = () => {
    setDrawnPoints([]);
  };

  const handleNextStep = () => {
    if (drawnPoints.length < 2) {
      return;
    }
    setStep(2);
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const validate = () => {
    const errs = {};
    if (drawnPoints.length < 2) errs.geometry = 'Draw at least 2 points on the map';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const roadData = {
      ...form,
      geometry: {
        type: 'LineString',
        coordinates: drawnPoints,
      },
    };
    addRoad(roadData, currentUser?.username || 'admin');
    onClose();
  };

  // Convert drawn points to map format [lat, lng]
  const polylinePositions = drawnPoints.map(([lng, lat]) => [lat, lng]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Route size={20} />
            <h2>Add New Road</h2>
            <div className="step-indicator">
              <span className={`step-badge ${step === 1 ? 'active' : 'done'}`}>1. Draw</span>
              <span className="step-arrow">→</span>
              <span className={`step-badge ${step === 2 ? 'active' : ''}`}>2. Attributes</span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {step === 1 ? (
          /* STEP 1: Draw road on map */
          <div className="modal-body draw-step">
            <div className="draw-instructions">
              <MousePointer2 size={16} />
              <span>
                <strong>Click on the map</strong> to trace the road path point by point.
                Place at least 2 points. Follow the actual road on the map.
              </span>
            </div>

            <div className="draw-map-container">
              <MapContainer
                center={SANGLI_CENTER}
                zoom={14}
                style={{ width: '100%', height: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <DrawHandler onPointAdded={handleAddPoint} />

                {/* Show placed points */}
                {drawnPoints.map(([lng, lat], idx) => (
                  <Marker
                    key={idx}
                    position={[lat, lng]}
                    icon={dotIcon}
                  />
                ))}

                {/* Show line connecting points */}
                {polylinePositions.length >= 2 && (
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 4,
                      opacity: 0.9,
                    }}
                  />
                )}
              </MapContainer>
            </div>

            <div className="draw-controls">
              <div className="draw-info">
                <MapPin size={14} />
                <span>{drawnPoints.length} point{drawnPoints.length !== 1 ? 's' : ''} placed</span>
                {drawnPoints.length < 2 && (
                  <span className="draw-hint">— need at least 2</span>
                )}
              </div>
              <div className="draw-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleUndoPoint}
                  disabled={drawnPoints.length === 0}
                >
                  <Undo2 size={14} /> Undo
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearPoints}
                  disabled={drawnPoints.length === 0}
                >
                  <Trash2 size={14} /> Clear
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNextStep}
                  disabled={drawnPoints.length < 2}
                >
                  Next: Attributes →
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: Fill attributes */
          <form onSubmit={handleSubmit} className="modal-body">
            <div className="draw-preview-bar">
              <MapPin size={14} />
              <span>Road geometry: <strong>{drawnPoints.length} points</strong> drawn on map</span>
              <button type="button" className="btn-link" onClick={handleBackStep}>
                ← Edit path
              </button>
            </div>

            <div className="modal-grid">
              <div className="form-group full">
                <label>Road Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="Enter road name (optional)"
                />
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
                <label>From Chainage</label>
                <input type="number" step="0.1" value={form.fromChainage} onChange={e => handleChange('fromChainage', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>To Chainage</label>
                <input type="number" step="0.1" value={form.toChainage} onChange={e => handleChange('toChainage', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>Total Length</label>
                <input type="number" step="0.1" value={form.length} onChange={e => handleChange('length', parseFloat(e.target.value) || 0)} />
              </div>

              <div className="form-group">
                <label>Width (m)</label>
                <input type="number" step="0.1" value={form.width} onChange={e => handleChange('width', parseFloat(e.target.value) || 0)} />
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
                <label>Contractor</label>
                <input type="text" value={form.contractor} onChange={e => handleChange('contractor', e.target.value)} placeholder="Contractor name" />
              </div>

              <div className="form-group">
                <label>Year of Construction</label>
                <input type="text" value={form.constructionDate} onChange={e => handleChange('constructionDate', e.target.value)} placeholder="e.g. 2023" />
              </div>

              <div className="form-group">
                <label>Last Repair</label>
                <input type="text" value={form.lastRepair} onChange={e => handleChange('lastRepair', e.target.value)} placeholder="e.g. 2024" />
              </div>

              <div className="form-group full">
                <label>Remarks</label>
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={e => handleChange('remarks', e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={handleBackStep}>← Back</button>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">
                <Plus size={16} /> Add Road
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
