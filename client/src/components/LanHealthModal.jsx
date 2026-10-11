import React, { useState, useEffect } from 'react';
import { X, Wifi, Database, CheckCircle2, AlertTriangle, Copy, Check, RefreshCw, Terminal, Shield, Monitor } from 'lucide-react';
import { api } from '../services/api.js';

export default function LanHealthModal({ onClose }) {
  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedFw, setCopiedFw] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const [healthData, infoData] = await Promise.all([
        api.getSystemHealth().catch(err => ({ status: 'error', error: err.message })),
        api.getSystemInfo().catch(() => null),
      ]);
      setHealth(healthData);
      setInfo(infoData);
    } catch (err) {
      setError(err.message || 'Unable to communicate with RecordVault backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyFw = (cmd) => {
    navigator.clipboard.writeText(cmd);
    setCopiedFw(true);
    setTimeout(() => setCopiedFw(false), 2000);
  };

  const isServerHealthy = health && health.status === 'healthy';
  const isServerOnline = health && (health.status === 'healthy' || health.status === 'degraded');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={20} color="var(--primary-light)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>LAN Connection & Server Health</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Monitor local network accessibility, database status, and multi-device connection guides
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

          {/* Status Metrics Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: isServerOnline ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: isServerOnline ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '14px'
            }}>
              <div style={{ fontSize: '0.75rem', color: isServerOnline ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Monitor size={14} /> Backend Server Status
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: isServerOnline ? '#10b981' : '#ef4444', marginTop: '4px' }}>
                {isServerOnline ? 'ONLINE & RESPONDING' : 'OFFLINE / UNREACHABLE'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Uptime: {health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)} min` : 'N/A'}
              </div>
            </div>

            <div style={{
              background: health?.database?.status === 'healthy' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: health?.database?.status === 'healthy' ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '14px'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={14} /> Database Connection
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: health?.database?.status === 'healthy' ? '#38bdf8' : '#f59e0b', marginTop: '4px' }}>
                {health?.database?.status === 'healthy' ? 'CONNECTED (HEALTHY)' : 'DISCONNECTED / CHECKING'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Engine: {health?.database?.mode || 'PostgreSQL'} • Latency: {health?.database?.latencyMs ?? 0}ms
              </div>
            </div>
          </div>

          {/* Access URL */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Authorized LAN Access URL
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Share this web URL with any phone, tablet, or PC on the same Wi-Fi / Local Area Network:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                readOnly
                className="input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#38bdf8', flex: 1 }}
                value={health?.lan?.clientUrl || (info?.lanIp ? `http://${info.lanIp}:5173` : 'http://127.0.0.1:5173')}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleCopyUrl(health?.lan?.clientUrl || `http://${info?.lanIp || '127.0.0.1'}:5173`)}
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Windows 11 Troubleshooting & Firewall Guidance */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={16} color="var(--primary-light)" /> Windows 11 Host LAN Instructions
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>
                <strong style={{ color: 'var(--text-main)' }}>1. Confirming Local IP:</strong>
                <div>Open Windows Terminal or PowerShell and run <code>ipconfig</code>. Look for the <em>IPv4 Address</em> under your active Wi-Fi adapter.</div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)' }}>2. Network Profile:</strong>
                <div>Go to <em>Settings &gt; Network &amp; Internet &gt; Wi-Fi</em>, click your Wi-Fi network properties, and ensure the profile type is set to <strong>Private network</strong> (allows LAN discovery).</div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)' }}>3. Windows Defender Firewall Rule:</strong>
                <div>If another device cannot connect, run this command in Administrator PowerShell to allow inbound traffic on ports 5000 &amp; 5173:</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#070b14',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '4px',
                  gap: '8px'
                }}>
                  <code style={{ fontSize: '0.72rem', color: '#34d399', flex: 1, overflowX: 'auto' }}>
                    netsh advfirewall firewall add rule name="RecordVault" dir=in action=allow protocol=TCP localport=5000,5173
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyFw('netsh advfirewall firewall add rule name="RecordVault" dir=in action=allow protocol=TCP localport=5000,5173')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    title="Copy command"
                  >
                    {copiedFw ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchStatus}
            disabled={loading}
          >
            <RefreshCw size={13} /> {loading ? 'Checking...' : 'Refresh Status'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
