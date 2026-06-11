import { useState, useCallback, useRef, useEffect } from 'react';
import { useDatasets } from '../context/DatasetContext';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { uploadAndImportDataset, uploadImagery, fetchImagery, deleteImagery } from '../api';
import { formatLocalDate } from '../utils/dateHelper';
import {
  Upload, FileUp, AlertTriangle, CheckCircle2, X, Database,
  FileText, Layers, ArrowRight, RefreshCw, Plus, Trash2, Calendar, User,
  Image as ImageIcon, MapPin, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

export default function DatasetUpload() {
  const { datasets, removeDataset, switchDataset, refreshDatasets } = useDatasets();
  const { refreshRoads } = useRoads();
  const { currentUser } = useAuth();
  
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Selected file state
  const [selectedFile, setSelectedFile] = useState(null);
  const [datasetName, setDatasetName] = useState('');
  const [selectedExistingDataset, setSelectedExistingDataset] = useState(null);
  const [importMode, setImportMode] = useState('replace'); // 'replace' or 'append'
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Imagery state
  const imageryInputRef = useRef(null);
  const [imageryList, setImageryList] = useState([]);
  const [imageryFiles, setImageryFiles] = useState([]);
  const [imageryUploading, setImageryUploading] = useState(false);
  const [imageryError, setImageryError] = useState('');
  const [imagerySuccess, setImagerySuccess] = useState('');

  // Load imagery list on mount
  useEffect(() => {
    fetchImagery().then(setImageryList);
  }, []);

  const handleFileSelect = (file) => {
    setError('');
    setSuccess('');
    if (!file) return;

    const name = file.name.toLowerCase();
    const validExts = ['.zip', '.shp', '.geojson', '.json', '.gpkg'];
    const ext = '.' + name.split('.').pop();

    if (!validExts.includes(ext)) {
      setError(`Unsupported file format "${ext}". Please upload a .zip, .shp, .geojson, or .gpkg file.`);
      return;
    }

    setSelectedFile(file);
    // Auto-generate name based on filename
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    setDatasetName(baseName);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const targetDatasetId = selectedExistingDataset || null;
      
      if (!targetDatasetId && !datasetName.trim()) {
        setError('Please enter a name for the new dataset.');
        setUploading(false);
        return;
      }

      const result = await uploadAndImportDataset({
        file: selectedFile,
        name: targetDatasetId ? null : datasetName.trim(),
        description: targetDatasetId ? null : `Uploaded from ${selectedFile.name}`,
        mode: importMode,
        datasetId: targetDatasetId
      });

      if (result.success) {
        setSuccess(`Successfully imported ${result.importedCount} roads from "${selectedFile.name}"!`);
        setSelectedFile(null);
        setDatasetName('');
        setSelectedExistingDataset(null);
        
        // Auto-switch dataset and refresh client data context (instantly updates UI without refresh)
        switchDataset(result.dataset.id);
        await refreshDatasets();
        await refreshRoads();
      } else {
        setError(result.error || 'Failed to import dataset');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'An error occurred during import.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancelSelection = () => {
    setSelectedFile(null);
    setDatasetName('');
    setSelectedExistingDataset(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteDataset = async (id) => {
    if (!confirm('Are you sure you want to delete this dataset? All associated roads and history will be permanently deleted.')) return;
    try {
      await removeDataset(id);
      setSuccess('Dataset deleted successfully.');
      await refreshDatasets();
      await refreshRoads();
    } catch (err) {
      setError(err.message || 'Failed to delete dataset');
    }
  };

  return (
    <div className="dataset-upload">
      <div className="upload-header">
        <div className="upload-header-text">
          <h2><Database size={22} /> GIS Datasets</h2>
          <p>Import road network datasets from GeoPackage (.gpkg), Shapefile (.zip), or GeoJSON files directly. Features are processed efficiently on the server.</p>
        </div>
        <div className="upload-current-stats">
          <div className="upload-stat">
            <Layers size={16} />
            <span><strong>{datasets.length}</strong> datasets available</span>
          </div>
        </div>
      </div>

      {/* Success/Error Banners */}
      {success && (
        <div className="upload-success animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
          <CheckCircle2 size={18} />
          <span style={{ flexGrow: 1 }}>{success}</span>
          <button className="btn-icon" onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {error && (
        <div className="upload-error animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
          <AlertTriangle size={18} />
          <span style={{ flexGrow: 1 }}>{error}</span>
          <button className="btn-icon" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* MAIN UPLOAD INTERFACE */}
      {!selectedFile ? (
        <div
          className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--primary)',
            borderRadius: '12px',
            padding: '3rem 2rem',
            textAlign: 'center',
            background: dragOver ? 'var(--bg-alt)' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: dragOver ? '0 0 20px rgba(99, 102, 241, 0.15)' : 'none'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.shp,.geojson,.json,.gpkg"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <FileUp size={48} style={{ color: 'var(--primary)', animation: dragOver ? 'bounce 1s infinite' : 'none' }} />
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
              Drag and drop your file here, or click to browse
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Supports GeoPackage (.gpkg), Shapefile (.zip), and GeoJSON (.geojson, .json)
            </p>
          </div>
        </div>
      ) : (
        <div
          className="selected-file-panel animate-fade-in"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* File Card Info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'var(--primary-light)', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)' }}>
                <FileText size={24} />
              </div>
              <div>
                <h4 style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{selectedFile.name}</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.name.split('.').pop().toUpperCase()} File
                </p>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleCancelSelection} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={14} /> Clear Selection
            </button>
          </div>

          {/* Simple dataset name configuration */}
          {!selectedExistingDataset && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dataset Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter dataset name..."
                value={datasetName}
                onChange={e => setDatasetName(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-alt)',
                  color: 'var(--text)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          )}

          {/* Advanced Accordion Toggle */}
          <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '0.75rem 0' }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: 0
              }}
            >
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
            </button>

            {showAdvanced && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', padding: '0.5rem 0' }}>
                {/* Target dataset option */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Import Destination</span>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="datasetTarget"
                        checked={!selectedExistingDataset}
                        onChange={() => setSelectedExistingDataset(null)}
                      />
                      Create New Dataset
                    </label>
                    {datasets.length > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="datasetTarget"
                          checked={!!selectedExistingDataset}
                          onChange={() => setSelectedExistingDataset(datasets[0]?.id)}
                        />
                        Import into Existing Dataset
                      </label>
                    )}
                  </div>
                  {selectedExistingDataset && (
                    <select
                      className="input-field"
                      value={selectedExistingDataset || ''}
                      onChange={e => setSelectedExistingDataset(parseInt(e.target.value))}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-alt)',
                        color: 'var(--text)',
                        fontSize: '0.8rem',
                        marginTop: '0.25rem',
                        width: '100%',
                        maxWidth: '400px'
                      }}
                    >
                      {datasets.map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name} ({ds.roadCount} roads)</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Import mode option */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Import Mode</span>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                      />
                      Replace all roads in dataset
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                      />
                      Combine / Append roads
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Import actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            {uploading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
                <Loader2 size={18} className="spin-icon" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Uploading & processing on server... Please wait.
                </span>
              </div>
            )}
            <button className="btn btn-secondary" onClick={handleCancelSelection} disabled={uploading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleImport} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {uploading ? (
                <>
                  <Loader2 size={14} className="spin-icon" />
                  Processing...
                </>
              ) : (
                <>
                  {selectedExistingDataset ? 'Import Data' : 'Create & Import'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Uploaded Datasets List */}
      {datasets.length > 0 && (
        <div className="existing-datasets-section">
          <h3><Database size={16} /> Uploaded Datasets</h3>
          <div className="existing-datasets-grid">
            {datasets.map(ds => (
              <div key={ds.id} className="existing-dataset-card">
                <div className="dataset-card-info">
                  <span className="dataset-card-name">
                    {ds.name}
                    {ds.isDefault && <span className="dataset-default-badge">Default</span>}
                  </span>
                  <span className="dataset-card-meta">
                    <span><Layers size={12} /> {ds.roadCount} roads</span>
                    <span><User size={12} /> {ds.uploadedBy}</span>
                    <span><Calendar size={12} /> {formatLocalDate(ds.createdAt)}</span>
                  </span>
                </div>
                <button
                  className="btn-icon danger-icon"
                  onClick={() => handleDeleteDataset(ds.id)}
                  title="Delete dataset"
                  disabled={uploading}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ IMAGERY UPLOAD SECTION ════════════════════════════════════════ */}
      <div className="imagery-upload-section">
        <div className="imagery-upload-header">
          <ImageIcon size={20} />
          <div>
            <h3>Upload Background Imagery</h3>
            <p>Upload GeoTIFF (.tif) or ECW raster files to display as background layers on the map.</p>
          </div>
        </div>

        {imageryError && (
          <div className="upload-error animate-fade-in">
            <AlertTriangle size={16} />
            <span>{imageryError}</span>
            <button className="btn-icon" onClick={() => setImageryError('')}><X size={13} /></button>
          </div>
        )}
        {imagerySuccess && (
          <div className="upload-success animate-fade-in">
            <CheckCircle2 size={16} />
            <span>{imagerySuccess}</span>
            <button className="btn-icon" onClick={() => setImagerySuccess('')}><X size={13} /></button>
          </div>
        )}

        <div className="imagery-upload-form">
          <div
            className="imagery-file-picker"
            onClick={() => imageryInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <input
              ref={imageryInputRef}
              type="file"
              accept=".tif,.tiff,.ecw,.geotiff"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length) setImageryFiles(prev => {
                  const existing = new Set(prev.map(f => f.name));
                  return [...prev, ...files.filter(f => !existing.has(f.name))];
                });
                e.target.value = '';
              }}
            />
            {imageryFiles.length === 0 ? (
              <div className="imagery-file-placeholder">
                <Upload size={22} />
                <span>Click to select GeoTIFF or ECW files</span>
                <span className="dropzone-hint">.tif / .tiff / .ecw — up to 20 files, 500 MB each</span>
              </div>
            ) : (
              <div className="imagery-file-placeholder" style={{ padding: '0.6rem 1rem' }}>
                <Upload size={16} />
                <span style={{ fontSize: '0.8rem' }}>Click to add more files</span>
              </div>
            )}
          </div>

          {imageryFiles.length > 0 && (
            <div className="imagery-file-list">
              {imageryFiles.map((f, idx) => (
                <div key={f.name} className="imagery-file-row">
                  <ImageIcon size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span className="imagery-file-row-name">{f.name}</span>
                  <span className="imagery-file-row-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <span className={`imagery-file-row-type ${f.name.match(/\.ecw$/i) ? 'ecw' : ''}`}>
                    {f.name.match(/\.ecw$/i) ? 'ECW' : 'TIFF'}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={e => { e.stopPropagation(); setImageryFiles(p => p.filter((_, i) => i !== idx)); }}
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div className="imagery-file-summary">
                <strong>{imageryFiles.length}</strong> file{imageryFiles.length !== 1 ? 's' : ''} selected &nbsp;·&nbsp;
                {(imageryFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => { setImageryFiles([]); if (imageryInputRef.current) imageryInputRef.current.value = ''; }}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {imageryFiles.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
              disabled={imageryUploading}
              onClick={async () => {
                setImageryUploading(true);
                setImageryError('');
                try {
                  const fd = new FormData();
                  imageryFiles.forEach(f => fd.append('imagery', f));
                  const result = await uploadImagery(fd);
                  if (result.success) {
                    setImagerySuccess(
                      result.count === 1
                        ? `"${result.imagery[0].name}" uploaded successfully`
                        : `${result.count} imagery files uploaded successfully`
                    );
                    setImageryFiles([]);
                    if (imageryInputRef.current) imageryInputRef.current.value = '';
                    const updated = await fetchImagery();
                    setImageryList(updated);
                  } else {
                    setImageryError(result.error || 'Upload failed');
                  }
                } catch (err) {
                  setImageryError(err.message);
                }
                setImageryUploading(false);
              }}
            >
              {imageryUploading
                ? <><RefreshCw size={15} className="spin-icon" /> Uploading {imageryFiles.length} file{imageryFiles.length !== 1 ? 's' : ''}...</>
                : <><Upload size={15} /> Upload {imageryFiles.length} File{imageryFiles.length !== 1 ? 's' : ''}</>
              }
            </button>
          )}
        </div>

        {imageryList.length > 0 && (
          <div className="existing-imagery-list">
            <h4 style={{ margin: '1.25rem 0 0.625rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <MapPin size={14} /> Uploaded Imagery Layers ({imageryList.length})
            </h4>
            {imageryList.map(img => (
              <div key={img.id} className="existing-dataset-card">
                <div className="dataset-card-info">
                  <span className="dataset-card-name">
                    <ImageIcon size={13} style={{ color: img.canRender ? 'var(--success)' : 'var(--text-muted)' }} />
                    {img.name}
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: img.canRender ? 'var(--success-light)' : 'var(--bg-alt)', color: img.canRender ? 'var(--success)' : 'var(--text-muted)', marginLeft: '0.4rem' }}>
                      {img.fileType}
                    </span>
                  </span>
                  <span className="dataset-card-meta">
                    <span>{(img.fileSize / 1024 / 1024).toFixed(1)} MB · by {img.uploadedBy}</span>
                    <span>{img.canRender ? '✓ Renders in map' : '⚠️ Open in QGIS'}</span>
                  </span>
                </div>
                <button
                  className="btn-icon danger-icon"
                  title="Delete imagery"
                  disabled={uploading}
                  onClick={async () => {
                    if (!confirm(`Delete "${img.name}"?`)) return;
                    await deleteImagery(img.id);
                    setImageryList(l => l.filter(x => x.id !== img.id));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
