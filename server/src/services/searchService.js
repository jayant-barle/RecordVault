import { query } from '../db/index.js';

// Whitelist of valid sort columns
const ALLOWED_SORT_COLUMNS = {
  excel_id: 'r.excel_id',
  name: 'r.name',
  mobile: 'r.mobile',
  email: 'r.email',
  company: 'r.company',
  created_at: 'r.created_at',
  updated_at: 'r.updated_at',
};

const ALLOWED_STANDARD_FIELDS = ['excel_id', 'name', 'mobile', 'email', 'company'];

/**
 * Masks sensitive search queries for privacy in history logs
 */
function maskSearchCriteria(field, value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (field === 'mobile' || /^\+?\d{7,15}$/.test(trimmed)) {
    return trimmed.length > 4 ? `*`.repeat(trimmed.length - 4) + trimmed.slice(-4) : '***';
  }
  if (field === 'email' || trimmed.includes('@')) {
    const parts = trimmed.split('@');
    return `${parts[0].charAt(0)}***@${parts[1] || ''}`;
  }
  if (trimmed.length > 15) {
    return trimmed.slice(0, 10) + '...';
  }
  return trimmed;
}

/**
 * Builds SQL condition for a specific field and operator
 */
function buildFieldCondition(field, operator, value, params) {
  const op = operator || 'equals';
  const trimmedVal = String(value || '').trim();

  const isCustom = field.startsWith('custom:');
  const customColName = isCustom ? field.replace('custom:', '').trim() : null;

  if (op === 'is_empty') {
    if (isCustom) {
      params.push(customColName);
      return `(r.custom_fields->>$${params.length} IS NULL OR TRIM(r.custom_fields->>$${params.length}) = '')`;
    } else if (ALLOWED_STANDARD_FIELDS.includes(field)) {
      return `(r.${field} IS NULL OR TRIM(r.${field}) = '')`;
    }
  }

  if (op === 'is_not_empty') {
    if (isCustom) {
      params.push(customColName);
      return `(r.custom_fields->>$${params.length} IS NOT NULL AND TRIM(r.custom_fields->>$${params.length}) != '')`;
    } else if (ALLOWED_STANDARD_FIELDS.includes(field)) {
      return `(r.${field} IS NOT NULL AND TRIM(r.${field}) != '')`;
    }
  }

  if (!trimmedVal) return null;

  if (op === 'not_equals') {
    if (isCustom) {
      params.push(customColName);
      const colIdx = params.length;
      params.push(trimmedVal);
      const valIdx = params.length;
      return `LOWER(TRIM(COALESCE(r.custom_fields->>$${colIdx}, ''))) != LOWER(TRIM($${valIdx}))`;
    } else if (ALLOWED_STANDARD_FIELDS.includes(field)) {
      params.push(trimmedVal);
      return `LOWER(TRIM(COALESCE(r.${field}, ''))) != LOWER(TRIM($${params.length}))`;
    }
  }

  // Default: Exact match ('equals')
  if (isCustom) {
    params.push(customColName);
    const colIdx = params.length;
    params.push(trimmedVal);
    const valIdx = params.length;
    return `LOWER(TRIM(COALESCE(r.custom_fields->>$${colIdx}, ''))) = LOWER(TRIM($${valIdx}))`;
  } else if (ALLOWED_STANDARD_FIELDS.includes(field)) {
    params.push(trimmedVal);
    return `LOWER(TRIM(COALESCE(r.${field}, ''))) = LOWER(TRIM($${params.length}))`;
  } else if (field === 'all') {
    params.push(trimmedVal);
    const qIndex = params.length;
    return `(
      LOWER(TRIM(r.excel_id)) = LOWER(TRIM($${qIndex})) OR
      LOWER(TRIM(r.name)) = LOWER(TRIM($${qIndex})) OR
      LOWER(TRIM(r.mobile)) = LOWER(TRIM($${qIndex})) OR
      LOWER(TRIM(r.email)) = LOWER(TRIM($${qIndex})) OR
      LOWER(TRIM(r.company)) = LOWER(TRIM($${qIndex})) OR
      EXISTS (
        SELECT 1 FROM jsonb_each_text(r.custom_fields) kv 
        WHERE LOWER(TRIM(kv.value)) = LOWER(TRIM($${qIndex}))
      )
    )`;
  }

  return null;
}

/**
 * Advanced Multi-Field Exact-Match search with filters, date ranges, and soft-delete handling.
 */
export async function searchRecords({
  queryText = '',
  q = null,
  searchField = 'all', // 'all', 'excel_id', 'name', 'mobile', 'email', 'company', or 'custom:<column_name>'
  datasetId = '',
  worksheet = '',
  criteria = [], // Array of { field, operator, value }
  criteriaCombination = 'AND', // 'AND' or 'OR'
  operator = null, // Alias for criteriaCombination
  dateFrom = '',
  dateTo = '',
  onlyDeleted = false,
  includeDeleted = false,
  page = 1,
  limit = 25,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  userId = null,
  username = 'anonymous',
}) {
  const trimmedQuery = String(q !== null ? q : queryText || '').trim();
  const activeCombination = (operator || criteriaCombination || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * pageSize;

  const validSortCol = ALLOWED_SORT_COLUMNS[sortBy] || 'r.created_at';
  const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const whereConditions = [];
  const params = [];

  // Soft-delete filter
  if (onlyDeleted) {
    whereConditions.push('r.is_deleted = TRUE');
  } else if (!includeDeleted) {
    whereConditions.push('r.is_deleted = FALSE');
  }

  // Filter by dataset
  if (datasetId) {
    params.push(datasetId);
    whereConditions.push(`r.dataset_id = $${params.length}`);
  }

  // Filter by worksheet
  if (worksheet) {
    params.push(worksheet);
    whereConditions.push(`d.worksheet_name = $${params.length}`);
  }

  // Date range filters
  if (dateFrom) {
    params.push(dateFrom);
    whereConditions.push(`r.created_at >= $${params.length}::timestamp`);
  }
  if (dateTo) {
    params.push(dateTo);
    whereConditions.push(`r.created_at <= $${params.length}::timestamp`);
  }

  // Simple query condition
  if (trimmedQuery) {
    const singleCond = buildFieldCondition(searchField, 'equals', trimmedQuery, params);
    if (singleCond) {
      whereConditions.push(singleCond);
    }
  }

  // Advanced multi-criteria builder
  if (Array.isArray(criteria) && criteria.length > 0) {
    const subConditions = [];
    for (const item of criteria) {
      if (item && item.field) {
        const cond = buildFieldCondition(item.field, item.operator || 'equals', item.value, params);
        if (cond) {
          subConditions.push(cond);
        }
      }
    }
    if (subConditions.length > 0) {
      const glue = activeCombination === 'OR' ? ' OR ' : ' AND ';
      whereConditions.push(`(${subConditions.join(glue)})`);
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total
    FROM records r
    LEFT JOIN datasets d ON r.dataset_id = d.id
    ${whereClause}
  `;
  const countRes = await query(countSql, params);
  const totalRecords = parseInt(countRes.rows[0]?.total || 0, 10);

  // Get paginated records
  const selectSql = `
    SELECT 
      r.id,
      r.dataset_id,
      r.excel_id,
      r.name,
      r.mobile,
      r.email,
      r.company,
      r.custom_fields,
      r.is_deleted,
      r.deleted_at,
      r.deleted_by,
      r.created_at,
      r.updated_at,
      d.name as dataset_name,
      d.source_filename,
      d.worksheet_name
    FROM records r
    LEFT JOIN datasets d ON r.dataset_id = d.id
    ${whereClause}
    ORDER BY ${validSortCol} ${validSortOrder}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const queryParams = [...params, pageSize, offset];
  const recordsRes = await query(selectSql, queryParams);

  // Log to search history if a search term was provided
  if ((trimmedQuery || criteria.length > 0) && userId) {
    try {
      const summary = trimmedQuery
        ? maskSearchCriteria(searchField, trimmedQuery)
        : `Advanced (${criteria.length} criteria)`;
      await query(`
        INSERT INTO search_history (user_id, username, search_field, criteria_summary, result_count, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [userId, username, searchField, summary, totalRecords]);
    } catch (err) {
      console.warn('⚠️ Could not log search history:', err.message);
    }
  }

  return {
    records: recordsRes.rows,
    pagination: {
      page: pageNum,
      limit: pageSize,
      totalRecords,
      totalPages: Math.ceil(totalRecords / pageSize),
    },
    filter: {
      queryText: trimmedQuery,
      searchField,
      datasetId,
      worksheet,
      criteria,
      criteriaCombination,
      dateFrom,
      dateTo,
      onlyDeleted,
      sortBy,
      sortOrder: validSortOrder,
    }
  };
}
