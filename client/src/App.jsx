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
import BackupRestoreModal from './components/BackupRestoreModal.jsx';
import DeletedRecordsModal from './components/DeletedRecordsModal.jsx';
import RecordVersionModal from './components/RecordVersionModal.jsx';
import ImportHistoryModal from './components/ImportHistoryModal.jsx';
import DataQualityModal from './components/DataQualityModal.jsx';
import LanHealthModal from './components/LanHealthModal.jsx';
import { api } from './services/api.js';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  // Tab & modal states
  const [activeTab, setActiveTab] = useState('search');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Selected records for modals
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [versionRecord, setVersionRecord] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [showDeletedRecords, setShowDeletedRecords] = useState(false);
  const [showLanHealth, setShowLanHealth] = useState(false);
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
    addToast('Record updated successfully (Snapshot saved for undo)', 'success');
    triggerRefresh();
  };

  const handleDeleteRecord = async (record) => {
    const confirmed = window.confirm(
      `Delete record ${record.excel_id} (${record.name || 'Unnamed'})?\n\nThis record will be moved to Deleted Records and can be recovered if needed.`
    );
    if (!confirmed) return;

    try {
      await api.deleteRecord(record.id);
      addToast(`Record ${record.excel_id} moved to Recycle Bin`, 'success');
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
        onOpenLanHealth={() => setShowLanHealth(true)}
      />

      <SharedPermissionsBanner />

      <main className="main-content">
        <Dashboard
          onViewRecord={(r) => setViewRecord(r)}
          onEditRecord={(r) => setEditRecord(r)}
          onDeleteRecord={handleDeleteRecord}
          onViewVersions={(r) => setVersionRecord(r)}
          onOpenDeletedRecords={() => setShowDeletedRecords(true)}
          onOpenExport={(config) => setExportConfig(config)}
          onOpenImport={() => setShowImport(true)}
          refreshTrigger={refreshTrigger}
        />
      </main>

      {/* RECORD DETAIL & EDIT MODALS */}
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

      {/* RECORD VERSION & UNDO MODAL */}
      {versionRecord && (
        <RecordVersionModal
          record={versionRecord}
          onClose={() => setVersionRecord(null)}
          onVersionRestored={() => {
            addToast('Historical version restored successfully', 'success');
            triggerRefresh();
          }}
        />
      )}

      {/* RECYCLE BIN / DELETED RECORDS RECOVERY */}
      {showDeletedRecords && (
        <DeletedRecordsModal
          onClose={() => setShowDeletedRecords(false)}
          onRecordRestored={() => {
            addToast('Record restored from Recycle Bin', 'success');
            triggerRefresh();
          }}
        />
      )}

      {/* IMPORT & IMPORT HISTORY */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onOpenHistory={() => {
            setShowImport(false);
            setShowImportHistory(true);
          }}
          onImportSuccess={() => {
            addToast('Excel import committed successfully!', 'success');
            triggerRefresh();
          }}
        />
      )}

      {showImportHistory && (
        <ImportHistoryModal
          onClose={() => setShowImportHistory(false)}
          onRollbackComplete={() => {
            addToast('Import rollback executed successfully', 'success');
            triggerRefresh();
          }}
        />
      )}

      {/* CUSTOM COLUMN EXPORT */}
      {exportConfig && (
        <ExportModal
          {...exportConfig}
          onClose={() => setExportConfig(null)}
        />
      )}

      {/* DATASET MANAGEMENT */}
      {activeTab === 'datasets' && (
        <DatasetsModal
          onClose={() => setActiveTab('search')}
          onDatasetChange={() => {
            addToast('Dataset telemetry updated');
            triggerRefresh();
          }}
          onOpenImportHistory={() => {
            setActiveTab('search');
            setShowImportHistory(true);
          }}
        />
      )}

      {/* DATA QUALITY & DUPLICATE REPORT */}
      {activeTab === 'quality' && (
        <DataQualityModal
          onClose={() => setActiveTab('search')}
        />
      )}

      {/* DATABASE BACKUP & RESTORATION */}
      {activeTab === 'backup' && (
        <BackupRestoreModal
          onClose={() => setActiveTab('search')}
          onBackupRestored={() => {
            addToast('Database successfully restored from backup snapshot', 'success');
            triggerRefresh();
          }}
        />
      )}

      {/* LAN HEALTH & TROUBLESHOOTING */}
      {showLanHealth && (
        <LanHealthModal
          onClose={() => setShowLanHealth(false)}
        />
      )}

      {/* SEARCH HISTORY & AUDIT LOGS */}
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
