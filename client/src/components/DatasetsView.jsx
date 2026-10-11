import React, { useState, useEffect } from 'react';
import { Layers, Trash2, Calendar, FileSpreadsheet, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function DatasetsView({ onDatasetSelect }) {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const res = await api.getDatasets();
      if (res.success) {
        setDatasets(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleDelete = async (dataset) => {
    if (!window.confirm(`Are you sure you want to delete dataset "${dataset.name}"?\n\nThis will permanently delete all ${dataset.record_count} associated records from the database.`)) {
      return;
    }

    setDeletingId(dataset.id);
    try {
      const res = await api.deleteDataset(dataset.id);
      if (res.success) {
        setDatasets(prev => prev.filter(d => d.id !== dataset.id));
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={22} color="var(--primary)" />
            <span>Imported Datasets & Sources</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Manage source files, worksheets, and isolated record collections.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchDatasets} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading dataset inventory...
        </div>
      ) : datasets.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileSpreadsheet size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <p>No Excel datasets imported yet.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Click "Import Excel" in the top header to load business files.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset Name</th>
                <th>Source File</th>
                <th>Worksheet</th>
                <th>Record Count</th>
                <th>Imported / Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(ds => (
                <tr key={ds.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ color: '#fff' }}>{ds.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {ds.id.slice(0, 8)}...</div>
                  </td>
                  <td>{ds.source_filename || '—'}</td>
                  <td>
                    <span className="badge badge-indigo">{ds.worksheet_name || 'Sheet1'}</span>
                  </td>
                  <td>
                    <span className="badge badge-emerald">{ds.record_count} records</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {new Date(ds.updated_at || ds.created_at).toLocaleDateString()} {new Date(ds.updated_at || ds.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onDatasetSelect(ds.id)}
                        title="Filter records by this dataset"
                      >
                        View Records
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(ds)}
                        disabled={deletingId === ds.id}
                        title="Delete entire dataset and its records"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
