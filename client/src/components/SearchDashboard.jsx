import React, { useState, useEffect } from 'react';
import {
  Search, Filter, ArrowUpDown, Download, Trash2, Eye, Edit2,
  RefreshCw, CheckSquare, Square, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, AlertCircle
} from 'lucide-react';
import { api } from '../api';

const SEARCH_FIELDS = [
  { value: 'all', label: 'All Columns (Exact Match)' },
  { value: 'excel_id', label: 'Excel ID' },
  { value: 'name', label: 'Full Name' },
  { value: 'mobile', label: 'Mobile Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'company', label: 'Company / Department' },
];

export default function SearchDashboard({
  onViewRecord,
  onEditRecord,
  onOpenImport,
  initialDatasetId = '',
  refreshTrigger = 0
}) {
  // Query parameters
  const [queryText, setQueryText] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [datasetId, setDatasetId] = useState(initialDatasetId);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Data state
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ totalRecords: 0, totalPages: 1 });
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Sync initialDatasetId
  useEffect(() => {
    if (initialDatasetId) {
      setDatasetId(initialDatasetId);
      setPage(1);
    }
  }, [initialDatasetId]);

  // Load datasets for filter dropdown
  useEffect(() => {
    api.getDatasets().then(res => {
      if (res.success) setDatasets(res.data || []);
    }).catch(console.error);
  }, [refreshTrigger]);

  // Perform search query
  const executeSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.searchRecords({
        queryText: queryText.trim(),
        searchField,
        datasetId,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      if (res.success) {
        setRecords(res.data || []);
        setPagination(res.pagination || { totalRecords: 0, totalPages: 1 });
      } else {
        setError(res.error || 'Failed to search records');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with search backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch();
  }, [page, limit, sortBy, sortOrder, datasetId, refreshTrigger]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSelectedIds([]);
    executeSearch();
  };

  const handleClearSearch = () => {
    setQueryText('');
    setSearchField('all');
    setDatasetId('');
    setPage(1);
    setSelectedIds([]);
  };

  // Selection toggles
  const toggleSelectAll = () => {
    if (selectedIds.length === records.length && records.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Sort toggle
  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(col);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  // Single delete
  const handleDeleteSingle = async (rec) => {
    if (!window.confirm(`Are you sure you want to delete record with Excel ID "${rec.excel_id}" (${rec.name})?`)) {
      return;
    }

    try {
      const res = await api.deleteRecord(rec.id);
      if (res.success) {
        setSelectedIds(prev => prev.filter(x => x !== rec.id));
        executeSearch();
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Batch delete
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected record(s)?`)) {
      return;
    }

    try {
      const res = await api.batchDeleteRecords(selectedIds);
      if (res.success) {
        setSelectedIds([]);
        executeSearch();
      }
    } catch (err) {
      alert(`Batch delete failed: ${err.message}`);
    }
  };

  // Export handlers
  const handleExport = async (format) => {
    setExporting(true);
    try {
      const payload = {
        selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
        datasetId: datasetId || undefined,
        queryText: queryText.trim() || undefined,
        searchField: searchField !== 'all' ? searchField : undefined,
      };

      const blob = format === 'excel'
        ? await api.exportExcel(payload)
        : await api.exportPdf(payload);

      // Trigger browser file download
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `records_export_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Search Bar Panel */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div className="search-bar-container">
            <div className="search-input-wrap">
              <Search size={18} />
              <input
                type="text"
                className="form-input"
                placeholder="Exact-match query (e.g. 00101, Diya Patel, 09876543210)..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                className="form-select"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              >
                {SEARCH_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                className="form-select"
                value={datasetId}
                onChange={(e) => { setDatasetId(e.target.value); setPage(1); }}
              >
                <option value="">All Datasets ({datasets.length})</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.record_count})</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={16} />
              <span>Exact Search</span>
            </button>

            {(queryText || datasetId || searchField !== 'all') && (
              <button type="button" className="btn btn-secondary" onClick={handleClearSearch}>
                Clear Filters
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Action Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Total Found: <strong style={{ color: '#fff' }}>{pagination.totalRecords}</strong> records
          </span>
          {selectedIds.length > 0 && (
            <span className="badge badge-indigo">
              {selectedIds.length} Selected
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {selectedIds.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}>
              <Trash2 size={14} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('excel')}
            disabled={exporting || pagination.totalRecords === 0}
            title={selectedIds.length > 0 ? "Export selected records to Excel" : "Export all filtered results to Excel"}
          >
            <FileSpreadsheet size={14} color="#10b981" />
            <span>{selectedIds.length > 0 ? `Export (${selectedIds.length}) Excel` : 'Export All Excel'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('pdf')}
            disabled={exporting || pagination.totalRecords === 0}
            title={selectedIds.length > 0 ? "Export selected records to PDF" : "Export all filtered results to PDF"}
          >
            <FileText size={14} color="#ef4444" />
            <span>{selectedIds.length > 0 ? `Export (${selectedIds.length}) PDF` : 'Export All PDF'}</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={executeSearch} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={records.length > 0 && selectedIds.length === records.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th className="sortable" onClick={() => handleSort('excel_id')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Excel ID</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('name')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Name</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('mobile')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Mobile</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('email')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Email</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('company')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Company / Dept</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th>Dataset</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading matching records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <AlertCircle size={36} style={{ margin: '0 auto 0.75rem auto', color: 'var(--text-muted)' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>No Matching Business Records Found</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {queryText
                      ? `No exact matches for "${queryText}". Remember search uses exact matching.`
                      : 'No records exist in the selected dataset.'}
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={onOpenImport}>
                    Import New Excel File
                  </button>
                </td>
              </tr>
            ) : (
              records.map(rec => {
                const isSelected = selectedIds.includes(rec.id);
                return (
                  <tr key={rec.id} className={isSelected ? 'selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(rec.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#818cf8' }}>
                      {rec.excel_id}
                    </td>
                    <td style={{ fontWeight: 500, color: '#fff' }}>
                      {rec.name || '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {rec.mobile || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {rec.email || '—'}
                    </td>
                    <td>
                      {rec.company || '—'}
                    </td>
                    <td>
                      <span className="badge badge-emerald" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rec.dataset_name || 'Dataset'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewRecord(rec)}
                          title="View Full Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onEditRecord(rec)}
                          title="Edit Record"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteSingle(rec)}
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="pagination-wrap">
          <div>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalRecords} records)
          </div>
          <div className="pagination-controls">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage(prev => Math.min(pagination.totalPages, prev + 1))}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
