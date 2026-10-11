import React, { useState, useEffect } from 'react';
import { X, History, RotateCcw, AlertCircle, CheckCircle2, User, Clock, ArrowRight } from 'lucide-react';
import { api } from '../services/api.js';

export default function RecordVersionModal({ record, onClose, onVersionRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');

  useEffect(() => {
    loadVersions();
  }, [record.id]);

  const loadVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRecordVersions(record.id);
      setVersions(data);
      if (data.length > 0) {
        setSelectedVersion(data[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load version history.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (version) => {
    const confirmed = window.confirm(
      `Are you sure you want to revert record ${record.excel_id} back to the state saved on ${new Date(version.created_at).toLocaleString()} by ${version.username}?\n\nThis will safely record a new undo revision in the audit trail.`
    );
    if (!confirmed) return;

    setRestoring(true);
    setError('');
    setRestoreSuccess('');

    try {
      await api.undoRecordEdit(record.id, version.id);
      setRestoreSuccess('Record successfully restored to historical version!');
      setTimeout(() => {
        if (onVersionRestored) onVersionRestored();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to undo edit.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} color="var(--primary-light)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Record Edit History & Undo</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Inspecting historical revisions for ID: <strong style={{ color: '#38bdf8' }}>{record.excel_id}</strong> ({record.name})
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

          {restoreSuccess && (
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
              <span>{restoreSuccess}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading version timeline...
            </div>
          ) : versions.length === 0 ? (
            <div style={{
              padding: '36px',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)'
            }}>
              <History size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div>No previous edits recorded yet for this item.</div>
              <div style={{ fontSize: '0.78rem', marginTop: '6px' }}>
                Edits made via the dashboard automatically create snapshots with rollback capability.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>
              {/* Revision list */}
              <div style={{
                borderRight: '1px solid var(--border-subtle)',
                paddingRight: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Revisions ({versions.length})
                </div>
                {versions.map((ver) => {
                  const isSelected = selectedVersion?.id === ver.id;
                  return (
                    <div
                      key={ver.id}
                      onClick={() => setSelectedVersion(ver)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid var(--primary-light)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: ver.operation === 'UPDATE' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: ver.operation === 'UPDATE' ? '#60a5fa' : '#f59e0b'
                        }}>
                          {ver.operation}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={11} />
                          {new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} color="var(--text-muted)" />
                        <span>{ver.username}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {new Date(ver.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Version preview & comparison */}
              {selectedVersion && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        Revision from {new Date(selectedVersion.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Saved by {selectedVersion.username} ({selectedVersion.operation})
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUndo(selectedVersion)}
                      disabled={restoring}
                    >
                      <RotateCcw size={14} /> {restoring ? 'Reverting...' : 'Revert to this Version'}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Snapshot State Comparison:
                  </div>

                  <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    {['name', 'mobile', 'email', 'company'].map(field => {
                      const snapVal = selectedVersion.snapshot_data ? selectedVersion.snapshot_data[field] : null;
                      const currentVal = record[field];
                      const isDifferent = String(snapVal || '') !== String(currentVal || '');

                      return (
                        <div
                          key={field}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 1fr 20px 1fr',
                            alignItems: 'center',
                            fontSize: '0.82rem',
                            padding: '4px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <span style={{ color: 'var(--text-dim)', textTransform: 'capitalize' }}>{field}:</span>
                          <span style={{
                            color: isDifferent ? '#fb7185' : 'var(--text-muted)',
                            textDecoration: isDifferent ? 'line-through' : 'none'
                          }}>
                            {currentVal || '—'}
                          </span>
                          <ArrowRight size={12} color="var(--text-dim)" />
                          <span style={{
                            color: isDifferent ? '#34d399' : 'var(--text-muted)',
                            fontWeight: isDifferent ? 600 : 400
                          }}>
                            {snapVal || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {selectedVersion.snapshot_data?.custom_fields && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Custom Attributes Snapshot:
                      </div>
                      <pre style={{
                        background: '#070b14',
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.74rem',
                        color: '#67e8f9',
                        maxHeight: '120px',
                        overflowY: 'auto'
                      }}>
                        {JSON.stringify(selectedVersion.snapshot_data.custom_fields, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
