import React, { useState, useEffect } from 'react';
import { X, Shield, FileText, ArrowRight, Activity } from 'lucide-react';
import { api } from '../services/api.js';

export default function AuditLogModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = (p = 1) => {
    setLoading(true);
    api.getAuditLogs(p, 25)
      .then(res => {
        setLogs(res.data);
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const getActionBadge = (action) => {
    if (action.includes('IMPORT')) return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>{action}</span>;
    if (action.includes('DELETE')) return <span className="badge" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{action}</span>;
    if (action.includes('UPDATE')) return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>{action}</span>;
    if (action.includes('EXPORT')) return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>{action}</span>;
    return <span className="badge" style={{ background: 'rgba(255,255,255,0.06)' }}>{action}</span>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '880px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#34d399" />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>System Audit Trail</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Immutable event history of imports, modifications, deletions, and exports
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
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
              No audit log entries recorded yet.
            </div>
          ) : (
            <>
              <div className="table-wrapper" style={{ maxHeight: '380px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>IP</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {log.username || 'system'}
                          </td>
                          <td>
                            {getActionBadge(log.action)}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {log.target_type} {log.target_id ? `(${log.target_id.slice(0, 8)}...)` : ''}
                          </td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                            {log.ip_address || '—'}
                          </td>
                          <td style={{ fontSize: '0.78rem', maxWidth: '280px', wordBreak: 'break-word', color: '#cbd5e1' }}>
                            {JSON.stringify(details)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination" style={{ marginTop: '12px', borderTop: 'none' }}>
                  <span>Page {page} of {totalPages}</span>
                  <div className="pagination-controls">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchLogs(page - 1)}
                      disabled={page <= 1}
                    >
                      Previous
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchLogs(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
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
