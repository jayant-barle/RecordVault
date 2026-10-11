import React, { useState, useEffect } from 'react';
import { Database, Search, UploadCloud, History, Shield, LogOut, Wifi, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar({ activeTab, setActiveTab, onOpenImport, onOpenExport }) {
  const { user, logout } = useAuth();
  const [lanIp, setLanIp] = useState('127.0.0.1');

  useEffect(() => {
    // Check local hostname or fetch host IP
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setLanIp(window.location.hostname);
    } else {
      fetch('/api/health')
        .then(() => {
          // Typically from network utilities
          setLanIp(window.location.hostname);
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
          <Search size={16} /> Search & Records
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
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /> Search History
        </button>

        <button
          className={`nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Shield size={16} /> Audit Trail
        </button>
      </nav>

      <div className="navbar-user">
        <div className="lan-badge" title="LAN Access Active">
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
