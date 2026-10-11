import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Download, AlertTriangle, AlertCircle, RefreshCw, CheckCircle, Database, Layers, Phone, Mail, Hash } from 'lucide-react';
import { api } from '../services/api.js';

export default function DataQualityModal({ onClose }) {
  const [report, setReport] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL'); // 'ALL', 'ERROR', 'WARNING'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (datasetId = selectedDataset) => {
    setLoading(true);
    setError('');
    try {
      const [analysis, dsList] = await Promise.all([
        api.getDataQuality(datasetId || null),
        api.getDatasets(),
      ]);
      setReport(analysis);
      setDatasets(dsList);
    } catch (err) {
      setError(err.message || 'Failed to run data quality analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData('');
  }, []);

  const handleDatasetChange = (dsId) => {
    setSelectedDataset(dsId);
    loadData(dsId);
  };

  const filteredIssues = React.useMemo(() => {
    if (!report?.issues) return [];
    if (severityFilter === 'ALL') return report.issues;
    return report.issues.filter(item =>
      item.issues.some(issue => issue.type === severityFilter)
    );
  }, [report, severityFilter]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '940px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#10b981" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Data Quality & Duplicate Audit Report</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Comprehensive dataset auditing: identifier collisions, format irregularities, and duplicate detection
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

          {/* Scope selection & export row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Scope:</label>
              <select
                className="select"
                style={{ padding: '6px 10px', fontSize: '0.82rem', width: 'auto' }}
                value={selectedDataset}
                onChange={(e) => handleDatasetChange(e.target.value)}
              >
                <option value="">All Datasets (Full Audit)</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.record_count} records)</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadData(selectedDataset)}
                title="Rerun analysis"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => api.downloadDataQualityCsv(selectedDataset || null)}
            >
              <Download size={14} /> Download CSV Report
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Analyzing records and detecting duplicate groups...
            </div>
          ) : report && (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Total Analyzed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {report.totalAnalyzed.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '4px' }}>Clean Records</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                    {report.cleanRecords.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#f87171', marginBottom: '4px' }}>Records with Errors</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>
                    {report.recordsWithErrors.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '4px' }}>Records with Warnings</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                    {report.recordsWithWarnings.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Duplicate Breakdown Grid */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>
                  Duplicate & Collision Diagnostics
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hash size={12} /> Dataset ID Dupes
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: report.categoryCounts.duplicateIdInDataset > 0 ? '#ef4444' : 'var(--text-main)', marginTop: '4px' }}>
                      {report.categoryCounts.duplicateIdInDataset}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={12} /> Cross-Dataset Conflicts
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: report.categoryCounts.crossDatasetConflicts > 0 ? '#f59e0b' : 'var(--text-main)', marginTop: '4px' }}>
                      {report.categoryCounts.crossDatasetConflicts}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} /> Shared Phones
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: report.categoryCounts.duplicatePhoneNumbers > 0 ? '#f59e0b' : 'var(--text-main)', marginTop: '4px' }}>
                      {report.categoryCounts.duplicatePhoneNumbers}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} /> Shared Emails
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: report.categoryCounts.duplicateEmails > 0 ? '#f59e0b' : 'var(--text-main)', marginTop: '4px' }}>
                      {report.categoryCounts.duplicateEmails}
                    </div>
                  </div>
                </div>
              </div>

              {/* Flagged Issues List */}
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Flagged Records ({filteredIssues.length})
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`btn ${severityFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setSeverityFilter('ALL')}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    All ({report.issues.length})
                  </button>
                  <button
                    type="button"
                    className={`btn ${severityFilter === 'ERROR' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setSeverityFilter('ERROR')}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    Errors Only
                  </button>
                  <button
                    type="button"
                    className={`btn ${severityFilter === 'WARNING' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setSeverityFilter('WARNING')}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    Warnings Only
                  </button>
                </div>
              </div>

              {filteredIssues.length === 0 ? (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)'
                }}>
                  <CheckCircle size={28} color="#10b981" style={{ margin: '0 auto 8px' }} />
                  <div>No data quality anomalies matching the selected filter.</div>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Excel ID</th>
                        <th>Name</th>
                        <th>Dataset</th>
                        <th>Flagged Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((item) => (
                        <tr key={item.recordId}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#38bdf8' }}>
                            {item.excel_id || '—'}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {item.name || '—'}
                          </td>
                          <td>
                            <span className="badge badge-dataset">{item.dataset_name || 'Standard'}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {item.issues.map((iss, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                  {iss.type === 'ERROR' ? (
                                    <AlertCircle size={13} color="#ef4444" />
                                  ) : (
                                    <AlertTriangle size={13} color="#f59e0b" />
                                  )}
                                  <span style={{ color: iss.type === 'ERROR' ? '#f87171' : '#fbbf24' }}>
                                    {iss.message}
                                  </span>
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
            </>
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
