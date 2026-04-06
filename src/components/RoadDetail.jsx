import { useState, useEffect } from 'react';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { ROAD_TYPES, SURFACE_MATERIALS, DRAINAGE_TYPES, ROAD_STATUSES, ZONES, ROAD_TYPE_COLORS, STATUS_COLORS, WARDS } from '../data/sampleRoads';
import {
  X, Edit3, Save, MapPin, Route, Ruler, Calendar, User, Wrench,
  Droplets, Construction, FileText, Check, Hash, Shield
} from 'lucide-react';

export default function RoadDetail({ roadId, onClose }) {
  const { getRoadById, updateRoad } = useRoads();
  const { isAdmin, currentUser, isAuthenticated } = useAuth();
  const road = getRoadById(roadId);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (road) {
      setForm({ ...road });
      setEditing(false);
      setSaved(false);
    }
  }, [road]);

  if (!road) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const { id, geometry, ...updates } = form;
    updateRoad(roadId, updates, currentUser?.username || 'unknown');
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    setForm({ ...road });
    setEditing(false);
  };

  // Both users and admins can edit — everyone who is authenticated
  const canEdit = isAuthenticated;

  const renderField = (label, field, options = {}) => {
    const { type = 'text', choices, icon: Icon } = options;
    const value = editing ? (form[field] ?? '') : (road[field] ?? '');

    return (
      <div className="detail-field">
        <label className="detail-label">
          {Icon && <Icon size={14} />}
          {label}
        </label>
        {editing ? (
          choices ? (
            <select
              className="detail-input"
              value={value}
              onChange={e => handleChange(field, e.target.value)}
            >
              <option value="">— Select —</option>
              {choices.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : type === 'number' ? (
            <input
              className="detail-input"
              type="number"
              step="0.1"
              value={value}
              onChange={e => handleChange(field, parseFloat(e.target.value) || 0)}
            />
          ) : type === 'date' ? (
            <input
              className="detail-input"
              type="date"
              value={value}
              onChange={e => handleChange(field, e.target.value)}
            />
          ) : type === 'textarea' ? (
            <textarea
              className="detail-input detail-textarea"
              value={value}
              onChange={e => handleChange(field, e.target.value)}
              rows={3}
            />
          ) : (
            <input
              className="detail-input"
              type="text"
              value={value}
              onChange={e => handleChange(field, e.target.value)}
            />
          )
        ) : (
          <span className="detail-value">{value || '—'}</span>
        )}
      </div>
    );
  };

  return (
    <div className="detail-panel animate-slide-right">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-title-group">
          <span className="detail-id">{road.id}</span>
          <h2 className="detail-title">{road.name}</h2>
          <div className="detail-badges">
            <span className="type-badge" style={{ '--badge-color': ROAD_TYPE_COLORS[road.roadType] || '#94a3b8' }}>
              {road.roadType}
            </span>
            <span className="status-badge" style={{ '--badge-color': STATUS_COLORS[road.status] || '#94a3b8' }}>
              {road.status}
            </span>
          </div>
        </div>
        <div className="detail-header-actions">
          {/* Both users and admins can edit */}
          {canEdit && !editing && (
            <button className="btn-icon" onClick={() => setEditing(true)} title="Edit Attributes">
              <Edit3 size={16} />
            </button>
          )}
          {editing && (
            <>
              <button className="btn-icon save" onClick={handleSave} title="Save">
                <Save size={16} />
              </button>
              <button className="btn-icon cancel" onClick={handleCancel} title="Cancel">
                <X size={16} />
              </button>
            </>
          )}
          {!editing && (
            <button className="btn-icon" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Editing indicator */}
      {editing && (
        <div className="detail-editing-bar">
          <Edit3 size={14} />
          Editing as <strong>{currentUser?.username}</strong>
          <span className="editing-role">({isAdmin ? 'Admin' : 'User'})</span>
        </div>
      )}

      {/* Saved toast */}
      {saved && (
        <div className="detail-toast animate-fade-in">
          <Check size={16} /> Changes saved — tracked in Edit History
        </div>
      )}

      {/* Fields arranged in sections */}
      <div className="detail-body">
        <div className="detail-section">
          <h4 className="detail-section-title">General Information</h4>
          {renderField('Road Name', 'name', { icon: Route })}
          {renderField('Serial No.', 'srNo', { type: 'number', icon: Hash })}
          {renderField('Road Type', 'roadType', { icon: Route, choices: ROAD_TYPES })}
          {renderField('Status', 'status', { icon: Construction, choices: ROAD_STATUSES })}
          {renderField('Zone', 'zone', { icon: MapPin, choices: ZONES })}
          {renderField('Ward No.', 'wardNo', { icon: Shield, choices: WARDS })}
        </div>

        <div className="detail-section">
          <h4 className="detail-section-title">Dimensions & Chainage</h4>
          {renderField('From Chainage (km)', 'fromChainage', { type: 'number', icon: Ruler })}
          {renderField('To Chainage (km)', 'toChainage', { type: 'number', icon: Ruler })}
          {renderField('Total Length (km)', 'length', { type: 'number', icon: Ruler })}
          {renderField('Width (m)', 'width', { type: 'number', icon: Ruler })}
        </div>

        <div className="detail-section">
          <h4 className="detail-section-title">Construction & Maintenance</h4>
          {renderField('Surface Material', 'surfaceMaterial', { icon: Wrench, choices: SURFACE_MATERIALS })}
          {renderField('Drainage Type', 'drainageType', { icon: Droplets, choices: DRAINAGE_TYPES })}
          {renderField('Contractor', 'contractor', { icon: User })}
          {renderField('Year of Construction', 'constructionDate', { icon: Calendar })}
          {renderField('Maintenance', 'maintenanceDate', { icon: Calendar })}
          {renderField('Last Repair', 'lastRepair', { icon: Calendar })}
        </div>

        <div className="detail-section">
          <h4 className="detail-section-title">Remarks</h4>
          {renderField('Remarks', 'remarks', { type: 'textarea', icon: FileText })}
        </div>
      </div>
    </div>
  );
}
