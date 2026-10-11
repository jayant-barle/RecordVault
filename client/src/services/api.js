const API_BASE = '/api';

function getAuthHeaders(isJson = true) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    const data = await res.json();
    return data.user;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Records
  async searchRecords({ q = '', field = 'all', datasetId = '', page = 1, limit = 25, sortBy = 'created_at', sortOrder = 'DESC' }) {
    const params = new URLSearchParams({
      q,
      field,
      datasetId: datasetId || '',
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });
    const res = await fetch(`${API_BASE}/records?${params}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to search records');
    return data;
  },

  async getRecord(id) {
    const res = await fetch(`${API_BASE}/records/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to retrieve record');
    return data.data;
  },

  async updateRecord(id, payload) {
    const res = await fetch(`${API_BASE}/records/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update record');
    return data;
  },

  async deleteRecord(id) {
    const res = await fetch(`${API_BASE}/records/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete record');
    return data;
  },

  async batchDeleteRecords(ids) {
    const res = await fetch(`${API_BASE}/records/batch-delete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete records');
    return data;
  },

  // Datasets
  async getDatasets() {
    const res = await fetch(`${API_BASE}/datasets`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load datasets');
    return data.data;
  },

  async deleteDataset(id) {
    const res = await fetch(`${API_BASE}/datasets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete dataset');
    return data;
  },

  // Import
  async inspectFiles(fileList) {
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }
    const res = await fetch(`${API_BASE}/import/inspect`, {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to inspect Excel files');
    return data;
  },

  async commitImport(payload) {
    const res = await fetch(`${API_BASE}/import/commit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');
    return data;
  },

  // Export
  async exportExcel(payload) {
    const res = await fetch(`${API_BASE}/export/excel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to export Excel');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `records_export_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportPdf(payload) {
    const res = await fetch(`${API_BASE}/export/pdf`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to export PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `records_report_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Audit & History
  async getAuditLogs(page = 1, limit = 25) {
    const res = await fetch(`${API_BASE}/audit/logs?page=${page}&limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load audit logs');
    return data;
  },

  async getSearchHistory(limit = 30) {
    const res = await fetch(`${API_BASE}/audit/search-history?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load search history');
    return data.data;
  },

  async getStats() {
    const res = await fetch(`${API_BASE}/audit/stats`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load system stats');
    return data.data;
  },
};
