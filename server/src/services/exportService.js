import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { query } from '../db/index.js';
import { sanitizeCellValue } from '../utils/formulaSanitizer.js';

/**
 * Fetch records for export based on explicit IDs or current search/filter criteria.
 */
export async function getRecordsForExport({ selectedIds, datasetId, queryText, searchField }) {
  if (Array.isArray(selectedIds) && selectedIds.length > 0) {
    const placeholders = selectedIds.map((_, i) => `$${i + 1}`).join(',');
    const sql = `
      SELECT 
        r.id,
        r.dataset_id,
        r.excel_id,
        r.name,
        r.mobile,
        r.email,
        r.company,
        r.custom_fields,
        r.created_at,
        d.name as dataset_name,
        d.source_filename
      FROM records r
      LEFT JOIN datasets d ON r.dataset_id = d.id
      WHERE r.id IN (${placeholders})
      ORDER BY r.created_at DESC
    `;
    const res = await query(sql, selectedIds);
    return res.rows;
  }

  // Filter-based export
  const whereConditions = [];
  const params = [];

  if (datasetId) {
    params.push(datasetId);
    whereConditions.push(`r.dataset_id = $${params.length}`);
  }

  const trimmed = String(queryText || '').trim();
  if (trimmed) {
    params.push(trimmed);
    const qIndex = params.length;

    if (searchField === 'all' || !searchField) {
      whereConditions.push(`(
        LOWER(TRIM(r.excel_id)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.name)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.mobile)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.email)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.company)) = LOWER(TRIM($${qIndex}))
      )`);
    } else if (['excel_id', 'name', 'mobile', 'email', 'company'].includes(searchField)) {
      whereConditions.push(`LOWER(TRIM(r.${searchField})) = LOWER(TRIM($${qIndex}))`);
    } else if (searchField.startsWith('custom:')) {
      const colName = searchField.replace('custom:', '').trim();
      params.push(colName);
      const colIdx = params.length;
      whereConditions.push(`LOWER(TRIM(r.custom_fields->>$${colIdx})) = LOWER(TRIM($${qIndex}))`);
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      r.id,
      r.dataset_id,
      r.excel_id,
      r.name,
      r.mobile,
      r.email,
      r.company,
      r.custom_fields,
      r.created_at,
      d.name as dataset_name,
      d.source_filename
    FROM records r
    LEFT JOIN datasets d ON r.dataset_id = d.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT 10000
  `;
  const res = await query(sql, params);
  return res.rows;
}

/**
 * Generate Excel workbook buffer (.xlsx) with leading zero preservation and formula injection defense.
 */
export function generateExcelExport(records, reportTitle = 'Business_Records_Export') {
  // Collect all unique custom fields across records
  const customKeySet = new Set();
  records.forEach(r => {
    const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
    Object.keys(cf).forEach(k => customKeySet.add(k));
  });
  const customKeys = Array.from(customKeySet);

  const headers = [
    'Record ID',
    'Excel ID',
    'Full Name',
    'Mobile / Phone',
    'Email Address',
    'Company / Department',
    'Dataset',
    ...customKeys
  ];

  const rows = records.map(r => {
    const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
    const customVals = customKeys.map(k => sanitizeCellValue(cf[k] ?? ''));

    return [
      String(r.id),
      sanitizeCellValue(r.excel_id),
      sanitizeCellValue(r.name),
      sanitizeCellValue(r.mobile),
      sanitizeCellValue(r.email),
      sanitizeCellValue(r.company),
      sanitizeCellValue(r.dataset_name || ''),
      ...customVals
    ];
  });

  const wsData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Explicit string formatting to ensure Excel never strips leading zeros
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  for (let R = 1; R <= range.e.r; ++R) {
    const idCellRef = XLSX.utils.encode_cell({ r: R, c: 1 });
    if (worksheet[idCellRef]) worksheet[idCellRef].t = 's';
    const mobileCellRef = XLSX.utils.encode_cell({ r: R, c: 3 });
    if (worksheet[mobileCellRef]) worksheet[mobileCellRef].t = 's';
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Records');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate PDF report buffer (.pdf) with table formatting and page breaks.
 */
export async function generatePdfExport(records, reportTitle = 'Business Records Report') {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        layout: 'landscape',
        bufferPages: true
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Header Banner
      doc.fontSize(18).fillColor('#0f172a').text(reportTitle, { align: 'left' });
      doc.fontSize(9).fillColor('#64748b').text(
        `Generated on: ${new Date().toLocaleString()} | Total Records: ${records.length}`,
        { align: 'left' }
      );
      doc.moveDown(0.8);

      const startX = 36;
      let currentY = doc.y;
      const columns = [
        { header: 'Excel ID', width: 80, key: 'excel_id' },
        { header: 'Name', width: 140, key: 'name' },
        { header: 'Mobile', width: 100, key: 'mobile' },
        { header: 'Email', width: 160, key: 'email' },
        { header: 'Company', width: 120, key: 'company' },
        { header: 'Dataset', width: 120, key: 'dataset_name' }
      ];

      const drawHeader = (y) => {
        doc.rect(startX, y, 720, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
        let x = startX + 6;
        columns.forEach(col => {
          doc.text(col.header, x, y + 5, { width: col.width, lineBreak: false, ellipsis: true });
          x += col.width;
        });
        doc.font('Helvetica');
        return y + 20;
      };

      currentY = drawHeader(currentY);

      records.forEach((rec, idx) => {
        if (currentY > 520) {
          doc.addPage();
          currentY = 40;
          currentY = drawHeader(currentY);
        }

        if (idx % 2 === 0) {
          doc.rect(startX, currentY, 720, 18).fill('#f8fafc');
        }

        doc.fillColor('#1e293b').fontSize(8);
        let x = startX + 6;
        columns.forEach(col => {
          const val = rec[col.key] !== null && rec[col.key] !== undefined ? String(rec[col.key]) : '-';
          doc.text(val, x, currentY + 4, { width: col.width, lineBreak: false, ellipsis: true });
          x += col.width;
        });

        currentY += 18;
      });

      // Page numbers in footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#94a3b8').text(
          `Page ${i + 1} of ${range.count} — Confidential Business Document`,
          36,
          560,
          { align: 'center', width: 720 }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
