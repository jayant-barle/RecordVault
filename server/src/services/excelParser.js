import * as XLSX from 'xlsx';

// Normalized matchers for standard fields
const FIELD_SYNONYMS = {
  excel_id: ['id', 'record_id', 'record id', 'employee id', 'emp id', 'emp_id', 'member id', 'serial no', 'code', 's.no', 'sr no', 'ref', 'identifier'],
  name: ['name', 'full name', 'fullname', 'employee name', 'customer name', 'client name', 'contact name', 'person name', 'user name'],
  mobile: ['mobile', 'phone', 'mobile number', 'phone number', 'contact number', 'cell', 'telephone', 'tel', 'cell phone'],
  email: ['email', 'e-mail', 'email address', 'e-mail address', 'gmail', 'mail'],
  company: ['company', 'department', 'dept', 'organization', 'org', 'firm', 'agency', 'division']
};

/**
 * Suggests standard field mapping based on detected header string
 */
export function suggestFieldMapping(header) {
  if (!header) return null;
  const normalized = String(header).toLowerCase().trim().replace(/[_\-\.]+/g, ' ');

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return field;
    }
  }
  return null;
}

/**
 * Preserves leading zeroes and trims trailing/leading spaces from string representation.
 */
export function cleanCellValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  return str;
}

/**
 * Inspects and parses an Excel workbook buffer to provide sheets and preview data.
 */
export function inspectWorkbook(buffer, originalFilename = '') {
  // Read workbook with raw: false to retain cell formatting and strings
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellNF: true,
    cellText: true,
  });

  const sheetSummaries = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to 2D array with cell text preserved to protect leading zeroes
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    if (rawRows.length === 0) {
      sheetSummaries.push({
        name: sheetName,
        rowCount: 0,
        headers: [],
        sampleRows: [],
        suggestedMapping: {},
        unmappedColumns: [],
        duplicateIdsInSheet: [],
        isEmpty: true
      });
      continue;
    }

    // First row is treated as headers
    const rawHeaders = rawRows[0].map(h => String(h || '').trim()).filter(Boolean);
    const dataRows = rawRows.slice(1);

    // Auto-detect mappings
    const suggestedMapping = {};
    const unmappedColumns = [];

    rawHeaders.forEach(header => {
      const suggested = suggestFieldMapping(header);
      if (suggested && !Object.values(suggestedMapping).includes(suggested)) {
        suggestedMapping[header] = suggested;
      } else {
        suggestedMapping[header] = 'custom';
        unmappedColumns.push(header);
      }
    });

    // Extract first 5 sample rows as key-value objects
    const sampleRows = dataRows.slice(0, 5).map(row => {
      const obj = {};
      rawHeaders.forEach((header, index) => {
        obj[header] = cleanCellValue(row[index]);
      });
      return obj;
    });

    // Check for duplicate IDs in the sheet if an ID column was detected
    const idHeader = Object.keys(suggestedMapping).find(h => suggestedMapping[h] === 'excel_id');
    const duplicateIdsInSheet = [];
    if (idHeader) {
      const idIndex = rawHeaders.indexOf(idHeader);
      const seenIds = new Set();
      dataRows.forEach((row, rowIndex) => {
        const idVal = cleanCellValue(row[idIndex]);
        if (idVal) {
          if (seenIds.has(idVal)) {
            duplicateIdsInSheet.push({ row: rowIndex + 2, id: idVal });
          } else {
            seenIds.add(idVal);
          }
        }
      });
    }

    sheetSummaries.push({
      name: sheetName,
      rowCount: dataRows.length,
      headers: rawHeaders,
      sampleRows,
      suggestedMapping,
      unmappedColumns,
      duplicateIdsInSheet,
      isEmpty: false
    });
  }

  return {
    filename: originalFilename,
    sheetNames: workbook.SheetNames,
    sheets: sheetSummaries
  };
}

/**
 * Extracts and maps all records from a chosen worksheet given a user-confirmed column mapping.
 */
export function extractWorksheetRecords(buffer, sheetName, columnMapping = {}) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellText: true,
  });

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Worksheet "${sheetName}" not found in workbook.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length < 2) {
    return [];
  }

  const headers = rawRows[0].map(h => String(h || '').trim());
  const dataRows = rawRows.slice(1);

  // Map each data row to standard fields + custom_fields
  const parsedRecords = [];

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    const record = {
      excel_id: '',
      name: '',
      mobile: '',
      email: '',
      company: '',
      custom_fields: {},
      _rowNumber: rowIndex + 2, // 1-indexed Excel row (header is 1)
    };

    let hasAnyData = false;

    headers.forEach((header, colIndex) => {
      const cellVal = cleanCellValue(row[colIndex]);
      if (cellVal !== '') hasAnyData = true;

      const targetField = columnMapping[header] || suggestFieldMapping(header) || 'custom';

      if (targetField === 'excel_id') {
        record.excel_id = cellVal;
      } else if (targetField === 'name') {
        record.name = cellVal;
      } else if (targetField === 'mobile') {
        record.mobile = cellVal;
      } else if (targetField === 'email') {
        record.email = cellVal;
      } else if (targetField === 'company') {
        record.company = cellVal;
      } else if (targetField !== 'ignore') {
        // Keep in custom_fields
        record.custom_fields[header] = cellVal;
      }
    });

    if (hasAnyData) {
      parsedRecords.push(record);
    }
  }

  return parsedRecords;
}
