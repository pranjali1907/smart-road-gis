import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useDatasets } from './DatasetContext';
import {
  fetchAllRoads, fetchRoads as fetchRoadsAPI, fetchRoadById as fetchRoadByIdAPI,
  createRoad as apiCreateRoad, updateRoad as apiUpdateRoad, deleteRoad as apiDeleteRoad,
  fetchTrash as apiFetchTrash, restoreFromTrash as apiRestore,
  restoreAllFromTrash as apiRestoreAll, permanentDeleteFromTrash as apiPermDelete,
  emptyTrash as apiEmptyTrash, fetchHistory as apiFetchHistory,
  isServerAvailable, resetServerCache,
} from '../api';
import { ROAD_TYPE_NORMALIZE, DRAINAGE_NORMALIZE, SURFACE_NORMALIZE } from '../data/sampleRoads';

const RoadsContext = createContext(null);

/* ─── Normalization helper ─── */
function normalizeRoad(road) {
  const r = { ...road };
  if (r.roadType) {
    const lower = r.roadType.toLowerCase();
    if (ROAD_TYPE_NORMALIZE[lower]) r.roadType = ROAD_TYPE_NORMALIZE[lower];
  }
  if (r.drainageType) {
    const lower = r.drainageType.toLowerCase();
    if (DRAINAGE_NORMALIZE[lower]) r.drainageType = DRAINAGE_NORMALIZE[lower];
  }
  if (r.surfaceMaterial) {
    const lower = r.surfaceMaterial.toLowerCase();
    if (SURFACE_NORMALIZE[lower]) r.surfaceMaterial = SURFACE_NORMALIZE[lower];
  }
  return r;
}

export function RoadsProvider({ children }) {
  const { activeDatasetId } = useDatasets();

  const [roads, setRoads] = useState([]);
  const [history, setHistory] = useState([]);
  const [trash, setTrash] = useState([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load all roads for the active dataset (used by map + dashboard)
  const loadRoads = useCallback(async () => {
    if (!activeDatasetId) { setRoads([]); return; }
    setLoading(true);
    try {
      const data = await fetchAllRoads(activeDatasetId);
      setRoads((data || []).map(normalizeRoad));
    } catch {
      setRoads([]);
    }
    setLoading(false);
  }, [activeDatasetId]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!activeDatasetId) { setHistory([]); return; }
    const result = await apiFetchHistory({ datasetId: activeDatasetId, limit: 500 });
    setHistory(result.entries || []);
  }, [activeDatasetId]);

  // Load trash — API returns 403 for non-superadmin, silently set empty
  const loadTrash = useCallback(async () => {
    if (!activeDatasetId) { setTrash([]); return; }
    try {
      const data = await apiFetchTrash(activeDatasetId);
      setTrash(Array.isArray(data) ? data : []);
    } catch {
      setTrash([]);
    }
  }, [activeDatasetId]);

  // Check server on mount, then poll every 15 s
  useEffect(() => {
    const check = () => { resetServerCache(); isServerAvailable().then(setServerOnline); };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  // Reload everything when dataset changes
  useEffect(() => {
    if (activeDatasetId) {
      loadRoads();
      loadHistory();
      loadTrash();
    } else {
      setRoads([]);
      setHistory([]);
      setTrash([]);
    }
  }, [activeDatasetId, loadRoads, loadHistory, loadTrash]);

  const getRoadById = useCallback((id) => {
    return roads.find(r => r.id === id) || null;
  }, [roads]);

  const addRoad = useCallback(async (roadData, editedBy) => {
    if (!activeDatasetId) return null;
    const result = await apiCreateRoad({ ...roadData, datasetId: activeDatasetId });
    if (result.success) {
      await loadRoads();
      await loadHistory();
    }
    return result.road || null;
  }, [activeDatasetId, loadRoads, loadHistory]);

  const updateRoad = useCallback(async (id, updates, editedBy) => {
    if (!activeDatasetId) return;
    await apiUpdateRoad(activeDatasetId, id, updates);
    await loadRoads();
    await loadHistory();
  }, [activeDatasetId, loadRoads, loadHistory]);

  const deleteRoad = useCallback(async (id, editedBy) => {
    if (!activeDatasetId) return;
    await apiDeleteRoad(activeDatasetId, id);
    await loadRoads();
    await loadHistory();
    await loadTrash();
  }, [activeDatasetId, loadRoads, loadHistory, loadTrash]);

  const restoreRoad = useCallback(async (id, restoredBy) => {
    if (!activeDatasetId) return;
    await apiRestore(activeDatasetId, id);
    await loadRoads();
    await loadHistory();
    await loadTrash();
  }, [activeDatasetId, loadRoads, loadHistory, loadTrash]);

  const permanentDeleteRoad = useCallback(async (id, deletedBy) => {
    if (!activeDatasetId) return;
    await apiPermDelete(activeDatasetId, id);
    await loadHistory();
    await loadTrash();
  }, [activeDatasetId, loadHistory, loadTrash]);

  const restoreAllTrash = useCallback(async (restoredBy) => {
    if (!activeDatasetId) return;
    await apiRestoreAll(activeDatasetId);
    await loadRoads();
    await loadHistory();
    await loadTrash();
  }, [activeDatasetId, loadRoads, loadHistory, loadTrash]);

  const emptyTrashAll = useCallback(async (deletedBy) => {
    if (!activeDatasetId) return;
    await apiEmptyTrash(activeDatasetId);
    await loadHistory();
    await loadTrash();
  }, [activeDatasetId, loadHistory, loadTrash]);

  const searchRoads = useCallback((query) => {
    if (!query) return roads;
    const q = query.toLowerCase();
    return roads.filter(r =>
      r.id?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.zone?.toLowerCase().includes(q) ||
      r.roadType?.toLowerCase().includes(q)
    );
  }, [roads]);

  return (
    <RoadsContext.Provider value={{
      roads, history, trash, serverOnline, loading,
      getRoadById, addRoad, updateRoad, deleteRoad,
      restoreRoad, permanentDeleteRoad, restoreAllTrash, emptyTrash: emptyTrashAll,
      searchRoads, refreshRoads: loadRoads, refreshHistory: loadHistory, refreshTrash: loadTrash,
    }}>
      {children}
    </RoadsContext.Provider>
  );
}

export function useRoads() {
  const ctx = useContext(RoadsContext);
  if (!ctx) throw new Error('useRoads must be used within RoadsProvider');
  return ctx;
}
