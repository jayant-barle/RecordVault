import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import LoginView from './components/LoginView.jsx';
import Navbar from './components/Navbar.jsx';
import SharedPermissionsBanner from './components/SharedPermissionsBanner.jsx';
import Dashboard from './components/Dashboard.jsx';
import RecordDetailModal from './components/RecordDetailModal.jsx';
import RecordEditModal from './components/RecordEditModal.jsx';
import ImportModal from './components/ImportModal.jsx';
import ExportModal from './components/ExportModal.jsx';
import SearchHistoryModal from './components/SearchHistoryModal.jsx';
import AuditLogModal from './components/AuditLogModal.jsx';
import DatasetsModal from './components/DatasetsModal.jsx';
import { api } from './services/api.js';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  // Tab & modal states
  const [activeTab, setActiveTab] = useState('search');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Selected records for modals
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [exportConfig, setExportConfig] = useState(null); // { selectedIds, totalFilteredCount, currentQuery, ... }
  
  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-muted)'
      }}>
        Initializing application & verifying session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Record actions
  const handleSaveEdit = async (id, updates) => {
    await api.updateRecord(id, updates);
    addToast('Record updated successfully', 'success');
    triggerRefresh();
  };

  const handleDeleteRecord = async (record) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete record ${record.excel_id} (${record.name || 'Unnamed'})?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.deleteRecord(record.id);
      addToast(`Record ${record.excel_id} deleted successfully`, 'success');
      if (viewRecord?.id === record.id) setViewRecord(null);
      triggerRefresh();
    } catch (err) {
      addToast(`Delete error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setShowImport(true)}
        onOpenExport={() => setExportConfig({ selectedIds: [], totalFilteredCount: 0 })}
      />

      <SharedPermissionsBanner />

      <main className="main-content">
        <Dashboard
          onViewRecord={(r) => setViewRecord(r)}
          onEditRecord={(r) => setEditRecord(r)}
          onDeleteRecord={handleDeleteRecord}
          onOpenExport={(config) => setExportConfig(config)}
          onOpenImport={() => setShowImport(true)}
          refreshTrigger={refreshTrigger}
        />
      </main>

      {/* MODALS */}
      {viewRecord && (
        <RecordDetailModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onEdit={(r) => {
            setViewRecord(null);
            setEditRecord(r);
          }}
          onDelete={handleDeleteRecord}
        />
      )}

      {editRecord && (
        <RecordEditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSave={handleSaveEdit}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImportSuccess={() => {
            addToast('Excel import committed successfully!', 'success');
            triggerRefresh();
          }}
        />
      )}

      {exportConfig && (
        <ExportModal
          {...exportConfig}
          onClose={() => setExportConfig(null)}
        />
      )}

      {activeTab === 'datasets' && (
        <DatasetsModal
          onClose={() => setActiveTab('search')}
          onDatasetChange={() => {
            addToast('Dataset updated');
            triggerRefresh();
          }}
        />
      )}

      {activeTab === 'history' && (
        <SearchHistoryModal
          onClose={() => setActiveTab('search')}
        />
      )}

      {activeTab === 'audit' && (
        <AuditLogModal
          onClose={() => setActiveTab('search')}
        />
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
