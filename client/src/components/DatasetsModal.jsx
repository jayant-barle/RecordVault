import React, { useState, useEffect } from 'react';
import { X, Layers, Trash2, Calendar, FileSpreadsheet, RefreshCw, AlertTriangle, Search, History, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';

export default function DatasetsModal({ onClose, onDatasetChange, onSelectDatasetForSearch, onOpenImportHistory }) {
  const [datasets, setDatasets] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'conflicts'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [dsList, conflictList] = await Promise.all([
        api.getDatasets(),
        api.getDatasetConflicts().catch(() => []),
      ]);
      setDatasets(dsList);
      setConflicts(conflictList);
    } catch (err) {
      setError(err.message || 'Failed to load datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (dataset) => {
    const confirmation = window.prompt(
      `DESTRUCTIVE ACTION: You are about to delete dataset "${dataset.name}" and ALL ${dataset.record_count} associated records.\n\nType the dataset name "${dataset.name}" to confirm:`
    );
    if (confirmation !== dataset.name) {
      if (confirmation !== null) alert('Deletion cancelled: Dataset name did not match.');
      return;
    }

    setDeletingId(dataset.id);
    try {
      await api.deleteDataset(dataset.id);
      loadData();
      if (onDatasetChange) onDatasetChange();
    } catch (err) {
      alert(`Failed to delete dataset: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', width: '95%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Dataset & Source Management</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Inspect source workbooks, manage datasets, and audit cross-dataset ID collisions
              </div>
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
              color: 'var(--danger)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '14px',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <button
              type="button"
              className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('list')}
            >
              <Layers size={14} /> Active Datasets ({datasets.length})
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'conflicts' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('conflicts')}
              style={{ position: 'relative' }}
            >
              <AlertTriangle size={14} color={conflicts.length > 0 ? '#f59e0b' : undefined} />
              Cross-Dataset ID Conflicts ({conflicts.length})
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
              Loading dataset telemetry...
            </div>
          ) : activeTab === 'list' ? (
            datasets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                No datasets loaded yet. Click "Import Excel" to upload workbooks.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {datasets.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px'
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                        {d.name}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span>Source: <strong>{d.source_filename || 'Excel'}</strong></span>
                        {d.worksheet_name && <span>Sheet: <strong>{d.worksheet_name}</strong></span>}
                        <span>Last Updated: {new Date(d.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
                          {d.record_count}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>records</div>
                      </div>

                      {onSelectDatasetForSearch && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            onSelectDatasetForSearch(d.id);
                            onClose();
                          }}
                          title="Search only within this dataset"
                        >
                          <Search size={13} /> Filter
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(d)}
                        disabled={deletingId === d.id}
                        title="Delete this dataset and its records (requires confirmation)"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Conflicts Tab */
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                The following business IDs exist across multiple distinct datasets. In business context, verify whether these represent the same individual or distinct accounts across scopes:
              </div>

              {conflicts.length === 0 ? (
                <div style={{
                  padding: '30px',
                  textAlign: 'center',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)'
                }}>
                  <Layers size={28} color="#10b981" style={{ margin: '0 auto 8px' }} />
                  <div>No cross-dataset identifier collisions detected. All active IDs belong to unique sources.</div>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Excel ID</th>
                        <th>Datasets Involved</th>
                        <th>Associated Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.map(c => (
                        <tr key={c.excelId}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                            {c.excelId}
                          </td>
                          <td>
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 600 }}>
                              {c.datasetCount} Datasets ({c.recordsCount} total)
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {c.records.map(r => (
                                <div key={r.record_id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  <strong style={{ color: 'var(--text-main)' }}>{r.dataset_name}:</strong> {r.name || 'Unnamed'} {r.mobile ? `(${r.mobile})` : ''}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
