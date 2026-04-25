import { useState, useCallback, useRef, useEffect } from 'react';
import { useDatasets } from '../context/DatasetContext';
import { useRoads } from '../context/RoadsContext';
import { useAuth } from '../context/AuthContext';
import { importRoadsToDataset, uploadImagery, fetchImagery, deleteImagery } from '../api';
import {
  Upload, FileUp, AlertTriangle, CheckCircle2, X, Database,
  FileText, Layers, ArrowRight, RefreshCw, Plus, Trash2, Calendar, User, Image as ImageIcon, MapPin
} from 'lucide-react';

/* ─── Parse uploaded shapefile (.shp zip or individual files) ─── */
async function parseShapefile(file) {
  const shp = await import('shpjs');
  const arrayBuffer = await file.arrayBuffer();
  const geojson = await shp.default(arrayBuffer);

  let features = [];
  if (Array.isArray(geojson)) {
    geojson.forEach(fc => {
      if (fc.features) features.push(...fc.features);
    });
  } else if (geojson.features) {
    features = geojson.features;
  }

  return features;
}

/* ─── Convert GeoJSON features to road objects ─── */
function featuresToRoads(features) {
  return features.map((feat, i) => {
    const props = feat.properties || {};
    return {
      id: props.id || props.ID || props.fid || `IMPORT-${String(i + 1).padStart(4, '0')}`,
      srNo: props.srNo || props.sr_no || props.SR_NO || props.serial || i + 1,
      fid: props.fid || props.FID || i + 1,
      name: props.name || props.NAME || props.road_name || props.ROAD_NAME || '',
      fromChainage: parseFloat(props.from_ch || props.FROM_CH || props.fromChainage || 0) || 0,
      toChainage: parseFloat(props.to_ch || props.TO_CH || props.toChainage || 0) || 0,
      length: parseFloat(props.length || props.LENGTH || props.len || 0) || 0,
      width: parseFloat(props.width || props.WIDTH || 0) || 0,
      roadType: props.roadType || props.road_type || props.ROAD_TYPE || props.type || props.TYPE || '',
      contractor: props.contractor || props.CONTRACTOR || '',
      constructionDate: props.constructionDate || props.construction_date || props.CONSTRUCTION_DATE || props.year || '',
      maintenanceDate: props.maintenanceDate || props.maintenance_date || '',
      lastRepair: props.lastRepair || props.last_repair || '',
      surfaceMaterial: props.surfaceMaterial || props.surface || props.SURFACE || props.material || '',
      drainageType: props.drainageType || props.drainage || props.DRAINAGE || '',
      zone: props.zone || props.ZONE || '',
      wardNo: props.wardNo || props.ward || props.WARD || props.ward_no || '',
      status: props.status || props.STATUS || 'Good',
      remarks: props.remarks || props.REMARKS || '',
      geometry: feat.geometry || { type: 'LineString', coordinates: [] },
    };
  });
}

export default function DatasetUpload() {
  const { datasets, createNewDataset, removeDataset, switchDataset, refreshDatasets } = useDatasets();
  const { refreshRoads } = useRoads();
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMode, setImportMode] = useState('replace');
  const [success, setSuccess] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [selectedExistingDataset, setSelectedExistingDataset] = useState(null);

  // Imagery state
  const imageryInputRef = useRef(null);
  const [imageryList, setImageryList] = useState([]);
  const [imageryFiles, setImageryFiles] = useState([]); // array of File objects

  const [imageryUploading, setImageryUploading] = useState(false);
  const [imageryError, setImageryError] = useState('');
  const [imagerySuccess, setImagerySuccess] = useState('');

  // Load imagery list on mount
  useEffect(() => {
    fetchImagery().then(setImageryList);
  }, []);


  const handleFile = useCallback(async (file) => {
    setError('');
    setSuccess('');
    setPreview(null);

    if (!file) return;

    const name = file.name.toLowerCase();
    const validExts = ['.zip', '.shp', '.geojson', '.json', '.gpkg'];
    const ext = '.' + name.split('.').pop();

    if (!validExts.includes(ext)) {
      setError(`Unsupported file format "${ext}". Please upload a .zip, .shp, .geojson, or .gpkg file.`);
      return;
    }

    setUploading(true);

    try {
      let features;

      if (ext === '.geojson' || ext === '.json') {
        const text = await file.text();
        const geojson = JSON.parse(text);
        if (geojson.type === 'FeatureCollection' && geojson.features) {
          features = geojson.features;
        } else if (geojson.type === 'Feature') {
          features = [geojson];
        } else {
          throw new Error('Invalid GeoJSON: expected FeatureCollection or Feature');
        }
      } else if (ext === '.gpkg') {
        const { parseGpkgFile } = await import('../api');
        const result = await parseGpkgFile(file);
        features = result.features;
      } else {
        features = await parseShapefile(file);
      }

      if (!features || features.length === 0) {
        throw new Error('No features found in the uploaded file.');
      }

      const convertedRoads = featuresToRoads(features);
      const lineStrings = features.filter(f => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString').length;
      const points = features.filter(f => f.geometry?.type === 'Point').length;
      const polygons = features.filter(f => f.geometry?.type === 'Polygon').length;

      const allKeys = new Set();
      features.forEach(f => {
        if (f.properties) Object.keys(f.properties).forEach(k => allKeys.add(k));
      });

      // Auto-generate dataset name from filename
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      setDatasetName(baseName);

      setPreview({
        features,
        roads: convertedRoads,
        fileName: file.name,
        stats: {
          total: features.length,
          lineStrings,
          points,
          polygons,
          attributeKeys: Array.from(allKeys).slice(0, 20),
        },
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!preview) return;

    try {
      let targetDatasetId;

      if (selectedExistingDataset) {
        // Import into existing dataset
        targetDatasetId = selectedExistingDataset;
      } else {
        // Create new dataset
        if (!datasetName.trim()) {
          setError('Please provide a name for the dataset');
          return;
        }
        const newDataset = await createNewDataset(datasetName.trim(), `Uploaded from ${preview.fileName}`);
        if (!newDataset) {
          setError('Failed to create dataset');
          return;
        }
        targetDatasetId = newDataset.id;
      }

      // Import roads into the dataset
      const result = await importRoadsToDataset(targetDatasetId, preview.roads, importMode);
      if (result.success) {
        setSuccess(`Successfully imported ${preview.roads.length} roads from "${preview.fileName}" into dataset`);
        setPreview(null);
        setDatasetName('');
        setSelectedExistingDataset(null);

        // Switch to the new dataset and refresh
        switchDataset(targetDatasetId);
        await refreshDatasets();
        await refreshRoads();
      } else {
        setError('Import failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setError('Import failed: ' + err.message);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setError('');
    setDatasetName('');
    setSelectedExistingDataset(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteDataset = async (id) => {
    if (!confirm('Are you sure? This will permanently delete the dataset and all its roads.')) return;
    await removeDataset(id);
  };

  return (
    <div className="dataset-upload">
      <div className="upload-header">
        <div className="upload-header-text">
          <h2><Database size={22} /> Upload Dataset</h2>
          <p>Import road data from Shapefile (.shp/.zip) or GeoJSON files. Each upload creates a named dataset that all users can select.</p>
        </div>
        <div className="upload-current-stats">
          <div className="upload-stat">
            <Layers size={16} />
            <span><strong>{datasets.length}</strong> datasets available</span>
          </div>
        </div>
      </div>

      {/* Existing Datasets List */}
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
                    <span><Calendar size={12} /> {new Date(ds.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>
                <button
                  className="btn-icon danger-icon"
                  onClick={() => handleDeleteDataset(ds.id)}
                  title="Delete dataset"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="upload-success animate-fade-in">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button className="btn-icon" onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="upload-error animate-fade-in">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button className="btn-icon" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Drop zone */}
      {!preview && (
        <div
          className={`upload-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.shp,.geojson,.json,.gpkg"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <div className="dropzone-content">
            {uploading ? (
              <>
                <RefreshCw size={40} className="spin-icon" />
                <p className="dropzone-title">Parsing file...</p>
                <span className="dropzone-hint">Processing your shapefile data</span>
              </>
            ) : (
              <>
                <FileUp size={40} />
                <p className="dropzone-title">Drop your file here, or click to browse</p>
                <span className="dropzone-hint">
                  Supports: <strong>.zip</strong>, <strong>.shp</strong>, <strong>.geojson</strong>, <strong>.gpkg</strong>
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview panel */}
      {preview && (
        <div className="upload-preview animate-fade-in">
          <div className="preview-header">
            <div className="preview-file-info">
              <FileText size={18} />
              <div>
                <span className="preview-filename">{preview.fileName}</span>
                <span className="preview-filesize">{preview.stats.total} features detected</span>
              </div>
            </div>
            <button className="btn-icon" onClick={handleCancelPreview} title="Cancel">
              <X size={18} />
            </button>
          </div>

          {/* Stats */}
          <div className="preview-stats">
            <div className="preview-stat-card">
              <span className="preview-stat-value">{preview.stats.total}</span>
              <span className="preview-stat-label">Total Features</span>
            </div>
            <div className="preview-stat-card">
              <span className="preview-stat-value">{preview.stats.lineStrings}</span>
              <span className="preview-stat-label">Line Strings</span>
            </div>
            <div className="preview-stat-card">
              <span className="preview-stat-value">{preview.stats.points}</span>
              <span className="preview-stat-label">Points</span>
            </div>
            <div className="preview-stat-card">
              <span className="preview-stat-value">{preview.stats.polygons}</span>
              <span className="preview-stat-label">Polygons</span>
            </div>
          </div>

          {/* Detected attributes */}
          <div className="preview-attributes">
            <h4>Detected Attributes</h4>
            <div className="attribute-chips">
              {preview.stats.attributeKeys.map(key => (
                <span key={key} className="attribute-chip">{key}</span>
              ))}
              {preview.stats.attributeKeys.length === 20 && (
                <span className="attribute-chip more">+more</span>
              )}
            </div>
          </div>

          {/* Dataset Name Input */}
          <div className="dataset-name-section">
            <h4><Database size={16} /> Dataset Name</h4>
            <div className="dataset-name-options">
              <div className={`dataset-name-option ${!selectedExistingDataset ? 'active' : ''}`}>
                <label>
                  <input
                    type="radio"
                    name="datasetTarget"
                    checked={!selectedExistingDataset}
                    onChange={() => setSelectedExistingDataset(null)}
                  />
                  Create New Dataset
                </label>
                {!selectedExistingDataset && (
                  <input
                    type="text"
                    className="dataset-name-input"
                    placeholder="Enter a name for this dataset..."
                    value={datasetName}
                    onChange={e => setDatasetName(e.target.value)}
                  />
                )}
              </div>
              {datasets.length > 0 && (
                <div className={`dataset-name-option ${selectedExistingDataset ? 'active' : ''}`}>
                  <label>
                    <input
                      type="radio"
                      name="datasetTarget"
                      checked={!!selectedExistingDataset}
                      onChange={() => setSelectedExistingDataset(datasets[0]?.id)}
                    />
                    Import into Existing Dataset
                  </label>
                  {selectedExistingDataset && (
                    <select
                      className="dataset-name-input"
                      value={selectedExistingDataset || ''}
                      onChange={e => setSelectedExistingDataset(parseInt(e.target.value))}
                    >
                      {datasets.map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name} ({ds.roadCount} roads)</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sample roads preview table */}
          <div className="preview-table-section">
            <h4>Preview (first 5 records)</h4>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Length</th>
                    <th>Status</th>
                    <th>Zone</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.roads.slice(0, 5).map((road, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{road.name || '—'}</td>
                      <td>{road.roadType || '—'}</td>
                      <td>{road.length || '—'}</td>
                      <td>{road.status}</td>
                      <td>{road.zone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import mode selection */}
          <div className="import-mode-section">
            <h4>Import Mode</h4>
            <div className="import-mode-options">
              <button
                className={`import-mode-btn ${importMode === 'replace' ? 'active' : ''}`}
                onClick={() => setImportMode('replace')}
              >
                <RefreshCw size={18} />
                <div>
                  <span className="mode-title">Replace</span>
                  <span className="mode-desc">Replace existing roads in dataset with imported data ({preview.roads.length} roads)</span>
                </div>
              </button>
              <button
                className={`import-mode-btn ${importMode === 'append' ? 'active' : ''}`}
                onClick={() => setImportMode('append')}
              >
                <Plus size={18} />
                <div>
                  <span className="mode-title">Combine (Upsert)</span>
                  <span className="mode-desc">Update existing roads and add new ones from the dataset</span>
                </div>
              </button>
            </div>
          </div>

          {/* Import action */}
          <div className="import-actions">
            <button className="btn-secondary" onClick={handleCancelPreview}>
              Cancel
            </button>
            <button className="btn-primary import-btn" onClick={handleImport}>
              <Upload size={16} />
              {selectedExistingDataset ? 'Import into Dataset' : 'Create Dataset & Import'}
              <ArrowRight size={14} />
            </button>
          </div>

          {importMode === 'replace' && selectedExistingDataset && (
            <div className="import-warning">
              <AlertTriangle size={14} />
              <span>This will replace all existing roads in the selected dataset with {preview.roads.length} imported roads.</span>
            </div>
          )}
        </div>
      )}

      {/* Supported formats info */}
      <div className="upload-formats-info">
        <h4>Supported Formats</h4>
        <div className="format-cards">
          <div className="format-card">
            <div className="format-icon shp">SHP</div>
            <div>
              <strong>Zipped Shapefile (.zip)</strong>
              <span>Include .shp, .dbf, .shx, and .prj files in a single ZIP archive. This is the recommended format.</span>
            </div>
          </div>
          <div className="format-card">
            <div className="format-icon geo">GEO</div>
            <div>
              <strong>GeoJSON (.geojson / .json)</strong>
              <span>Standard GeoJSON FeatureCollection with road geometries and attributes.</span>
            </div>
          </div>
          <div className="format-card">
            <div className="format-icon gpkg">GPK</div>
            <div>
              <strong>GeoPackage (.gpkg)</strong>
              <span>Supports point, line, and polygon feature extraction.</span>
            </div>
          </div>
        </div>
      </div>

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
          {/* Drop zone — supports multi-select */}
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
                  // Deduplicate by name
                  const existing = new Set(prev.map(f => f.name));
                  return [...prev, ...files.filter(f => !existing.has(f.name))];
                });
                // Reset input so same file can be re-added after removal
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

          {/* File list */}
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

        {/* Existing imagery list */}
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
