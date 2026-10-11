import React, { useState, useEffect } from 'react';
import { Database, Search, UploadCloud, History, Shield, LogOut, Wifi, Layers, HardDrive, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ activeTab, setActiveTab, onOpenImport, onOpenExport, onOpenLanHealth }) {
  const { user, logout } = useAuth();
  const [lanIp, setLanIp] = useState('127.0.0.1');

  useEffect(() => {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setLanIp(window.location.hostname);
    } else {
      fetch('/api/system/info')
        .then(res => res.json())
        .then(data => {
          if (data?.lanIp) setLanIp(data.lanIp);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <Database size={22} />
        </div>
        <div>
          <div className="brand-title">RecordVault</div>
          <div className="brand-subtitle">Excel Record Management & Search</div>
        </div>
      </div>

      <nav className="nav-links">
        <button
          className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={16} /> Records
        </button>

        <button
          className={`nav-btn ${activeTab === 'datasets' ? 'active' : ''}`}
          onClick={() => setActiveTab('datasets')}
        >
          <Layers size={16} /> Datasets
        </button>

        <button
          className="nav-btn"
          onClick={onOpenImport}
        >
          <UploadCloud size={16} /> Import Excel
        </button>

        <button
          className={`nav-btn ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          <ShieldCheck size={16} /> Data Quality
        </button>

        <button
          className={`nav-btn ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          <HardDrive size={16} /> Backups
        </button>

        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /> Searches
        </button>

        <button
          className={`nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Shield size={16} /> Audit Trail
        </button>
      </nav>

      <div className="navbar-user">
        <div
          className="lan-badge"
          title="Click to view LAN connection telemetry and setup instructions"
          onClick={onOpenLanHealth}
          style={{ cursor: 'pointer' }}
        >
          <span className="lan-pulse"></span>
          <Wifi size={13} />
          <span>LAN: {lanIp}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {user?.username}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Log out of application"
          >
            <LogOut size={14} /> Exit
          </button>
        </div>
      </div>
    </header>
  );
}
