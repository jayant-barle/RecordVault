import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Download, ShieldCheck, Check } from 'lucide-react';
import { api } from '../services/api.js';

export default function ExportModal({ selectedIds = [], totalFilteredCount = 0, currentQuery = '', currentField = 'all', currentDataset = '', onClose }) {
  const [exportScope, setExportScope] = useState(selectedIds.length > 0 ? 'selected' : 'all');
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' or 'pdf'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setError('');
    setLoading(true);

    try {
      const payload = {
        selectedIds: exportScope === 'selected' ? selectedIds : [],
        datasetId: currentDataset,
        queryText: currentQuery,
        searchField: currentField,
      };

      if (exportFormat === 'excel') {
        await api.exportExcel(payload);
      } else {
        await api.exportPdf(payload);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Export generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Export Records</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Server-Side Sanitized Excel & Structured PDF Reports
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
              <Check size={18} />
              <span>Export downloaded successfully!</span>
            </div>
          )}

          {/* Scope Selection */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Export Scope</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${exportScope === 'selected' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportScope('selected')}
                disabled={selectedIds.length === 0}
                style={{ fontSize: '0.85rem', padding: '10px' }}
              >
                Selected ({selectedIds.length})
              </button>

              <button
                type="button"
                className={`btn ${exportScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportScope('all')}
                style={{ fontSize: '0.85rem', padding: '10px' }}
              >
                All Filtered ({totalFilteredCount})
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Export Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                onClick={() => setExportFormat('excel')}
                style={{
                  border: exportFormat === 'excel' ? '2px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                  background: exportFormat === 'excel' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.2)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <FileSpreadsheet size={28} color="#10b981" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Excel (.xlsx)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Preserves 0s as text & all columns</div>
              </div>

              <div
                onClick={() => setExportFormat('pdf')}
                style={{
                  border: exportFormat === 'pdf' ? '2px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                  background: exportFormat === 'pdf' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.2)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <FileText size={28} color="#f43f5e" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>PDF Report (.pdf)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Landscape table with page breaks</div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldCheck size={18} color="var(--success)" />
            <span>Formula injection defense active: Untrusted strings prefixed with <code>=, +, -, @</code> are neutralized automatically.</span>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading}
          >
            <Download size={15} /> {loading ? 'Generating...' : `Download ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
