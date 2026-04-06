import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { INITIAL_ROADS } from '../data/sampleRoads';

const RoadsContext = createContext(null);

// Bump this when INITIAL_ROADS changes to force reload from fresh data
const DATA_VERSION = 'v4-gpkg-2652';

function getStoredRoads() {
  try {
    const storedVersion = localStorage.getItem('smartroad_data_version');
    if (storedVersion !== DATA_VERSION) {
      // Data schema or dataset changed — reset to fresh data
      localStorage.removeItem('smartroad_roads');
      localStorage.setItem('smartroad_data_version', DATA_VERSION);
      return INITIAL_ROADS;
    }
    const stored = localStorage.getItem('smartroad_roads');
    return stored ? JSON.parse(stored) : INITIAL_ROADS;
  } catch {
    return INITIAL_ROADS;
  }
}

function getStoredHistory() {
  try {
    const stored = localStorage.getItem('smartroad_history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function RoadsProvider({ children }) {
  const [roads, setRoads] = useState(getStoredRoads);
  const [history, setHistory] = useState(getStoredHistory);

  useEffect(() => {
    localStorage.setItem('smartroad_roads', JSON.stringify(roads));
  }, [roads]);

  useEffect(() => {
    localStorage.setItem('smartroad_history', JSON.stringify(history));
  }, [history]);

  const addHistoryEntry = useCallback((roadId, roadName, fieldName, oldValue, newValue, editedBy) => {
    const entry = {
      id: Date.now() + Math.random(),
      roadId,
      roadName,
      fieldName,
      oldValue: String(oldValue ?? ''),
      newValue: String(newValue ?? ''),
      editedBy,
      timestamp: new Date().toISOString()
    };
    setHistory(prev => [entry, ...prev]);
  }, []);

  const getRoadById = useCallback((id) => {
    return roads.find(r => r.id === id) || null;
  }, [roads]);

  const addRoad = useCallback((roadData, editedBy) => {
    const newId = `RD-${String(roads.length + 1).padStart(3, '0')}`;
    // Ensure unique ID
    let id = newId;
    let counter = roads.length + 1;
    while (roads.find(r => r.id === id)) {
      counter++;
      id = `RD-${String(counter).padStart(3, '0')}`;
    }
    const newRoad = { ...roadData, id };
    setRoads(prev => [...prev, newRoad]);
    addHistoryEntry(id, roadData.name, 'Created', '', 'New road added', editedBy);
    return newRoad;
  }, [roads, addHistoryEntry]);

  const updateRoad = useCallback((id, updates, editedBy) => {
    setRoads(prev => {
      const road = prev.find(r => r.id === id);
      if (!road) return prev;

      // Log each changed field individually
      Object.keys(updates).forEach(field => {
        if (field === 'geometry' || field === 'id') return;
        const oldVal = road[field];
        const newVal = updates[field];
        if (String(oldVal) !== String(newVal)) {
          addHistoryEntry(id, road.name, field, oldVal, newVal, editedBy);
        }
      });

      return prev.map(r => r.id === id ? { ...r, ...updates } : r);
    });
  }, [addHistoryEntry]);

  const deleteRoad = useCallback((id, editedBy) => {
    const road = roads.find(r => r.id === id);
    if (road) {
      addHistoryEntry(id, road.name, 'Deleted', road.name, 'Road removed', editedBy);
    }
    setRoads(prev => prev.filter(r => r.id !== id));
  }, [roads, addHistoryEntry]);

  const searchRoads = useCallback((query) => {
    if (!query) return roads;
    const q = query.toLowerCase();
    return roads.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.zone.toLowerCase().includes(q) ||
      r.roadType.toLowerCase().includes(q)
    );
  }, [roads]);

  const getNextId = useCallback(() => {
    let counter = roads.length + 1;
    let id = `RD-${String(counter).padStart(3, '0')}`;
    while (roads.find(r => r.id === id)) {
      counter++;
      id = `RD-${String(counter).padStart(3, '0')}`;
    }
    return id;
  }, [roads]);

  return (
    <RoadsContext.Provider value={{
      roads,
      history,
      getRoadById,
      addRoad,
      updateRoad,
      deleteRoad,
      searchRoads,
      getNextId,
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
