import React from 'react';
import { X, User, Phone, Mail, Building, Hash, FileSpreadsheet, Calendar } from 'lucide-react';

export default function RecordDetailsModal({ record, onClose, onEdit }) {
  if (!record) return null;

  const customFields = typeof record.custom_fields === 'string'
    ? JSON.parse(record.custom_fields)
    : (record.custom_fields || {});

  const customEntries = Object.entries(customFields);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(79, 70, 229, 0.15)', borderRadius: '0.5rem', color: 'var(--primary)' }}>
              <User size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{record.name || 'Unnamed Record'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span className="badge badge-indigo">Excel ID: {record.excel_id}</span>
                <span>•</span>
                <span>{record.dataset_name || 'Dataset'}</span>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>
            Standard Attributes
          </h3>
          <div className="details-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="detail-item">
              <div className="detail-key">Excel Business ID</div>
              <div className="detail-value" style={{ fontFamily: 'monospace', color: '#818cf8', fontSize: '1.05rem' }}>
                {record.excel_id}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-key">Full Name</div>
              <div className="detail-value">{record.name || '-'}</div>
            </div>

            <div className="detail-item">
              <div className="detail-key">Mobile / Phone</div>
              <div className="detail-value" style={{ fontFamily: 'monospace' }}>
                {record.mobile || '-'}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-key">Email Address</div>
              <div className="detail-value">{record.email || '-'}</div>
            </div>

            <div className="detail-item">
              <div className="detail-key">Company / Department</div>
              <div className="detail-value">{record.company || '-'}</div>
            </div>

            <div className="detail-item">
              <div className="detail-key">Source Dataset</div>
              <div className="detail-value">{record.dataset_name || '-'}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>
            Dynamic Custom Excel Columns ({customEntries.length})
          </h3>
          {customEntries.length === 0 ? (
            <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No additional custom spreadsheet columns imported for this record.
            </div>
          ) : (
            <div className="details-grid">
              {customEntries.map(([key, val]) => (
                <div key={key} className="detail-item">
                  <div className="detail-key">{key}</div>
                  <div className="detail-value">{val !== null && val !== undefined && val !== '' ? String(val) : '-'}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div>Internal System ID: {record.id}</div>
            <div>Created: {new Date(record.created_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { onClose(); onEdit(record); }}>Edit Record</button>
        </div>
      </div>
    </div>
  );
}
