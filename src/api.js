/**
 * API client — connects to the Smart Road GIS backend.
 * All requests include JWT token for authentication.
 */

const API_BASE = '/api';


/* ─── Token Management ─── */

export function getToken() {
  return localStorage.getItem('smartroad_token') || sessionStorage.getItem('smartroad_token') || '';
}

export function setToken(token, remember = false) {
  if (remember) {
    localStorage.setItem('smartroad_token', token);
    sessionStorage.removeItem('smartroad_token');
  } else {
    sessionStorage.setItem('smartroad_token', token);
    localStorage.removeItem('smartroad_token');
  }
}

export function clearToken() {
  localStorage.removeItem('smartroad_token');
  sessionStorage.removeItem('smartroad_token');
}

/* ─── Fetch Wrapper ─── */

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // If 401, token is invalid/expired
    if (res.status === 401) {
      clearToken();
      // Don't redirect here — let the calling component handle it
    }

    return res;
  } catch (err) {
    console.error('API fetch error:', err);
    throw err;
  }
}

/* ─── Health Check ─── */

let _serverAvailable = null;
let _serverCacheTimer = null;

export function resetServerCache() {
  _serverAvailable = null;
  if (_serverCacheTimer) { clearTimeout(_serverCacheTimer); _serverCacheTimer = null; }
}

export async function isServerAvailable() {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    _serverAvailable = res.ok;
  } catch {
    _serverAvailable = false;
  }
  if (_serverCacheTimer) clearTimeout(_serverCacheTimer);
  // Re-check every 15 s so status badge stays accurate
  _serverCacheTimer = setTimeout(() => { _serverAvailable = null; }, 15000);
  return _serverAvailable;
}

/* ─── AUTH ─── */

export async function apiLogin(username, password) {
  const res = await apiFetch('/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return await res.json();
}

export async function apiSignup(data) {
  const res = await apiFetch('/users/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function apiLogActivity(entry) {
  try {
    await apiFetch('/users/activity', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  } catch {}
}

export async function fetchActivity() {
  try {
    const res = await apiFetch('/users/activity');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/* ─── DATASETS ─── */

export async function fetchDatasets() {
  try {
    const res = await apiFetch('/datasets');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createDataset(name, description = '') {
  const res = await apiFetch('/datasets', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  return await res.json();
}

export async function parseGpkgFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/datasets/parse-gpkg`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to parse GPKG file');
  return data;
}

export async function deleteDataset(id) {
  const res = await apiFetch(`/datasets/${id}`, { method: 'DELETE' });
  return await res.json();
}

export async function importRoadsToDataset(datasetId, roads, mode = 'append') {
  const res = await apiFetch(`/datasets/${datasetId}/import`, {
    method: 'POST',
    body: JSON.stringify({ roads, mode }),
  });
  return await res.json();
}

export async function setDefaultDataset(id) {
  const res = await apiFetch(`/datasets/${id}/default`, { method: 'PUT' });
  return await res.json();
}

/* ─── ROADS ─── */

export async function fetchRoads({ datasetId, page = 1, limit = 50, type, status, search, sortField, sortDir }) {
  const params = new URLSearchParams({ datasetId, page, limit });
  if (type && type !== 'All') params.set('type', type);
  if (status && status !== 'All') params.set('status', status);
  if (search) params.set('search', search);
  if (sortField) params.set('sortField', sortField);
  if (sortDir) params.set('sortDir', sortDir);

  try {
    const res = await apiFetch(`/roads?${params}`);
    if (!res.ok) return { roads: [], total: 0, page: 1, totalPages: 1 };
    return await res.json();
  } catch {
    return { roads: [], total: 0, page: 1, totalPages: 1 };
  }
}

export async function fetchAllRoads(datasetId) {
  try {
    const res = await apiFetch(`/roads/all/${datasetId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchRoadById(datasetId, id) {
  try {
    const res = await apiFetch(`/roads/single/${datasetId}/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function createRoad(roadData) {
  const res = await apiFetch('/roads', {
    method: 'POST',
    body: JSON.stringify(roadData),
  });
  return await res.json();
}

export async function updateRoad(datasetId, id, updates) {
  const res = await apiFetch(`/roads/${datasetId}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return await res.json();
}

export async function deleteRoad(datasetId, id) {
  const res = await apiFetch(`/roads/${datasetId}/${id}`, { method: 'DELETE' });
  return await res.json();
}

/* ─── HISTORY ─── */

export async function fetchHistory({ datasetId, page = 1, limit = 100, search } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (datasetId) params.set('datasetId', datasetId);
  if (search) params.set('search', search);

  try {
    const res = await apiFetch(`/history?${params}`);
    if (!res.ok) return { entries: [], total: 0 };
    return await res.json();
  } catch {
    return { entries: [], total: 0 };
  }
}

export async function pushHistoryEntry(entry) {
  try {
    await apiFetch('/history', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  } catch {}
}

export function getHistoryExportUrl(datasetId) {
  const token = getToken();
  const base = `${API_BASE}/history/export`;
  const params = `token=${token}${datasetId ? `&datasetId=${datasetId}` : ''}`;
  return `${base}?${params}`;
}

export function getRoadsExportUrl(datasetId) {
  const token = getToken();
  return `${API_BASE}/roads/export?datasetId=${datasetId}&token=${token}`;
}

/* ─── TRASH ─── */

export async function fetchTrash(datasetId) {
  try {
    const res = await apiFetch(`/trash?datasetId=${datasetId}`);
    if (res.status === 403 || res.status === 401) return []; // not superadmin
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function restoreFromTrash(datasetId, id) {
  const res = await apiFetch(`/trash/restore/${datasetId}/${id}`, { method: 'POST' });
  return await res.json();
}

export async function restoreAllFromTrash(datasetId) {
  const res = await apiFetch(`/trash/restore-all/${datasetId}`, { method: 'POST' });
  return await res.json();
}

export async function permanentDeleteFromTrash(datasetId, id) {
  const res = await apiFetch(`/trash/${datasetId}/${id}`, { method: 'DELETE' });
  return await res.json();
}

export async function emptyTrash(datasetId) {
  const res = await apiFetch(`/trash/${datasetId}`, { method: 'DELETE' });
  return await res.json();
}

/* ─── USER MANAGEMENT (Superadmin) ─── */

export async function fetchAllUsers() {
  try {
    const res = await apiFetch('/users');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function updateUserRole(userId, role) {
  const res = await apiFetch(`/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
  return await res.json();
}

export async function deleteUser(userId) {
  const res = await apiFetch(`/users/${userId}`, { method: 'DELETE' });
  return await res.json();
}

/* ─── GPKG EXPORT ─── */

/** Returns the authenticated download URL for GPKG export */
export function getRoadsGpkgUrl(datasetId) {
  return `${API_BASE}/roads/export-gpkg?datasetId=${datasetId}&token=${getToken()}`;
}

/* ─── IMAGERY ─── */

export async function fetchImagery() {
  try {
    const res = await apiFetch('/imagery');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function uploadImagery(formData) {
  const res = await fetch(`${API_BASE}/imagery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData, // multipart — do NOT set Content-Type manually
  });
  return await res.json();
}

export async function deleteImagery(id) {
  const res = await apiFetch(`/imagery/${id}`, { method: 'DELETE' });
  return await res.json();
}

export async function updateImageryMeta(id, patch) {
  const res = await apiFetch(`/imagery/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return await res.json();
}

/** Returns the URL to stream the imagery file — includes token as query param */
export function getImageryFileUrl(id) {
  return `${API_BASE}/imagery/${id}/file?token=${getToken()}`;
}
