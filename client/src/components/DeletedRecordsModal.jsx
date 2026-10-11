import React, { useState, useEffect } from 'react';
import { X, Trash2, RotateCcw, AlertTriangle, Search, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

export default function DeletedRecordsModal({ onClose, onRecordRestored }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const loadDeleted = async (targetPage = page, query = search) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDeletedRecords({ page: targetPage, limit: 15, q: query });
      setRecords(res.data);
      setPagination(res.pagination);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err.message || 'Failed to load deleted records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeleted(1);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDeleted(1, search);
  };

  const handleRestore = async (record) => {
    const confirmed = window.confirm(
      `Restore record ${record.excel_id} (${record.name || 'Unnamed'}) back to active status?`
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await api.restoreDeletedRecord(record.id);
      setSuccess(`Record ${record.excel_id} restored successfully.`);
      if (onRecordRestored) onRecordRestored();
      loadDeleted(page);
    } catch (err) {
      setError(err.message || 'Failed to restore record. Check for conflicting active record with same ID.');
    }
  };

  const handlePermanentDelete = async (record) => {
    const confirmed = window.confirm(
      `PERMANENTLY DELETE record ${record.excel_id} (${record.name || 'Unnamed'})?\n\nWARNING: This will permanently purge the record from the database. This action CANNOT be undone.`
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await api.permanentDeleteRecord(record.id);
      setSuccess(`Record ${record.excel_id} permanently purged.`);
      loadDeleted(page);
    } catch (err) {
      setError(err.message || 'Failed to permanently delete record.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={20} color="var(--danger)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Deleted Records & Recovery</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Recover soft-deleted business records or permanently purge selected entries
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: 'var(--success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--success)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '34px' }}
                placeholder="Search deleted records by ID, name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-dim)' }} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); loadDeleted(1, ''); }}
            >
              <RefreshCw size={14} />
            </button>
          </form>

          {/* Table */}
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading deleted records...
            </div>
          ) : records.length === 0 ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)'
            }}>
              <Trash2 size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div>No deleted records found. The recycle bin is empty.</div>
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Excel ID</th>
                    <th>Name</th>
                    <th>Dataset</th>
                    <th>Deleted By</th>
                    <th>Deleted At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                        {r.excel_id}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {r.name || '—'}
                      </td>
                      <td>
                        <span className="badge badge-dataset">{r.dataset_name || 'Standard'}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {r.deleted_by || 'Unknown'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {new Date(r.deleted_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRestore(r)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Restore record back to active records"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handlePermanentDelete(r)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Permanently remove from database"
                          >
                            Purge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => loadDeleted(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => loadDeleted(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
