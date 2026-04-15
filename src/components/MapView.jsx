import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useRoads } from '../context/RoadsContext';
import { ROAD_TYPE_COLORS } from '../data/sampleRoads';
import { Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const SANGLI_CENTER = [16.852, 74.570];

/* ─── Zoom‑responsive line weight ─── */
function getWeightForZoom(z) {
  if (z >= 18) return 5;
  if (z >= 17) return 4;
  if (z >= 16) return 3;
  if (z >= 15) return 2.5;
  if (z >= 14) return 2;
  return 1.5;
}

/* ─── Fly to a selected road ─── */
function FlyToRoad({ road }) {
  const map = useMap();
  useEffect(() => {
    if (road?.geometry?.coordinates?.length) {
      const coords = road.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      map.flyToBounds(coords, { padding: [60, 60], maxZoom: 17, duration: 0.8 });
    }
  }, [road, map]);
  return null;
}

/* ─── GeoJSON roads layer (native Leaflet for performance) ─── */
function RoadsGeoJSONLayer({ roads, filter, selectedRoadId, onSelectRoad }) {
  const map = useMap();
  const layerRef = useRef(null);
  const selectedIdRef = useRef(selectedRoadId);
  const onSelectRef = useRef(onSelectRoad);

  selectedIdRef.current = selectedRoadId;
  onSelectRef.current = onSelectRoad;

  const filteredRoads = useMemo(() => {
    if (filter === 'All') return roads;
    return roads.filter(r => r.roadType === filter);
  }, [roads, filter]);

  const geojsonData = useMemo(() => ({
    type: 'FeatureCollection',
    features: filteredRoads.map(road => ({
      type: 'Feature',
      properties: {
        id: road.id,
        name: road.name || `Road ${road.id}`,
        roadType: road.roadType,
        length: road.length,
        width: road.width,
        status: road.status,
        zone: road.zone,
      },
      geometry: road.geometry,
    })),
  }), [filteredRoads]);

  const makeStyleFn = useCallback(() => {
    const zoom = map.getZoom();
    const w = getWeightForZoom(zoom);
    const selId = selectedIdRef.current;

    return (feature) => {
      const color = ROAD_TYPE_COLORS[feature.properties.roadType] || '#94a3b8';
      const isSelected = feature.properties.id === selId;
      return {
        color: isSelected ? '#2563eb' : color,
        weight: isSelected ? w + 2 : w,
        opacity: isSelected ? 1 : 0.75,
        lineJoin: 'round',
        lineCap: 'round',
        dashArray: feature.properties.status === 'Poor' ? '6 3' : undefined,
      };
    };
  }, [map]);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const layer = L.geoJSON(geojsonData, {
      style: makeStyleFn(),
      onEachFeature: (feature, lyr) => {
        lyr.on('click', () => onSelectRef.current(feature.properties.id));
        const p = feature.properties;
        lyr.bindPopup(`
          <div class="map-popup">
            <strong>${p.name || 'Unnamed Road'}</strong>
            <span>${p.id} · ${p.roadType || 'Unclassified'}</span>
            <span>Length: ${p.length || 'N/A'} km · Width: ${p.width || 'N/A'}m</span>
            <span>Status: ${p.status || 'Unknown'}</span>
            ${p.zone ? `<span>Zone: ${p.zone}</span>` : ''}
          </div>
        `);
      },
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [geojsonData, map, makeStyleFn]);

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setStyle(makeStyleFn());
    }
  }, [selectedRoadId, makeStyleFn]);

  useMapEvents({
    zoomend: () => {
      if (layerRef.current) {
        layerRef.current.setStyle(makeStyleFn());
      }
    },
  });

  return null;
}

/* ─── Main MapView component ─── */
export default function MapView({ selectedRoadId, onSelectRoad }) {
  const { roads, getRoadById } = useRoads();
  const [filter, setFilter] = useState('All');
  const selectedRoad = selectedRoadId ? getRoadById(selectedRoadId) : null;

  const types = useMemo(() => {
    const s = new Set(roads.map(r => r.roadType));
    return ['All', ...Array.from(s)];
  }, [roads]);

  return (
    <div className="map-view">
      {/* Filter bar */}
      <div className="map-toolbar">
        <div className="map-filter-group">
          <Layers size={16} />
          {types.map(t => (
            <button
              key={t}
              className={`map-filter-btn ${filter === t ? 'active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {t !== 'All' && (
                <span className="filter-dot" style={{ background: ROAD_TYPE_COLORS[t] }} />
              )}
              {t || 'Unknown'}
            </button>
          ))}
        </div>
        <div className="map-legend">
          {Object.entries(ROAD_TYPE_COLORS).map(([type, color]) => (
            <span key={type || '_unknown'} className="legend-item">
              <span className="legend-line" style={{ background: color }} />
              {type || 'Unknown'}
            </span>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={SANGLI_CENTER}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          preferCanvas={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <RoadsGeoJSONLayer
            roads={roads}
            filter={filter}
            selectedRoadId={selectedRoadId}
            onSelectRoad={onSelectRoad}
          />

          {selectedRoad && <FlyToRoad road={selectedRoad} />}
        </MapContainer>
      </div>
    </div>
  );
}
