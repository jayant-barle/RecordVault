import { query } from '../db/index.js';

/**
 * Validates email structure using standard format pattern
 */
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Validates phone number (checks for digits and common telephone characters)
 */
function isPotentiallyValidPhone(phone) {
  if (!phone) return false;
  const digitsOnly = String(phone).replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Executes a comprehensive data quality and duplicate analysis across records
 */
export async function runDataQualityAnalysis({ datasetId = null } = {}) {
  const whereClause = datasetId
    ? 'WHERE r.dataset_id = $1 AND r.is_deleted = FALSE'
    : 'WHERE r.is_deleted = FALSE';
  const params = datasetId ? [datasetId] : [];

  // Fetch all active records for analysis
  const recordsRes = await query(`
    SELECT r.*, d.name as dataset_name
    FROM records r
    LEFT JOIN datasets d ON r.dataset_id = d.id
    ${whereClause}
    ORDER BY r.created_at DESC
  `, params);

  const records = recordsRes.rows;
  const totalAnalyzed = records.length;

  // Trackers
  const duplicateIdGroups = new Map();     // datasetId:excelId -> count
  const crossDatasetIdGroups = new Map();  // excelId -> Set(datasetIds)
  const phoneGroups = new Map();           // mobile -> count
  const emailGroups = new Map();           // email -> count

  // Initial pass to group duplicates
  for (const r of records) {
    const idKey = `${r.dataset_id}::${r.excel_id}`;
    duplicateIdGroups.set(idKey, (duplicateIdGroups.get(idKey) || 0) + 1);

    if (r.excel_id) {
      if (!crossDatasetIdGroups.has(r.excel_id)) {
        crossDatasetIdGroups.set(r.excel_id, new Set());
      }
      crossDatasetIdGroups.get(r.excel_id).add(r.dataset_id);
    }

    const cleanMobile = String(r.mobile || '').trim();
    if (cleanMobile) {
      phoneGroups.set(cleanMobile, (phoneGroups.get(cleanMobile) || 0) + 1);
    }

    const cleanEmail = String(r.email || '').trim().toLowerCase();
    if (cleanEmail) {
      emailGroups.set(cleanEmail, (emailGroups.get(cleanEmail) || 0) + 1);
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  const issues = [];
  const datasetSummaryMap = new Map();

  // Second pass: inspect each record
  for (const r of records) {
    const recordIssues = [];
    const idKey = `${r.dataset_id}::${r.excel_id}`;

    // 1. Missing Excel ID (Error)
    if (!r.excel_id || String(r.excel_id).trim() === '') {
      recordIssues.push({
        type: 'ERROR',
        category: 'MISSING_ID',
        message: 'Record is missing a business Excel ID.',
      });
    }

    // 2. Duplicate ID in dataset (Error)
    if ((duplicateIdGroups.get(idKey) || 0) > 1) {
      recordIssues.push({
        type: 'ERROR',
        category: 'DUPLICATE_ID_IN_DATASET',
        message: `Excel ID "${r.excel_id}" occurs multiple times within this dataset.`,
      });
    }

    // 3. Cross-Dataset ID Conflict (Warning)
    const datasetsWithId = crossDatasetIdGroups.get(r.excel_id);
    if (datasetsWithId && datasetsWithId.size > 1) {
      recordIssues.push({
        type: 'WARNING',
        category: 'CROSS_DATASET_ID_CONFLICT',
        message: `ID "${r.excel_id}" also appears in ${datasetsWithId.size - 1} other dataset(s). Verify if this is the same business entity.`,
      });
    }

    // 4. Duplicate Phone Number (Warning)
    const cleanMobile = String(r.mobile || '').trim();
    if (cleanMobile && (phoneGroups.get(cleanMobile) || 0) > 1) {
      recordIssues.push({
        type: 'WARNING',
        category: 'DUPLICATE_PHONE',
        message: `Phone number "${cleanMobile}" shared with ${(phoneGroups.get(cleanMobile) || 0) - 1} other record(s).`,
      });
    }

    // 5. Duplicate Email (Warning)
    const cleanEmail = String(r.email || '').trim().toLowerCase();
    if (cleanEmail && (emailGroups.get(cleanEmail) || 0) > 1) {
      recordIssues.push({
        type: 'WARNING',
        category: 'DUPLICATE_EMAIL',
        message: `Email "${cleanEmail}" shared with ${(emailGroups.get(cleanEmail) || 0) - 1} other record(s).`,
      });
    }

    // 6. Missing Name (Warning)
    if (!r.name || String(r.name).trim() === '') {
      recordIssues.push({
        type: 'WARNING',
        category: 'MISSING_NAME',
        message: 'Name field is empty or unpopulated.',
      });
    }

    // 7. Invalid Email Format (Warning)
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      recordIssues.push({
        type: 'WARNING',
        category: 'INVALID_EMAIL',
        message: `Email "${cleanEmail}" does not conform to valid email format.`,
      });
    }

    // 8. Irregular Phone Format (Warning)
    if (cleanMobile && !isPotentiallyValidPhone(cleanMobile)) {
      recordIssues.push({
        type: 'WARNING',
        category: 'IRREGULAR_PHONE',
        message: `Phone "${cleanMobile}" may have irregular digit count.`,
      });
    }

    // Aggregate record issues
    if (recordIssues.length > 0) {
      const hasError = recordIssues.some(i => i.type === 'ERROR');
      if (hasError) errorCount++;
      else warningCount++;

      issues.push({
        recordId: r.id,
        excel_id: r.excel_id,
        name: r.name,
        dataset_name: r.dataset_name,
        dataset_id: r.dataset_id,
        issues: recordIssues,
      });

      // Dataset summary stats
      const dsKey = r.dataset_name || 'Standard Dataset';
      if (!datasetSummaryMap.has(dsKey)) {
        datasetSummaryMap.set(dsKey, { total: 0, issues: 0, errors: 0 });
      }
      const dsStat = datasetSummaryMap.get(dsKey);
      dsStat.issues++;
      if (hasError) dsStat.errors++;
    }
  }

  // Duplicate category breakdown counts
  const categoryCounts = {
    duplicateIdInDataset: Array.from(duplicateIdGroups.values()).filter(c => c > 1).length,
    crossDatasetConflicts: Array.from(crossDatasetIdGroups.values()).filter(s => s.size > 1).length,
    duplicatePhoneNumbers: Array.from(phoneGroups.values()).filter(c => c > 1).length,
    duplicateEmails: Array.from(emailGroups.values()).filter(c => c > 1).length,
  };

  const datasetBreakdown = [];
  for (const [dsName, stat] of datasetSummaryMap.entries()) {
    datasetBreakdown.push({
      datasetName: dsName,
      issuesCount: stat.issues,
      errorsCount: stat.errors,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    totalAnalyzed,
    cleanRecords: Math.max(0, totalAnalyzed - errorCount - warningCount),
    recordsWithErrors: errorCount,
    recordsWithWarnings: warningCount,
    categoryCounts,
    datasetBreakdown,
    issues: issues.slice(0, 200), // Cap payload for UI responsiveness
  };
}

/**
 * Formats data quality report as CSV string
 */
export async function generateDataQualityCsv({ datasetId = null } = {}) {
  const analysis = await runDataQualityAnalysis({ datasetId });
  const headers = ['Record ID', 'Excel ID', 'Name', 'Dataset', 'Severity', 'Category', 'Description'];
  const lines = [headers.join(',')];

  for (const item of analysis.issues) {
    for (const issue of item.issues) {
      const row = [
        `"${item.recordId}"`,
        `"${item.excel_id || '-'}"`,
        `"${String(item.name || '-').replace(/"/g, '""')}"`,
        `"${item.dataset_name || '-'}"`,
        `"${issue.type}"`,
        `"${issue.category}"`,
        `"${issue.message.replace(/"/g, '""')}"`
      ];
      lines.push(row.join(','));
    }
  }

  return lines.join('\n');
}
