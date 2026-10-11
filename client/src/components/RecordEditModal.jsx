import React, { useState } from 'react';
import { X, Save, AlertCircle, Plus, Trash } from 'lucide-react';

export default function RecordEditModal({ record, onClose, onSave }) {
  if (!record) return null;

  const initialCustom = typeof record.custom_fields === 'string'
    ? JSON.parse(record.custom_fields)
    : (record.custom_fields || {});

  const [name, setName] = useState(record.name || '');
  const [mobile, setMobile] = useState(record.mobile || '');
  const [email, setEmail] = useState(record.email || '');
  const [company, setCompany] = useState(record.company || '');
  const [customFields, setCustomFields] = useState({ ...initialCustom });
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCustomChange = (key, val) => {
    setCustomFields(prev => ({ ...prev, [key]: val }));
  };

  const handleRemoveCustom = (key) => {
    setCustomFields(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    setCustomFields(prev => ({ ...prev, [newKey.trim()]: newVal.trim() }));
    setNewKey('');
    setNewVal('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSave(record.id, {
        name,
        mobile,
        email,
        company,
        custom_fields: customFields
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Record</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Business ID: <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{record.excel_id}</strong> (Protected)
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  className="input"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Preserves leading 0"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company / Department</label>
                <input
                  type="text"
                  className="input"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            {/* Custom attributes editing */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Custom Excel Attributes
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                {Object.keys(customFields).map((key) => (
                  <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '40%', opacity: 0.8 }}
                      value={key}
                      disabled
                    />
                    <input
                      type="text"
                      className="input"
                      style={{ width: '55%' }}
                      value={customFields[key] || ''}
                      onChange={(e) => handleCustomChange(key, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustom(key)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                      title="Remove attribute"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom attribute row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input"
                  style={{ width: '40%' }}
                  placeholder="New Field Name"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <input
                  type="text"
                  className="input"
                  style={{ width: '45%' }}
                  placeholder="Value"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddCustom}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              <Save size={15} /> {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
