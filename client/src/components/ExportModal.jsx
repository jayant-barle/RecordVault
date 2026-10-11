import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, FileText, Download, ShieldCheck, Check, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { api } from '../services/api.js';

const DEFAULT_COLUMNS = [
  { key: 'excel_id', label: 'Excel Business ID' },
  { key: 'name', label: 'Full Name' },
  { key: 'mobile', label: 'Mobile Number' },
  { key: 'email', label: 'Email Address' },
  { key: 'company', label: 'Company / Dept' },
  { key: 'worksheet_name', label: 'Worksheet' },
  { key: 'created_at', label: 'Created At' },
];

export default function ExportModal({
  selectedIds = [],
  totalFilteredCount = 0,
  currentQuery = '',
  currentField = 'all',
  currentDataset = '',
  customFields = [],
  onClose
}) {
  const [exportScope, setExportScope] = useState(selectedIds.length > 0 ? 'selected' : 'all');
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' or 'pdf'
  const [reportTitle, setReportTitle] = useState('Record Management Export Report');
  
  // Available & selected columns
  const [columns, setColumns] = useState(() => {
    const list = [...DEFAULT_COLUMNS];
    (customFields || []).forEach(cf => {
      list.push({ key: `custom:${cf}`, label: `Custom: ${cf}` });
    });
    return list;
  });

  const [selectedColKeys, setSelectedColKeys] = useState(() => DEFAULT_COLUMNS.map(c => c.key));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const toggleColumn = (key) => {
    setSelectedColKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllCols = () => {
    setSelectedColKeys(columns.map(c => c.key));
  };

  const handleClearAllCols = () => {
    setSelectedColKeys([]);
  };

  const handleResetDefaults = () => {
    setSelectedColKeys(DEFAULT_COLUMNS.map(c => c.key));
  };

  const moveColumn = (index, direction) => {
    const newColumns = [...columns];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    const temp = newColumns[index];
    newColumns[index] = newColumns[targetIndex];
    newColumns[targetIndex] = temp;
    setColumns(newColumns);
  };

  const handleExport = async () => {
    if (selectedColKeys.length === 0) {
      setError('Please select at least one column to export.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Preserve user ordered selection
      const orderedSelectedColumns = columns
        .filter(c => selectedColKeys.includes(c.key))
        .map(c => c.key);

      const payload = {
        selectedIds: exportScope === 'selected' ? selectedIds : [],
        datasetId: currentDataset,
        queryText: currentQuery,
        searchField: currentField,
        selectedColumns: orderedSelectedColumns,
        reportTitle: reportTitle.trim() || 'Record Management Export',
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Custom Column Export</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configure columns, format, and download sanitized business reports
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
              <Check size={18} />
              <span>Export generated and downloaded successfully!</span>
            </div>
          )}

          {/* Report Title */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Report Title</label>
            <input
              type="text"
              className="input"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="e.g. Q4 Executive Customer Directory"
            />
          </div>

          {/* Scope Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Export Scope</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className={`btn ${exportScope === 'selected' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportScope('selected')}
                disabled={selectedIds.length === 0}
                style={{ fontSize: '0.85rem', padding: '10px' }}
              >
                Selected Records ({selectedIds.length})
              </button>

              <button
                type="button"
                className={`btn ${exportScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportScope('all')}
                style={{ fontSize: '0.85rem', padding: '10px' }}
              >
                All Filtered Matches ({totalFilteredCount})
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Output Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                onClick={() => setExportFormat('excel')}
                style={{
                  border: exportFormat === 'excel' ? '2px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                  background: exportFormat === 'excel' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.2)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <FileSpreadsheet size={26} color="#10b981" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Excel Workbook (.xlsx)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Preserves 0s, auto column widths</div>
              </div>

              <div
                onClick={() => setExportFormat('pdf')}
                style={{
                  border: exportFormat === 'pdf' ? '2px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                  background: exportFormat === 'pdf' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.2)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <FileText size={26} color="#f43f5e" style={{ margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>PDF Document (.pdf)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Landscape table with page breaks</div>
              </div>
            </div>
          </div>

          {/* Column Selection & Ordering */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0 }}>
                Select & Order Columns ({selectedColKeys.length} selected)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSelectAllCols}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAllCols}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  Clear All
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetDefaults}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  <RotateCcw size={10} /> Reset Defaults
                </button>
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              maxHeight: '190px',
              overflowY: 'auto',
              padding: '6px'
            }}>
              {columns.map((col, idx) => {
                const isSelected = selectedColKeys.includes(col.key);
                return (
                  <div
                    key={col.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                      borderBottom: idx < columns.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleColumn(col.key)}
                      />
                      <span style={{ fontWeight: isSelected ? 600 : 400 }}>{col.label}</span>
                    </label>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => moveColumn(idx, -1)}
                        disabled={idx === 0}
                        style={{ background: 'transparent', border: 'none', color: idx === 0 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: idx === 0 ? 'default' : 'pointer' }}
                        title="Move column left/up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(idx, 1)}
                        disabled={idx === columns.length - 1}
                        style={{ background: 'transparent', border: 'none', color: idx === columns.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: idx === columns.length - 1 ? 'default' : 'pointer' }}
                        title="Move column right/down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '10px 14px',
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
            disabled={loading || selectedColKeys.length === 0}
          >
            <Download size={15} /> {loading ? 'Generating...' : `Export ${exportFormat.toUpperCase()} (${selectedColKeys.length} cols)`}
          </button>
        </div>
      </div>
    </div>
  );
}
