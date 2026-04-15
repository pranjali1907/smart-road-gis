import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchDatasets, createDataset as apiCreateDataset, deleteDataset as apiDeleteDataset, setDefaultDataset as apiSetDefault } from '../api';

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  const [datasets, setDatasets] = useState([]);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load datasets on mount
  const loadDatasets = useCallback(async () => {
    setLoading(true);
    const list = await fetchDatasets();
    setDatasets(list);

    // Auto-select: stored preference > default > first
    const stored = localStorage.getItem('smartroad_active_dataset');
    if (stored && list.find(d => d.id === parseInt(stored))) {
      setActiveDatasetId(parseInt(stored));
    } else {
      const def = list.find(d => d.isDefault);
      if (def) setActiveDatasetId(def.id);
      else if (list.length > 0) setActiveDatasetId(list[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  // Persist active dataset choice
  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem('smartroad_active_dataset', String(activeDatasetId));
    }
  }, [activeDatasetId]);

  const switchDataset = useCallback((id) => {
    setActiveDatasetId(id);
  }, []);

  const createNewDataset = useCallback(async (name, description) => {
    const result = await apiCreateDataset(name, description);
    if (result.success) {
      await loadDatasets();
      return result.dataset;
    }
    return null;
  }, [loadDatasets]);

  const removeDataset = useCallback(async (id) => {
    const result = await apiDeleteDataset(id);
    if (result.success) {
      if (activeDatasetId === id) {
        setActiveDatasetId(null);
      }
      await loadDatasets();
    }
    return result;
  }, [activeDatasetId, loadDatasets]);

  const setDefault = useCallback(async (id) => {
    await apiSetDefault(id);
    await loadDatasets();
  }, [loadDatasets]);

  const activeDataset = datasets.find(d => d.id === activeDatasetId) || null;

  return (
    <DatasetContext.Provider value={{
      datasets,
      activeDatasetId,
      activeDataset,
      loading,
      switchDataset,
      createNewDataset,
      removeDataset,
      setDefault,
      refreshDatasets: loadDatasets,
    }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDatasets() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDatasets must be used within DatasetProvider');
  return ctx;
}
