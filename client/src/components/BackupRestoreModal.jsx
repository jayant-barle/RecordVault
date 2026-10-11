import React, { useState, useEffect } from 'react';
import { X, HardDrive, Download, RotateCcw, Plus, Clock, ShieldCheck, AlertTriangle, CheckCircle2, Settings } from 'lucide-react';
import { api } from '../services/api.js';

export default function BackupRestoreModal({ onClose, onBackupRestored }) {
  const [backups, setBackups] = useState([]);
  const [schedule, setSchedule] = useState({ enabled: true, frequencyHours: 24, retentionDays: 14 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backupDesc, setBackupDesc] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [bList, sInfo] = await Promise.all([
        api.getBackups(),
        api.getBackupSchedule().catch(() => ({ enabled: true, frequencyHours: 24, retentionDays: 14 })),
      ]);
      setBackups(bList);
      if (sInfo) setSchedule(sInfo);
    } catch (err) {
      setError(err.message || 'Failed to load backup data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBackup = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.createBackup({ description: backupDesc });
      setSuccess(`Manual backup "${res.backup.filename}" created successfully.`);
      setBackupDesc('');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to create backup.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.updateBackupSchedule(schedule);
      setSuccess('Backup schedule and retention policies updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update backup schedule.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (backup) => {
    const confirmed = window.confirm(
      `RESTORE DATABASE FROM BACKUP:\n\nFile: ${backup.filename}\nTimestamp: ${new Date(backup.created_at).toLocaleString()}\n\nIMPORTANT: The system will automatically create a pre-restore safety snapshot before applying the restore. Proceed?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.restoreBackup(backup.id);
      setSuccess(`Database successfully restored! (Safety snapshot taken: ${res.safetySnapshot})`);
      if (onBackupRestored) onBackupRestored();
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to restore database.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={20} color="var(--primary-light)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Database Backup & Restoration</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Automated scheduler, point-in-time recovery, and pre-restore safety snapshots
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {/* Create Manual Backup */}
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px'
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} color="var(--primary-light)" /> Create Manual Backup
              </div>
              <form onSubmit={handleCreateBackup}>
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="input"
                    value={backupDesc}
                    onChange={(e) => setBackupDesc(e.target.value)}
                    placeholder="Optional description (e.g. Pre-migration checkpoint)"
                    disabled={actionLoading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading}
                  style={{ width: '100%' }}
                >
                  <HardDrive size={14} /> {actionLoading ? 'Creating Backup...' : 'Generate Backup Snapshot'}
                </button>
              </form>
            </div>

            {/* Scheduled Automatic Backups */}
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px'
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={16} color="#38bdf8" /> Scheduled Backups & Retention
              </div>
              <form onSubmit={handleUpdateSchedule}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    id="autoBackupCheck"
                    checked={schedule.enabled}
                    onChange={(e) => setSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <label htmlFor="autoBackupCheck" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                    Enable Automatic Backups
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Frequency (Hours)</div>
                    <select
                      className="select"
                      style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                      value={schedule.frequencyHours}
                      onChange={(e) => setSchedule(prev => ({ ...prev, frequencyHours: parseInt(e.target.value, 10) }))}
                    >
                      <option value="6">Every 6 Hours</option>
                      <option value="12">Every 12 Hours</option>
                      <option value="24">Every 24 Hours</option>
                      <option value="48">Every 48 Hours</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Retention (Days)</div>
                    <select
                      className="select"
                      style={{ padding: '6px 8px', fontSize: '0.82rem' }}
                      value={schedule.retentionDays}
                      onChange={(e) => setSchedule(prev => ({ ...prev, retentionDays: parseInt(e.target.value, 10) }))}
                    >
                      <option value="7">7 Days</option>
                      <option value="14">14 Days</option>
                      <option value="30">30 Days</option>
                      <option value="60">60 Days</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={actionLoading}
                  style={{ width: '100%' }}
                >
                  Save Schedule Policy
                </button>
              </form>
            </div>
          </div>

          {/* Backup Archives Table */}
          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Available Backups ({backups.length})
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Stored safely in Windows 11 host storage
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading backups...
            </div>
          ) : backups.length === 0 ? (
            <div style={{
              padding: '30px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)'
            }}>
              No backups created yet. Generate your first backup above.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Filename & Description</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                          {b.filename}
                        </div>
                        {b.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {b.description}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatBytes(b.size_bytes)}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: b.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: b.status === 'COMPLETED' ? '#34d399' : '#f87171'
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => api.downloadBackup(b.id)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Download backup file to host"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRestore(b)}
                            disabled={actionLoading || b.status !== 'COMPLETED'}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Restore this backup (takes safety snapshot first)"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
            <ShieldCheck size={18} color="var(--success)" />
            <span>Pre-restore safety guarantee: Before any restore commences, the system records an automatic safety snapshot of current records to prevent unrecoverable data loss.</span>
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
