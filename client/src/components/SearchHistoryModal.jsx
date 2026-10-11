import React, { useState, useEffect } from 'react';
import { X, History, Search, Clock, User } from 'lucide-react';
import { api } from '../services/api.js';

export default function SearchHistoryModal({ onClose, onSelectTerm }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSearchHistory(50)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Search History</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Persistent audit log of executed searches (Sensitive values masked)
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
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
              No recorded searches yet. Execute an exact-match query on the dashboard to populate history.
            </div>
          ) : (
            <div className="table-wrapper" style={{ maxHeight: '360px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Field</th>
                    <th>Criteria (Masked)</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {item.username || 'user'}
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {item.search_field}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#93c5fd' }}>
                        {item.criteria_summary || '—'}
                      </td>
                      <td>
                        <span style={{
                          color: item.result_count > 0 ? 'var(--success)' : 'var(--text-dim)',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}>
                          {item.result_count} {item.result_count === 1 ? 'match' : 'matches'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
