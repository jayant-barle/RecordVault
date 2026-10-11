import React, { useState, useEffect } from 'react';
import { History, Shield, Search, RefreshCw, Clock, User, CheckCircle } from 'lucide-react';
import { api } from '../api';

export default function AuditView() {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'search'
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, historyRes, statsRes] = await Promise.all([
        api.getAuditLogs(1, 50),
        api.getSearchHistory(50),
        api.getAuditStats(),
      ]);

      if (logsRes.success) setAuditLogs(logsRes.data || []);
      if (historyRes.success) setSearchHistory(historyRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      {/* Metric Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="panel" style={{ padding: '1rem', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL RECORDS STORED</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.25rem' }}>
              {stats.totalRecords.toLocaleString()}
            </div>
          </div>
          <div className="panel" style={{ padding: '1rem', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTIVE DATASETS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8', marginTop: '0.25rem' }}>
              {stats.totalDatasets}
            </div>
          </div>
          <div className="panel" style={{ padding: '1rem', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL IMPORT JOBS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.25rem' }}>
              {stats.totalImports}
            </div>
          </div>
          <div className="panel" style={{ padding: '1rem', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LOGGED SEARCH QUERIES</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f472b6', marginTop: '0.25rem' }}>
              {stats.totalSearches}
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <Shield size={16} />
              <span>Administrative Audit Trail ({auditLogs.length})</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <History size={16} />
              <span>Search Query History ({searchHistory.length})</span>
            </button>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading audit records...
          </div>
        ) : activeTab === 'audit' ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor / User</th>
                  <th>Action</th>
                  <th>Target Type</th>
                  <th>Details & Changes</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => {
                    const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '');
                    return (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ color: '#fff' }}>{log.username || 'System'}</span>
                        </td>
                        <td>
                          <span className={`badge ${
                            log.action.includes('DELETE') ? 'badge-amber' :
                            log.action.includes('IMPORT') ? 'badge-emerald' : 'badge-indigo'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{log.target_type || '—'}</td>
                        <td style={{ maxWidth: '400px', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {detailsStr.length > 80 ? detailsStr.slice(0, 80) + '...' : detailsStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Search Field</th>
                  <th>Search Criteria (Privacy-Masked)</th>
                  <th>Result Matches</th>
                </tr>
              </thead>
              <tbody>
                {searchHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No search history recorded yet.
                    </td>
                  </tr>
                ) : (
                  searchHistory.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600, color: '#fff' }}>{entry.username || 'User'}</td>
                      <td>
                        <span className="badge badge-indigo">{entry.search_field}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                        {entry.criteria_summary || '—'}
                      </td>
                      <td>
                        <span className="badge badge-emerald">{entry.result_count} matches</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
