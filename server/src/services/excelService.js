import * as XLSX from 'xlsx';

/**
 * Common field aliases for automatic smart mapping
 */
const FIELD_SYNONYMS = {
  excel_id: ['id', 'excel_id', 'record_id', 'employee_id', 'empid', 'emp_id', 'code', 'ref', 'sr_no', 'sl_no', 'roll_no'],
  name: ['name', 'full_name', 'fullname', 'employee_name', 'emp_name', 'customer_name', 'contact_name', 'first_name'],
  phone: ['phone', 'mobile', 'cell', 'contact', 'telephone', 'phone_number', 'mobile_no', 'cell_no', 'contact_no'],
  email: ['email', 'mail', 'e_mail', 'e-mail', 'gmail', 'email_address', 'email_id'],
  company_department: ['company', 'department', 'dept', 'organization', 'org', 'division', 'team', 'branch', 'office']
};

/**
 * Suggest best standard field for a given column header
 */
export function guessFieldMapping(columnName) {
  const norm = String(columnName || '').trim().toLowerCase().replace(/[\s\-_]+/g, '_');
  for (const [standardField, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (synonyms.some(s => norm === s || norm.includes(s))) {
      return standardField;
    }
  }
  return null; // Treated as custom field
}

/**
 * Parses an Excel buffer and returns workbook information including all sheets and preview rows.
 * Preserves leading zeros in IDs and phone numbers by extracting raw formatted strings.
 */
export function inspectWorkbook(buffer, originalFilename = 'file.xlsx') {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellText: true, // Crucial: populates cell.w with formatted string
    raw: false      // Ensures numbers formatted with leading zeros are read as strings
  });

  const sheets = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to 2D array or object array with header row
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Array of arrays
      raw: false,
      defval: ''
    });

    if (!rawRows || rawRows.length === 0) {
      sheets.push({
        sheetName,
        headers: [],
        totalRows: 0,
        suggestedMapping: {},
        previewRows: []
      });
      continue;
    }

    // First row is headers
    const rawHeaders = rawRows[0].map(h => String(h || '').trim()).filter(h => h.length > 0);
    const dataRows = rawRows.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

    // Construct suggested mapping
    const suggestedMapping = {};
    for (const h of rawHeaders) {
      const guessed = guessFieldMapping(h);
      if (guessed) {
        suggestedMapping[h] = guessed;
      }
    }

    // Convert preview rows (up to 10) to object format
    const previewRows = dataRows.slice(0, 10).map((row, rowIdx) => {
      const obj = { __rowNum: rowIdx + 2 };
      rawHeaders.forEach((header, colIdx) => {
        const val = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
        obj[header] = val;
      });
      return obj;
    });

    sheets.push({
      sheetName,
      headers: rawHeaders,
      totalRows: dataRows.length,
      suggestedMapping,
      previewRows
    });
  }

  return {
    filename: originalFilename,
    sheetCount: sheets.length,
    sheets
  };
}

/**
 * Extract parsed and normalized rows from a specific worksheet
 * mapping headers according to user-selected field mappings.
 */
export function extractWorksheetRecords(buffer, sheetName, columnMapping = {}) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellText: true,
    raw: false
  });

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Worksheet '${sheetName}' not found in workbook.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  if (!rawRows || rawRows.length < 2) {
    return { records: [], headers: [] };
  }

  const headers = rawRows[0].map(h => String(h || '').trim());
  const dataRows = rawRows.slice(1);

  const parsedRecords = [];

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const row = dataRows[rIdx];
    // Check if row has any non-empty cell
    if (!row.some(c => String(c).trim() !== '')) {
      continue;
    }

    const standardFields = {
      excel_id: '',
      name: '',
      phone: '',
      email: '',
      company_department: ''
    };
    const custom_fields = {};

    headers.forEach((header, colIdx) => {
      if (!header) return;
      const cellVal = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
      const mappedStandard = columnMapping[header];

      if (mappedStandard && standardFields.hasOwnProperty(mappedStandard)) {
        standardFields[mappedStandard] = cellVal;
      } else {
        // Additional/custom column
        custom_fields[header] = cellVal;
      }
    });

    // If excel_id was not explicitly mapped, check if any unmapped column might serve as id,
    // or generate a deterministic row-based identifier
    if (!standardFields.excel_id) {
      if (custom_fields['ID'] || custom_fields['id']) {
        standardFields.excel_id = String(custom_fields['ID'] || custom_fields['id']);
      } else {
        standardFields.excel_id = `ROW-${rIdx + 1}`;
      }
    }

    parsedRecords.push({
      rowNumber: rIdx + 2,
      excel_id: String(standardFields.excel_id).trim(),
      name: String(standardFields.name).trim(),
      phone: String(standardFields.phone).trim(),
      email: String(standardFields.email).trim(),
      company_department: String(standardFields.company_department).trim(),
      custom_fields
    });
  }

  return {
    headers,
    records: parsedRecords
  };
}

/**
 * Escapes characters that trigger Excel formula execution (=, +, -, @)
 */
export function sanitizeForSpreadsheet(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=\+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
