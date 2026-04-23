import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useRoads } from '../context/RoadsContext';
import { ROAD_TYPE_COLORS } from '../data/sampleRoads';
import { Layers, Image as ImageIcon, Eye, EyeOff, Globe, Satellite } from 'lucide-react';
import { fetchImagery, getImageryFileUrl } from '../api';
import 'leaflet/dist/leaflet.css';

/* ── Base tile layers ───────────────────────────────────────────── */
const BASE_LAYERS = [
  {
    id: 'street',
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community',
    maxZoom: 19,
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    // Satellite base
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // Labels overlay added separately
    labelsUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
];

/* ── Swaps base tile layer reactively ──────────────────────────── */
function DynamicBaseLayer({ layerId }) {
  const map = useMap();
  const tileRef = useRef(null);
  const labelsRef = useRef(null);

  useEffect(() => {
    const layer = BASE_LAYERS.find(l => l.id === layerId) || BASE_LAYERS[0];
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    if (labelsRef.current) { map.removeLayer(labelsRef.current); labelsRef.current = null; }

    const tile = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      maxZoom: layer.maxZoom,
      tileSize: 256,
    });
    tile.addTo(map);
    tile.setZIndex(0);
    tileRef.current = tile;

    if (layer.labelsUrl) {
      const labels = L.tileLayer(layer.labelsUrl, { opacity: 0.85, tileSize: 256 });
      labels.addTo(map);
      labels.setZIndex(1);
      labelsRef.current = labels;
    }

    return () => {
      if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
      if (labelsRef.current) { map.removeLayer(labelsRef.current); labelsRef.current = null; }
    };
  }, [layerId, map]);

  return null;
}

const SANGLI_CENTER = [16.852, 74.570];

/* ─── Zoom-responsive line weight ─── */
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

/* ─── GeoTIFF imagery layer ─── */
function GeoTIFFLayer({ imagery, visible }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!visible || !imagery?.canRender) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const url = getImageryFileUrl(imagery.id);

    // Dynamically import georaster + georaster-layer-for-leaflet
    Promise.all([
      import('georaster'),
      import('georaster-layer-for-leaflet'),
    ]).then(([{ default: parseGeoraster }, { default: GeoRasterLayer }]) => {
      if (cancelled) return;
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(buf => parseGeoraster(buf))
        .then(georaster => {
          if (cancelled) return;
          if (layerRef.current) map.removeLayer(layerRef.current);
          const layer = new GeoRasterLayer({
            georaster,
            opacity: imagery.opacity ?? 0.7,
            resolution: 128,
          });
          layer.addTo(map);
          layerRef.current = layer;
        })
        .catch(err => console.warn('GeoTIFF load failed:', err));
    }).catch(err => console.warn('georaster import failed:', err));

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [imagery, visible, map]);

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
    if (layerRef.current) map.removeLayer(layerRef.current);
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
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [geojsonData, map, makeStyleFn]);

  useEffect(() => {
    if (layerRef.current) layerRef.current.setStyle(makeStyleFn());
  }, [selectedRoadId, makeStyleFn]);

  useMapEvents({
    zoomend: () => { if (layerRef.current) layerRef.current.setStyle(makeStyleFn()); },
  });

  return null;
}

/* ── Main MapView component ────────────────────────────────── */
export default function MapView({ selectedRoadId, onSelectRoad }) {
  const { roads, getRoadById } = useRoads();
  const [filter, setFilter] = useState('All');
  const [baseLayerId, setBaseLayerId] = useState('street');
  const [imageryList, setImageryList] = useState([]);
  const [imageryVisibility, setImageryVisibility] = useState({}); // { [id]: bool }
  const [showImageryPanel, setShowImageryPanel] = useState(false);
  const selectedRoad = selectedRoadId ? getRoadById(selectedRoadId) : null;

  // Load imagery list on mount
  useEffect(() => {
    fetchImagery().then(list => {
      setImageryList(list);
      // Default visibility from DB
      const vis = {};
      list.forEach(img => { vis[img.id] = img.visible !== false; });
      setImageryVisibility(vis);
    });
  }, []);

  const types = useMemo(() => {
    const s = new Set(roads.map(r => r.roadType));
    return ['All', ...Array.from(s)];
  }, [roads]);

  const renderableImagery = imageryList.filter(img => img.canRender);
  const nonRenderableImagery = imageryList.filter(img => !img.canRender);

  return (
    <div className="map-view">
      {/* Toolbar */}
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

        <div className="map-toolbar-right">
          {/* Base layer switcher */}
          <div className="base-layer-switcher">
            {BASE_LAYERS.map(l => (
              <button
                key={l.id}
                className={`base-layer-btn ${baseLayerId === l.id ? 'active' : ''}`}
                onClick={() => setBaseLayerId(l.id)}
                title={`Switch to ${l.label} view`}
              >
                {l.id === 'street' ? <Globe size={12} /> : <Satellite size={12} />}
                {l.label}
              </button>
            ))}
          </div>
          {/* Imagery toggle button */}
          {imageryList.length > 0 && (
            <button
              className={`map-filter-btn ${showImageryPanel ? 'active' : ''}`}
              onClick={() => setShowImageryPanel(v => !v)}
              title="Toggle imagery layers"
            >
              <ImageIcon size={14} />
              Imagery ({imageryList.length})
            </button>
          )}

          <div className="map-legend">
            {Object.entries(ROAD_TYPE_COLORS).map(([type, color]) => (
              <span key={type || '_unknown'} className="legend-item">
                <span className="legend-line" style={{ background: color }} />
                {type || 'Unknown'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Imagery panel */}
      {showImageryPanel && (
        <div className="imagery-panel">
          <div className="imagery-panel-title">
            <ImageIcon size={14} /> Imagery Layers
          </div>
          {renderableImagery.map(img => (
            <div key={img.id} className="imagery-layer-row">
              <button
                className="imagery-vis-btn"
                onClick={() => setImageryVisibility(v => ({ ...v, [img.id]: !v[img.id] }))}
                title={imageryVisibility[img.id] ? 'Hide' : 'Show'}
              >
                {imageryVisibility[img.id] ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <span className="imagery-layer-name">{img.name}</span>
              <span className="imagery-layer-type">.tif</span>
            </div>
          ))}
          {nonRenderableImagery.map(img => (
            <div key={img.id} className="imagery-layer-row imagery-ecw">
              <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="imagery-layer-name">{img.name}</span>
              <span className="imagery-layer-type ecw">ECW — open in QGIS</span>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={SANGLI_CENTER}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          preferCanvas={true}
        >
          {/* Dynamic base layer — swaps reactively */}
          <DynamicBaseLayer layerId={baseLayerId} />

          {/* GeoTIFF imagery layers — rendered below road lines */}
          {renderableImagery.map(img => (
            <GeoTIFFLayer
              key={img.id}
              imagery={img}
              visible={!!imageryVisibility[img.id]}
            />
          ))}

          {/* Road lines */}
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
