import React, { useState, useEffect } from 'react';
import { X, History, RotateCcw, Download, CheckCircle2, AlertTriangle, FileSpreadsheet, Clock, User, ShieldAlert } from 'lucide-react';
import { api } from '../services/api.js';

export default function ImportHistoryModal({ onClose, onRollbackComplete }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getImportHistory();
      setJobs(data);
    } catch (err) {
      setError(err.message || 'Failed to load import history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRollback = async (job) => {
    const confirmed = window.confirm(
      `ROLLBACK IMPORT JOB #${job.id}:\n\nSource: ${job.filename} (${job.worksheet})\nDataset: ${job.dataset_name || 'Standard'}\nRows Affected: ${job.inserted_count} inserted, ${job.updated_count} updated\n\nRollback will reverse inserted records and restore previous versions of updated records without affecting subsequent edits or other datasets.\n\nProceed with rollback?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.rollbackImport(job.id);
      setSuccess(`Import #${job.id} rolled back successfully! (Removed ${res.deletedCount} inserted records, restored ${res.restoredCount} updated records).`);
      if (onRollbackComplete) onRollbackComplete();
      loadHistory();
    } catch (err) {
      setError(err.message || 'Failed to rollback import.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={20} color="var(--primary-light)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Excel Import History & Atomic Rollback</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Inspect past import jobs, audit journals, error reports, and reverse changes safely
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

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading import history...
            </div>
          ) : jobs.length === 0 ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)'
            }}>
              <FileSpreadsheet size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div>No import jobs recorded yet.</div>
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Source & Sheet</th>
                    <th>Dataset</th>
                    <th>Mode</th>
                    <th>Outcome</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const isRolledBack = !job.can_rollback && job.rolled_back_at;
                    const hasErrors = job.failed_count > 0;

                    return (
                      <tr key={job.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#38bdf8' }}>
                          #{job.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{job.filename}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Worksheet: {job.worksheet}</div>
                        </td>
                        <td>
                          <span className="badge badge-dataset">{job.dataset_name || 'Standard'}</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: job.mode === 'REPLACE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: job.mode === 'REPLACE' ? '#f87171' : '#34d399'
                          }}>
                            {job.mode}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>
                          <div>+{job.inserted_count} / ~{job.updated_count}</div>
                          {hasErrors && (
                            <div style={{ color: '#fb7185', fontWeight: 600 }}>! {job.failed_count} failed</div>
                          )}
                        </td>
                        <td>
                          {isRolledBack ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                              ROLLED BACK
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: job.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: job.status === 'COMPLETED' ? '#34d399' : '#f87171'
                            }}>
                              {job.status}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                          <div>{new Date(job.created_at).toLocaleDateString()}</div>
                          <div>{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {hasErrors && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => api.downloadErrorReport(job.id)}
                                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                title="Download detailed CSV error report"
                              >
                                <Download size={11} /> Errors
                              </button>
                            )}

                            {job.can_rollback && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleRollback(job)}
                                disabled={actionLoading}
                                style={{ padding: '3px 8px', fontSize: '0.72rem', background: '#e11d48' }}
                                title="Reverse only the changes introduced by this import"
                              >
                                <RotateCcw size={11} /> Rollback
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px'
          }}>
            <ShieldAlert size={18} color="var(--primary-light)" />
            <span>Atomic Import Journaling: Rollbacks target only the specific records affected by that import job, safely leaving subsequent edits and independent datasets intact.</span>
          </div>
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
