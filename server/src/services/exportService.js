import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit-table';
import { sanitizeCellValue } from '../utils/formulaSanitizer.js';
import { query } from '../db/index.js';

// Standard field label mapping
const STANDARD_COLUMN_LABELS = {
  excel_id: 'Business ID',
  name: 'Full Name',
  mobile: 'Mobile Number',
  email: 'Email Address',
  company: 'Company / Dept',
  dataset_name: 'Dataset',
  created_at: 'Date Added',
};

/**
 * Fetches records to export based on selectedIds or filter query.
 */
export async function getRecordsForExport({ selectedIds = [], datasetId = '', queryText = '', searchField = 'all', criteria = [] }) {
  if (selectedIds && selectedIds.length > 0) {
    const placeholders = selectedIds.map((_, i) => `$${i + 1}`).join(',');
    const res = await query(`
      SELECT r.*, d.name as dataset_name, d.source_filename, d.worksheet_name
      FROM records r
      LEFT JOIN datasets d ON r.dataset_id = d.id
      WHERE r.id IN (${placeholders}) AND r.is_deleted = FALSE
      ORDER BY r.created_at DESC
    `, selectedIds);
    return res.rows;
  }

  // Filter-based query
  const whereConditions = ['r.is_deleted = FALSE'];
  const params = [];

  if (datasetId) {
    params.push(datasetId);
    whereConditions.push(`r.dataset_id = $${params.length}`);
  }

  const trimmedQuery = String(queryText || '').trim();
  if (trimmedQuery) {
    if (searchField === 'all') {
      params.push(trimmedQuery);
      const qIdx = params.length;
      whereConditions.push(`(
        LOWER(TRIM(r.excel_id)) = LOWER(TRIM($${qIdx})) OR
        LOWER(TRIM(r.name)) = LOWER(TRIM($${qIdx})) OR
        LOWER(TRIM(r.mobile)) = LOWER(TRIM($${qIdx})) OR
        LOWER(TRIM(r.email)) = LOWER(TRIM($${qIdx})) OR
        LOWER(TRIM(r.company)) = LOWER(TRIM($${qIdx}))
      )`);
    } else if (['excel_id', 'name', 'mobile', 'email', 'company'].includes(searchField)) {
      params.push(trimmedQuery);
      whereConditions.push(`LOWER(TRIM(r.${searchField})) = LOWER(TRIM($${params.length}))`);
    } else if (searchField.startsWith('custom:')) {
      const col = searchField.replace('custom:', '').trim();
      params.push(col);
      const cIdx = params.length;
      params.push(trimmedQuery);
      const vIdx = params.length;
      whereConditions.push(`LOWER(TRIM(r.custom_fields->>$${cIdx})) = LOWER(TRIM($${vIdx}))`);
    }
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  const res = await query(`
    SELECT r.*, d.name as dataset_name, d.source_filename, d.worksheet_name
    FROM records r
    LEFT JOIN datasets d ON r.dataset_id = d.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT 10000
  `, params);

  return res.rows;
}

/**
 * Extracts cell value for a given column definition
 */
function extractRecordColumnValue(record, colKey) {
  if (colKey.startsWith('custom:')) {
    const rawKey = colKey.replace('custom:', '');
    const cf = typeof record.custom_fields === 'string' ? JSON.parse(record.custom_fields) : (record.custom_fields || {});
    return cf[rawKey] ?? '';
  }

  if (colKey === 'created_at') {
    return record.created_at ? new Date(record.created_at).toLocaleDateString() : '';
  }

  return record[colKey] ?? '';
}

/**
 * Resolves column header display name
 */
function resolveColumnHeader(colKey) {
  if (STANDARD_COLUMN_LABELS[colKey]) {
    return STANDARD_COLUMN_LABELS[colKey];
  }
  if (colKey.startsWith('custom:')) {
    return colKey.replace('custom:', '');
  }
  return colKey;
}

/**
 * Generates Excel (.xlsx) buffer with selected custom columns and formula injection defense.
 */
export function generateExcelExport(records, { selectedColumns = null, title = 'Records_Export' } = {}) {
  // If no columns specified, use default columns plus all detected custom keys
  let columns = selectedColumns;
  if (!columns || columns.length === 0) {
    const customKeys = new Set();
    records.forEach(r => {
      const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
      Object.keys(cf).forEach(k => customKeys.add(`custom:${k}`));
    });
    columns = ['excel_id', 'name', 'mobile', 'email', 'company', 'dataset_name', ...Array.from(customKeys)];
  }

  const headers = columns.map(resolveColumnHeader);
  const dataRows = [headers];

  records.forEach(r => {
    const row = columns.map(col => sanitizeCellValue(extractRecordColumnValue(r, col)));
    dataRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Set explicit string cell type ('s') to preserve leading zeroes in IDs and phones
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let C = 0; C < columns.length; C++) {
    const colName = columns[C];
    if (colName === 'excel_id' || colName === 'mobile' || colName.includes('id') || colName.includes('phone')) {
      for (let R = 1; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cellAddress]) {
          ws[cellAddress].t = 's';
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Records');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates PDF buffer with structured tables, selected columns, and metadata.
 */
export async function generatePdfExport(records, { selectedColumns = null, title = 'Business Records Report' } = {}) {
  return new Promise((resolve, reject) => {
    try {
      let columns = selectedColumns;
      if (!columns || columns.length === 0) {
        columns = ['excel_id', 'name', 'mobile', 'email', 'company', 'dataset_name'];
      }

      // Limit PDF columns to max 7 for readability in landscape
      const displayColumns = columns.slice(0, 8);
      const headers = displayColumns.map(resolveColumnHeader);

      const doc = new PDFDocument({
        margin: 28,
        size: 'A4',
        layout: 'landscape',
        info: {
          Title: title,
          Author: 'Excel Record Management System',
        }
      });

      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Report Header
      doc.fontSize(16).fillColor('#1e293b').text(title, { align: 'left' });
      doc.fontSize(8.5).fillColor('#64748b').text(
        `Generated on: ${new Date().toLocaleString()} | Total Records: ${records.length} | Columns: ${displayColumns.length}`,
        { align: 'left' }
      );
      doc.moveDown(1);

      const rows = records.map(r =>
        displayColumns.map(col => String(extractRecordColumnValue(r, col) || '-'))
      );

      const tableData = {
        headers,
        rows
      };

      // Calculate column widths evenly
      const totalWidth = 780; // Landscape A4 printable width
      const colWidth = Math.floor(totalWidth / displayColumns.length);
      const columnsSize = displayColumns.map(() => colWidth);

      doc.table(tableData, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a'),
        prepareRow: () => doc.font('Helvetica').fontSize(8).fillColor('#334155'),
        padding: 4,
        columnsSize,
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
