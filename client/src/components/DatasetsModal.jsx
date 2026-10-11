import React, { useState, useEffect } from 'react';
import { X, Layers, Trash2, Calendar, FileSpreadsheet, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api.js';

export default function DatasetsModal({ onClose, onDatasetChange }) {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadDatasets = () => {
    setLoading(true);
    api.getDatasets()
      .then(setDatasets)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleDelete = async (dataset) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete dataset "${dataset.name}"?\n\nThis will permanently delete all ${dataset.record_count} associated records from the database.`
    );
    if (!confirmed) return;

    setDeletingId(dataset.id);
    try {
      await api.deleteDataset(dataset.id);
      loadDatasets();
      if (onDatasetChange) onDatasetChange();
    } catch (err) {
      alert(`Failed to delete dataset: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Active Datasets</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Worksheet containers and sources loaded into the database
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

        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '14px'
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
              Loading datasets...
            </div>
          ) : datasets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
              No datasets loaded yet. Click "Import Excel" to upload workbooks.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
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
                      <span>Updated: {new Date(d.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
                        {d.record_count}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>records</div>
                    </div>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      title="Delete this dataset and its records"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
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
