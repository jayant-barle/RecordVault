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
  async searchRecords({ q = '', field = 'all', datasetId = '', worksheet = '', dateFrom = '', dateTo = '', criteria = null, operator = 'AND', page = 1, limit = 25, sortBy = 'created_at', sortOrder = 'DESC' }) {
    const params = new URLSearchParams({
      q,
      field,
      datasetId: datasetId || '',
      worksheet: worksheet || '',
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      operator: operator || 'AND',
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });
    if (criteria && Array.isArray(criteria) && criteria.length > 0) {
      params.append('criteria', JSON.stringify(criteria));
    }
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

  // Soft Deletion & Record Versions
  async getDeletedRecords({ page = 1, limit = 25, q = '' } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), q });
    const res = await fetch(`${API_BASE}/records/deleted?${params}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load deleted records');
    return data;
  },

  async restoreDeletedRecord(id) {
    const res = await fetch(`${API_BASE}/records/${id}/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to restore record');
    return data;
  },

  async permanentDeleteRecord(id) {
    const res = await fetch(`${API_BASE}/records/${id}/permanent`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to permanently delete record');
    return data;
  },

  async getRecordVersions(id) {
    const res = await fetch(`${API_BASE}/records/${id}/versions`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load record version history');
    return data.data;
  },

  async undoRecordEdit(id, versionId) {
    const res = await fetch(`${API_BASE}/records/${id}/undo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ versionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to undo edit');
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

  async getDataset(id) {
    const res = await fetch(`${API_BASE}/datasets/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load dataset details');
    return data.data;
  },

  async getDatasetConflicts() {
    const res = await fetch(`${API_BASE}/datasets/conflicts`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to check dataset conflicts');
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

  async getImportHistory() {
    const res = await fetch(`${API_BASE}/import/history`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load import history');
    return data.data;
  },

  async rollbackImport(jobId) {
    const res = await fetch(`${API_BASE}/import/jobs/${jobId}/rollback`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to rollback import');
    return data;
  },

  async downloadErrorReport(jobId) {
    const res = await fetch(`${API_BASE}/import/jobs/${jobId}/error-report`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to download error report');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_error_report_${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
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

  // Database Backup and Restore
  async getBackups() {
    const res = await fetch(`${API_BASE}/backup/list`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to list backups');
    return data.data;
  },

  async createBackup({ description = '' } = {}) {
    const res = await fetch(`${API_BASE}/backup/create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create backup');
    return data;
  },

  async restoreBackup(backupId) {
    const res = await fetch(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ backupId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to restore backup');
    return data;
  },

  async getBackupSchedule() {
    const res = await fetch(`${API_BASE}/backup/schedule`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load backup schedule');
    return data.data;
  },

  async updateBackupSchedule(payload) {
    const res = await fetch(`${API_BASE}/backup/schedule`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update backup schedule');
    return data;
  },

  async downloadBackup(backupId) {
    const res = await fetch(`${API_BASE}/backup/${backupId}/download`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to download backup file');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_backup_${backupId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // Data Quality & Duplicate Detection
  async getDataQuality(datasetId = null) {
    const url = datasetId ? `${API_BASE}/data-quality?datasetId=${datasetId}` : `${API_BASE}/data-quality`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to run data quality analysis');
    return data.data;
  },

  async downloadDataQualityCsv(datasetId = null) {
    const url = datasetId ? `${API_BASE}/data-quality/export?datasetId=${datasetId}` : `${API_BASE}/data-quality/export`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to download data quality CSV');
    const blob = await res.blob();
    const dlUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `data_quality_report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(dlUrl);
  },

  // LAN & System Health
  async getSystemHealth() {
    const res = await fetch(`${API_BASE}/system/health`);
    const data = await res.json();
    return data;
  },

  async getSystemInfo() {
    const res = await fetch(`${API_BASE}/system/info`);
    const data = await res.json();
    return data;
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
