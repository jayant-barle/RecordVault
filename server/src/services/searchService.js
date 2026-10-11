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
 * Exact-match search across standard and dynamic custom columns.
 */
export async function searchRecords({
  queryText = '',
  searchField = 'all', // 'all', 'excel_id', 'name', 'mobile', 'email', 'company', or 'custom:<column_name>'
  datasetId = '',
  page = 1,
  limit = 25,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  userId = null,
  username = 'anonymous',
}) {
  const trimmedQuery = String(queryText || '').trim();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * pageSize;

  const validSortCol = ALLOWED_SORT_COLUMNS[sortBy] || 'r.created_at';
  const validSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const whereConditions = [];
  const params = [];

  // Filter by dataset if specified
  if (datasetId) {
    params.push(datasetId);
    whereConditions.push(`r.dataset_id = $${params.length}`);
  }

  // Exact-match condition
  if (trimmedQuery) {
    if (searchField === 'all') {
      params.push(trimmedQuery);
      const qIndex = params.length;
      whereConditions.push(`(
        LOWER(TRIM(r.excel_id)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.name)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.mobile)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.email)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.company)) = LOWER(TRIM($${qIndex})) OR
        EXISTS (
          SELECT 1 FROM jsonb_each_text(r.custom_fields) kv 
          WHERE LOWER(TRIM(kv.value)) = LOWER(TRIM($${qIndex}))
        )
      )`);
    } else if (ALLOWED_STANDARD_FIELDS.includes(searchField)) {
      params.push(trimmedQuery);
      const qIndex = params.length;
      whereConditions.push(`LOWER(TRIM(r.${searchField})) = LOWER(TRIM($${qIndex}))`);
    } else if (searchField.startsWith('custom:')) {
      const customColName = searchField.replace('custom:', '').trim();
      params.push(customColName);
      const colIndex = params.length;
      params.push(trimmedQuery);
      const valIndex = params.length;
      whereConditions.push(`LOWER(TRIM(r.custom_fields->>$${colIndex})) = LOWER(TRIM($${valIndex}))`);
    } else {
      // Default fallback to all
      params.push(trimmedQuery);
      const qIndex = params.length;
      whereConditions.push(`(
        LOWER(TRIM(r.excel_id)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.name)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.mobile)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.email)) = LOWER(TRIM($${qIndex})) OR
        LOWER(TRIM(r.company)) = LOWER(TRIM($${qIndex}))
      )`);
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total
    FROM records r
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
      r.created_at,
      r.updated_at,
      d.name as dataset_name,
      d.source_filename
    FROM records r
    LEFT JOIN datasets d ON r.dataset_id = d.id
    ${whereClause}
    ORDER BY ${validSortCol} ${validSortOrder}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const queryParams = [...params, pageSize, offset];
  const recordsRes = await query(selectSql, queryParams);

  // Log to search history if a search term was provided
  if (trimmedQuery && userId) {
    try {
      const masked = maskSearchCriteria(searchField, trimmedQuery);
      await query(`
        INSERT INTO search_history (user_id, username, search_field, criteria_summary, result_count, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [userId, username, searchField, masked, totalRecords]);
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
      sortBy,
      sortOrder: validSortOrder,
    }
  };
}
