const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// GET /api/history — paginated history for a dataset
router.get('/', (req, res) => {
  const { page = 1, limit = 100, datasetId, search } = req.query;

  let where = [];
  let params = [];

  if (datasetId) {
    where.push('dataset_id = ?');
    params.push(parseInt(datasetId));
  }
  if (search) {
    where.push('(LOWER(road_name) LIKE ? OR LOWER(field_name) LIKE ? OR LOWER(edited_by) LIKE ? OR LOWER(road_id) LIKE ?)');
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM history ${whereClause}`).get(...params).c;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const rows = db.prepare(
    `SELECT * FROM history ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);

  res.json({
    entries: rows.map(e => ({
      id: e.id,
      roadId: e.road_id,
      roadName: e.road_name,
      fieldName: e.field_name,
      oldValue: e.old_value,
      newValue: e.new_value,
      editedBy: e.edited_by,
      timestamp: e.timestamp,
      datasetId: e.dataset_id,
    })),
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
});

// POST /api/history — add history entry
router.post('/', (req, res) => {
  const { roadId, roadName, fieldName, oldValue, newValue, editedBy, datasetId } = req.body;
  db.prepare(
    'INSERT INTO history (dataset_id, road_id, road_name, field_name, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(datasetId || null, roadId || '', roadName || '', fieldName || '', oldValue || '', newValue || '', editedBy || '');
  res.json({ success: true });
});

// GET /api/history/export — export history as Excel file
router.get('/export', async (req, res) => {
  const { datasetId } = req.query;

  let where = [];
  let params = [];

  if (datasetId) {
    where.push('dataset_id = ?');
    params.push(parseInt(datasetId));
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM history ${whereClause} ORDER BY timestamp DESC`).all(...params);

  // Build Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Road GIS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Edit History', {
    headerFooter: { firstHeader: 'Smart Road GIS — Edit History' },
  });

  // Define columns
  sheet.columns = [
    { header: 'Sr. No.', key: 'srNo', width: 8 },
    { header: 'Timestamp', key: 'timestamp', width: 22 },
    { header: 'Road ID', key: 'roadId', width: 14 },
    { header: 'Road Name', key: 'roadName', width: 30 },
    { header: 'Field Changed', key: 'fieldName', width: 20 },
    { header: 'Old Value', key: 'oldValue', width: 25 },
    { header: 'New Value', key: 'newValue', width: 25 },
    { header: 'Edited By', key: 'editedBy', width: 16 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 24;

  // Add data rows
  rows.forEach((entry, idx) => {
    const row = sheet.addRow({
      srNo: idx + 1,
      timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      roadId: entry.road_id || '',
      roadName: entry.road_name || '',
      fieldName: entry.field_name || '',
      oldValue: entry.old_value || '',
      newValue: entry.new_value || '',
      editedBy: entry.edited_by || '',
    });

    // Alternate row colors
    if (idx % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  // Add borders
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Auto-filter
  sheet.autoFilter = { from: 'A1', to: `H${rows.length + 1}` };

  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 30 },
  ];
  summarySheet.getRow(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };

  const datasetName = datasetId
    ? (db.prepare('SELECT name FROM datasets WHERE id = ?').get(parseInt(datasetId))?.name || 'Unknown')
    : 'All Datasets';

  summarySheet.addRow({ metric: 'Dataset', value: datasetName });
  summarySheet.addRow({ metric: 'Total Entries', value: rows.length });
  summarySheet.addRow({ metric: 'Export Date', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) });
  summarySheet.addRow({ metric: 'Exported By', value: req.user?.username || 'System' });

  // Unique editors
  const editors = [...new Set(rows.map(r => r.edited_by).filter(Boolean))];
  summarySheet.addRow({ metric: 'Editors', value: editors.join(', ') });

  // Set response headers
  const filename = `edit_history_${datasetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
