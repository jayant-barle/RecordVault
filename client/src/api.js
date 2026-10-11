const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default Content-Type to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Session expired or unauthorized. Please log in.');
  }

  // Handle binary download responses (Excel, PDF)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/vnd.openxmlformats') || contentType.includes('application/pdf')) {
    if (!res.ok) {
      throw new Error(`Export failed with status ${res.status}`);
    }
    return await res.blob();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request('/auth/me'),

  // Records
  searchRecords: (params = {}) => {
    const q = new URLSearchParams();
    if (params.queryText) q.append('q', params.queryText);
    if (params.searchField) q.append('field', params.searchField);
    if (params.datasetId) q.append('datasetId', params.datasetId);
    if (params.page) q.append('page', params.page);
    if (params.limit) q.append('limit', params.limit);
    if (params.sortBy) q.append('sortBy', params.sortBy);
    if (params.sortOrder) q.append('sortOrder', params.sortOrder);
    return request(`/records?${q.toString()}`);
  },
  getRecord: (id) => request(`/records/${id}`),
  updateRecord: (id, updates) =>
    request(`/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  deleteRecord: (id) =>
    request(`/records/${id}`, {
      method: 'DELETE',
    }),
  batchDeleteRecords: (ids) =>
    request('/records/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Datasets
  getDatasets: () => request('/datasets'),
  deleteDataset: (id) =>
    request(`/datasets/${id}`, {
      method: 'DELETE',
    }),

  // Import
  inspectExcelFiles: (formData) =>
    request('/import/inspect', {
      method: 'POST',
      body: formData,
    }),
  commitImport: (payload) =>
    request('/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Export
  exportExcel: (payload) =>
    request('/export/excel', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  exportPdf: (payload) =>
    request('/export/pdf', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Audit & History
  getAuditLogs: (page = 1, limit = 30) =>
    request(`/audit/logs?page=${page}&limit=${limit}`),
  getSearchHistory: (limit = 30) =>
    request(`/audit/search-history?limit=${limit}`),
  getAuditStats: () => request('/audit/stats'),
  getHealth: () => request('/health'),
};
