/**
 * Formula injection sanitizer for CSV and Excel exports.
 * Prepends a single quote to prevent spreadsheet software from executing formulas.
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeRecordForExport(record) {
  const sanitized = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeRecordForExport(value);
    } else {
      sanitized[key] = sanitizeCellValue(value);
    }
  }
  return sanitized;
}
