import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RotateCcw, Filter, Download, Trash2, Eye, Edit2,
  Database, Layers, FileSpreadsheet, Activity, ChevronLeft,
  ChevronRight, CheckSquare, Square, AlertCircle, Plus, History,
  Calendar, SlidersHorizontal, X, ArrowUpDown
} from 'lucide-react';
import { api } from '../services/api.js';

export default function Dashboard({
  onViewRecord,
  onEditRecord,
  onDeleteRecord,
  onViewVersions,
  onOpenDeletedRecords,
  onOpenExport,
  onOpenImport,
  refreshTrigger
}) {
  // Stats
  const [stats, setStats] = useState({ totalRecords: 0, totalDatasets: 0, totalImports: 0, totalSearches: 0 });
  const [datasets, setDatasets] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [datasetFilter, setDatasetFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Advanced Search Builder state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [criteria, setCriteria] = useState([]); // [{ field: 'name', operator: 'equals', value: '' }]
  const [criteriaLogic, setCriteriaLogic] = useState('AND'); // 'AND' or 'OR'
  const [worksheetFilter, setWorksheetFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Results state
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ totalRecords: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Load stats and datasets
  const loadMetadata = () => {
    api.getStats().then(setStats).catch(() => {});
    api.getDatasets().then(setDatasets).catch(() => {});
  };

  // Perform search
  const executeSearch = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const activeCriteria = criteria.filter(c => c.field && (c.operator.includes('empty') || c.value.trim() !== ''));
      const res = await api.searchRecords({
        q: searchQuery,
        field: searchField,
        datasetId: datasetFilter,
        worksheet: worksheetFilter,
        dateFrom,
        dateTo,
        criteria: activeCriteria.length > 0 ? activeCriteria : null,
        operator: criteriaLogic,
        page: targetPage,
        limit,
        sortBy,
        sortOrder,
      });
      setRecords(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err.message || 'Failed to search records.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchField, datasetFilter, worksheetFilter, dateFrom, dateTo, criteria, criteriaLogic, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    loadMetadata();
    executeSearch(1);
  }, [refreshTrigger, datasetFilter, sortBy, sortOrder, limit]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(1);
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setSearchField('all');
    setDatasetFilter('');
    setWorksheetFilter('');
    setDateFrom('');
    setDateTo('');
    setCriteria([]);
    setCriteriaLogic('AND');
    setSortBy('created_at');
    setSortOrder('DESC');
    setPage(1);
  };

  // Advanced Criteria builders
  const handleAddCriterion = () => {
    setCriteria(prev => [...prev, { field: 'name', operator: 'equals', value: '' }]);
  };

  const handleRemoveCriterion = (index) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCriterion = (index, key, val) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [key]: val } : c));
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(records.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} selected record(s)?\n\nThese will be safely moved to Deleted Records for recovery if needed.`
    );
    if (!confirmed) return;

    try {
      await api.batchDeleteRecords(selectedIds);
      setSelectedIds([]);
      loadMetadata();
      executeSearch(page);
    } catch (err) {
      alert(`Batch delete error: ${err.message}`);
    }
  };

  // Dynamically collect custom field names for search dropdown
  const customFieldNames = React.useMemo(() => {
    const names = new Set();
    records.forEach(r => {
      const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
      Object.keys(cf).forEach(k => names.add(k));
    });
    return Array.from(names);
  }, [records]);

  const isAllSelected = records.length > 0 && records.every(r => selectedIds.includes(r.id));

  return (
    <div>
      {/* 1. Summary Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon blue">
            <Database size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalRecords.toLocaleString()}</div>
            <div className="stat-label">Total Stored Records</div>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon emerald">
            <Layers size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalDatasets}</div>
            <div className="stat-label">Active Datasets</div>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon indigo">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalImports}</div>
            <div className="stat-label">Completed Imports</div>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon purple">
            <Activity size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalSearches}</div>
            <div className="stat-label">Logged Searches</div>
          </div>
        </div>
      </div>

      {/* 2. Exact-Match Search Panel */}
      <div className="search-panel glass-panel">
        <div className="search-title-row">
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Exact-Match Multi-Field Search
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Trims whitespace, applies case normalization, and preserves leading zeros
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${showAdvanced ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setShowAdvanced(!showAdvanced)}
              title="Toggle multi-criteria criteria builder"
            >
              <SlidersHorizontal size={14} /> {showAdvanced ? 'Simple Search' : 'Advanced Filters'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetSearch}
              title="Reset search criteria"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onOpenExport({
                selectedIds,
                totalFilteredCount: pagination.totalRecords,
                currentQuery: searchQuery,
                currentField: searchField,
                currentDataset: datasetFilter,
                customFields: customFieldNames,
              })}
            >
              <Download size={14} /> Export Results
            </button>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit}>
          <div className="search-grid">
            <div className="form-group">
              <label className="form-label">Search Term</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: '36px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter exact name, ID (e.g. 00101), phone, email..."
                />
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Search Field</label>
              <select
                className="select"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              >
                <option value="all">Search All Eligible Fields</option>
                <option value="excel_id">Excel Business ID</option>
                <option value="name">Full Name</option>
                <option value="mobile">Mobile Number</option>
                <option value="email">Email Address</option>
                <option value="company">Company / Department</option>
                {customFieldNames.map(f => (
                  <option key={f} value={`custom:${f}`}>Custom: {f}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Filter Dataset</label>
              <select
                className="select"
                value={datasetFilter}
                onChange={(e) => setDatasetFilter(e.target.value)}
              >
                <option value="">All Datasets</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '42px' }}
            >
              <Search size={16} /> Search
            </button>
          </div>

          {/* ADVANCED MULTI-FIELD SEARCH BUILDER */}
          {showAdvanced && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Multi-Field Match Logic:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn ${criteriaLogic === 'AND' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setCriteriaLogic('AND')}
                      style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                    >
                      AND (All Criteria Must Match)
                    </button>
                    <button
                      type="button"
                      className={`btn ${criteriaLogic === 'OR' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setCriteriaLogic('OR')}
                      style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                    >
                      OR (Any Criterion May Match)
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddCriterion}
                  style={{ fontSize: '0.75rem' }}
                >
                  <Plus size={13} /> Add Criterion
                </button>
              </div>

              {/* Extra Filters: Worksheet & Date Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Worksheet Filter</label>
                  <input
                    type="text"
                    className="input"
                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    placeholder="e.g. Sheet1, Customers..."
                    value={worksheetFilter}
                    onChange={(e) => setWorksheetFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Date Added (From)</label>
                  <input
                    type="date"
                    className="input"
                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Date Added (To)</label>
                  <input
                    type="date"
                    className="input"
                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Criteria List */}
              {criteria.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No extra criteria added yet. Click "+ Add Criterion" to specify simultaneous field constraints (e.g. Name = "Alice" AND Department = "Engineering").
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {criteria.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 150px 1fr 36px',
                        gap: '8px',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <select
                        className="select"
                        style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                        value={c.field}
                        onChange={(e) => handleUpdateCriterion(idx, 'field', e.target.value)}
                      >
                        <option value="excel_id">Excel Business ID</option>
                        <option value="name">Full Name</option>
                        <option value="mobile">Mobile Number</option>
                        <option value="email">Email Address</option>
                        <option value="company">Company / Department</option>
                        {customFieldNames.map(f => (
                          <option key={f} value={`custom:${f}`}>Custom: {f}</option>
                        ))}
                      </select>

                      <select
                        className="select"
                        style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                        value={c.operator}
                        onChange={(e) => handleUpdateCriterion(idx, 'operator', e.target.value)}
                      >
                        <option value="equals">Equals (=)</option>
                        <option value="not_equals">Does Not Equal (!=)</option>
                        <option value="is_empty">Is Empty / Null</option>
                        <option value="is_not_empty">Is Not Empty</option>
                      </select>

                      {!c.operator.includes('empty') ? (
                        <input
                          type="text"
                          className="input"
                          style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                          placeholder="Exact matching value..."
                          value={c.value}
                          onChange={(e) => handleUpdateCriterion(idx, 'value', e.target.value)}
                        />
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', paddingLeft: '8px' }}>
                          (Checks for empty/null field state)
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(idx)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        title="Remove criterion"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* 3. Action & Selection Bar */}
      <div className="actions-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing <strong>{records.length}</strong> of <strong>{pagination.totalRecords}</strong> matching records
          </span>

          {selectedIds.length > 0 && (
            <div className="bulk-actions">
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#818cf8' }}>
                {selectedIds.length} Selected
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenExport({
                  selectedIds,
                  totalFilteredCount: selectedIds.length,
                  currentQuery: searchQuery,
                  currentField: searchField,
                  currentDataset: datasetFilter,
                  customFields: customFieldNames,
                })}
              >
                <Download size={13} /> Export ({selectedIds.length})
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleBatchDelete}
              >
                <Trash2 size={13} /> Delete ({selectedIds.length})
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedIds([])}
                style={{ fontSize: '0.75rem' }}
              >
                Deselect
              </button>
            </div>
          )}
        </div>

        {/* Sort and Recovery controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onOpenDeletedRecords && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenDeletedRecords}
              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
              title="Open deleted records recycle bin & recovery"
            >
              <Trash2 size={13} color="var(--danger)" /> Recycle Bin
            </button>
          )}

          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Sort:</label>
          <select
            className="select"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="created_at">Date Added</option>
            <option value="excel_id">Excel ID</option>
            <option value="name">Name</option>
            <option value="company">Company</option>
          </select>
          <select
            className="select"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </select>
        </div>
      </div>

      {/* 4. Records Data Table */}
      <div className="table-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
            Loading records from database...
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              marginBottom: '14px'
            }}>
              <Search size={28} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>
              No Matching Records Found
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 16px' }}>
              {searchQuery || criteria.length > 0
                ? 'No exact match found for active query criteria. Review criteria or try searching across all fields.'
                : 'No records exist in the database yet. Click "Import Excel" to upload workbooks.'}
            </p>
            {(searchQuery || criteria.length > 0) && (
              <button className="btn btn-secondary btn-sm" onClick={handleResetSearch}>
                <RotateCcw size={14} /> Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Excel ID</th>
                <th>Full Name</th>
                <th>Mobile Number</th>
                <th>Email Address</th>
                <th>Company / Dept</th>
                <th>Dataset</th>
                <th>Custom Data</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isSelected = selectedIds.includes(r.id);
                const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
                const cfKeys = Object.keys(cf);

                return (
                  <tr key={r.id} style={{ background: isSelected ? 'rgba(79, 70, 229, 0.08)' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(r.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <span className="id-badge">{r.excel_id}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {r.name || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {r.mobile || '—'}
                    </td>
                    <td style={{ color: '#93c5fd', fontSize: '0.82rem' }}>
                      {r.email || '—'}
                    </td>
                    <td>
                      {r.company || '—'}
                    </td>
                    <td>
                      <span className="badge badge-dataset">
                        {r.dataset_name || 'Standard'}
                      </span>
                    </td>
                    <td>
                      {cfKeys.length > 0 ? (
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                          {cfKeys.length} extra {cfKeys.length === 1 ? 'col' : 'cols'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', marginRight: '6px' }}
                        onClick={() => onViewRecord(r)}
                        title="View Full Details"
                      >
                        <Eye size={14} />
                      </button>
                      {onViewVersions && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', marginRight: '6px' }}
                          onClick={() => onViewVersions(r)}
                          title="View Edit History & Undo"
                        >
                          <History size={14} color="#38bdf8" />
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', marginRight: '6px' }}
                        onClick={() => onEditRecord(r)}
                        title="Edit Record"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px' }}
                        onClick={() => onDeleteRecord(r)}
                        title="Delete Record (Soft Delete with Recovery)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 5. Pagination */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <div>
              Page <strong>{page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalRecords} records)
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => executeSearch(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => executeSearch(page + 1)}
                disabled={page >= pagination.totalPages}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
