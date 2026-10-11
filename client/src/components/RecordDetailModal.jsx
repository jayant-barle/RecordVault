import React, { useState } from 'react';
import { X, Edit2, Trash2, Calendar, Folder, Hash, Phone, Mail, Building, Tag } from 'lucide-react';

export default function RecordDetailModal({ record, onClose, onEdit, onDelete }) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!record) return null;

  const customFields = typeof record.custom_fields === 'string'
    ? JSON.parse(record.custom_fields)
    : (record.custom_fields || {});

  const customKeys = Object.keys(customFields);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <span className="badge badge-dataset" style={{ marginBottom: '6px' }}>
              {record.dataset_name || 'Standard Dataset'}
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {record.name || 'Unnamed Record'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Main Attributes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px'
          }}>
            <div>
              <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Hash size={12} /> Excel Business ID
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {record.excel_id}
              </div>
            </div>

            <div>
              <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={12} /> Mobile Number
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {record.mobile || '—'}
              </div>
            </div>

            <div>
              <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={12} /> Email Address
              </div>
              <div style={{ fontSize: '0.95rem', color: '#93c5fd' }}>
                {record.email || '—'}
              </div>
            </div>

            <div>
              <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Building size={12} /> Company / Department
              </div>
              <div style={{ fontSize: '0.95rem' }}>
                {record.company || '—'}
              </div>
            </div>
          </div>

          {/* Dynamic Custom Fields Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Imported Custom Attributes ({customKeys.length})
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRawJson(!showRawJson)}
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
              >
                {showRawJson ? 'View Formatted' : 'View Raw JSON'}
              </button>
            </div>

            {showRawJson ? (
              <pre style={{
                background: '#070b14',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: '#34d399',
                overflowX: 'auto',
                maxHeight: '200px'
              }}>
                {JSON.stringify(customFields, null, 2)}
              </pre>
            ) : customKeys.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px'
              }}>
                {customKeys.map((key) => (
                  <div
                    key={key}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>
                      {key}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, wordBreak: 'break-word' }}>
                      {String(customFields[key] || '—')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No custom attributes attached to this record.
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            display: 'flex',
            gap: '16px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '12px'
          }}>
            <span>Created: {new Date(record.created_at).toLocaleString()}</span>
            {record.updated_at && (
              <span>Updated: {new Date(record.updated_at).toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-danger"
            onClick={() => onDelete(record)}
          >
            <Trash2 size={15} /> Delete Record
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => onEdit(record)}
          >
            <Edit2 size={15} /> Edit Record
          </button>
          <button
            className="btn btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
