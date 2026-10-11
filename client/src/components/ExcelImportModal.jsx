import React, { useState, useRef } from 'react';
import {
  X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ArrowRight, RefreshCw, Layers, ShieldAlert, Check, HelpCircle
} from 'lucide-react';
import { api } from '../api';

const STANDARD_FIELD_OPTIONS = [
  { value: 'excel_id', label: 'Excel ID (Business Identifier)' },
  { value: 'name', label: 'Full Name' },
  { value: 'mobile', label: 'Mobile / Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'company', label: 'Company / Department' },
  { value: 'custom', label: 'Custom Column (Retain Value)' },
  { value: 'ignore', label: 'Ignore / Skip Column' },
];

export default function ExcelImportModal({ onClose, onImportCompleted }) {
  // Steps: 'upload' -> 'configure' -> 'confirm' -> 'summary'
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Inspection results
  const [inspectedFiles, setInspectedFiles] = useState([]);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  
  // Import settings
  const [columnMapping, setColumnMapping] = useState({});
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'replace'
  const [datasetName, setDatasetName] = useState('');
  
  // Execution & Summary state
  const [committing, setCommitting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileSelect = async (selectedFileList) => {
    if (!selectedFileList || selectedFileList.length === 0) return;
    setError('');
    setUploading(true);

    const formData = new FormData();
    for (let i = 0; i < selectedFileList.length; i++) {
      formData.append('files', selectedFileList[i]);
    }

    try {
      const res = await api.inspectExcelFiles(formData);
      if (res.success && res.files?.length > 0) {
        setInspectedFiles(res.files);
        setSelectedFileIdx(0);
        
        // Pick first sheet of first file
        const firstFile = res.files[0];
        const firstSheet = firstFile.sheets[0];
        if (firstSheet) {
          setSelectedSheetName(firstSheet.name);
          setColumnMapping({ ...firstSheet.suggestedMapping });
          setDatasetName(`${firstFile.filename} (${firstSheet.name})`);
        }
        setStep('configure');
      } else {
        setError(res.error || 'Failed to inspect Excel files');
      }
    } catch (err) {
      setError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSheetChange = (sheetName) => {
    setSelectedSheetName(sheetName);
    const currFile = inspectedFiles[selectedFileIdx];
    const sheet = currFile.sheets.find(s => s.name === sheetName);
    if (sheet) {
      setColumnMapping({ ...sheet.suggestedMapping });
      setDatasetName(`${currFile.filename} (${sheet.name})`);
    }
  };

  const handleMappingChange = (header, targetField) => {
    setColumnMapping(prev => ({
      ...prev,
      [header]: targetField
    }));
  };

  const currentFile = inspectedFiles[selectedFileIdx];
  const currentSheet = currentFile?.sheets?.find(s => s.name === selectedSheetName);

  const handleCommit = async () => {
    setError('');
    setCommitting(true);

    try {
      const res = await api.commitImport({
        fileId: currentFile.fileId,
        sheetName: selectedSheetName,
        columnMapping,
        mode: importMode,
        datasetName,
      });

      if (res.success) {
        setImportSummary(res.summary);
        setStep('summary');
        if (onImportCompleted) onImportCompleted();
      } else {
        setError(res.error || 'Import failed');
      }
    } catch (err) {
      setError(err.message || 'Error executing import transaction');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '0.5rem', color: 'var(--accent)' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Import Excel Business Records</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {step === 'upload' && 'Step 1 of 4: Select .xlsx or .xls files'}
                {step === 'configure' && 'Step 2 of 4: Map columns and select worksheet'}
                {step === 'confirm' && 'Step 3 of 4: Confirm import mode and review'}
                {step === 'summary' && 'Step 4 of 4: Import Complete'}
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              color: '#f87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div>
              <div
                className="dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
                }}
              >
                <UploadCloud size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
                  {uploading ? 'Inspecting Excel Workbooks...' : 'Click or Drag & Drop Excel Files Here'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Supports multiple Microsoft Excel workbooks (<strong>.xlsx</strong> and <strong>.xls</strong>) up to 25MB each
                </p>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-emerald">Leading Zeroes Protected</span>
                  <span className="badge badge-indigo">Multi-Sheet Compatible</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          )}

          {/* STEP 2: Configure Sheet & Column Mapping */}
          {step === 'configure' && currentFile && (
            <div>
              {/* File & Worksheet selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Active Workbook</label>
                  <select
                    className="form-select"
                    value={selectedFileIdx}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSelectedFileIdx(idx);
                      const f = inspectedFiles[idx];
                      if (f.sheets[0]) {
                        setSelectedSheetName(f.sheets[0].name);
                        setColumnMapping({ ...f.sheets[0].suggestedMapping });
                        setDatasetName(`${f.filename} (${f.sheets[0].name})`);
                      }
                    }}
                  >
                    {inspectedFiles.map((f, i) => (
                      <option key={f.fileId} value={i}>{f.filename}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Worksheet</label>
                  <select
                    className="form-select"
                    value={selectedSheetName}
                    onChange={(e) => handleSheetChange(e.target.value)}
                  >
                    {currentFile.sheets.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.rowCount} rows)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dataset Name Input */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Target Dataset Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g. Q4 Regional Directory"
                />
              </div>

              {/* Column Mapping Matrix */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Spreadsheet Column Mapping</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Map spreadsheet headers to recognized standard fields or retain as custom
                  </span>
                </div>

                <div className="table-responsive" style={{ maxHeight: '280px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Excel Header</th>
                        <th>Sample Preview Value</th>
                        <th>Mapped System Field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSheet?.headers.map((header) => {
                        const sampleVal = currentSheet.sampleRows[0] ? currentSheet.sampleRows[0][header] : '';
                        const currentVal = columnMapping[header] || 'custom';

                        return (
                          <tr key={header}>
                            <td style={{ fontWeight: 600 }}>{header}</td>
                            <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {sampleVal !== '' ? String(sampleVal) : '—'}
                            </td>
                            <td>
                              <select
                                className="form-select"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                                value={currentVal}
                                onChange={(e) => handleMappingChange(header, e.target.value)}
                              >
                                {STANDARD_FIELD_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm Mode & Duplicates */}
          {step === 'confirm' && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                Choose Import & Duplicate Resolution Mode
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Merge Mode Option */}
                <div
                  onClick={() => setImportMode('merge')}
                  style={{
                    border: `2px solid ${importMode === 'merge' ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: importMode === 'merge' ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-card)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <RefreshCw size={20} color={importMode === 'merge' ? '#818cf8' : '#9ca3af'} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Merge Mode (Recommended)</h4>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Updates matching records with incoming data and inserts new records. Existing records absent from this upload are safely preserved.
                  </p>
                </div>

                {/* Replace Mode Option */}
                <div
                  onClick={() => setImportMode('replace')}
                  style={{
                    border: `2px solid ${importMode === 'replace' ? 'var(--danger)' : 'var(--border-color)'}`,
                    background: importMode === 'replace' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <AlertTriangle size={20} color={importMode === 'replace' ? '#f87171' : '#9ca3af'} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Replace Mode</h4>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Replaces all records belonging to <strong>{datasetName}</strong> with this new upload. Other unrelated datasets remain untouched.
                  </p>
                </div>
              </div>

              {/* Summary Checklist */}
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                padding: '1rem',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#fff' }}>Import Pre-flight Checklist:</div>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li>Workbook: <strong>{currentFile?.filename}</strong> &gt; Worksheet: <strong>{selectedSheetName}</strong></li>
                  <li>Total Rows to Process: <strong>{currentSheet?.rowCount}</strong></li>
                  <li>Duplicate IDs within file will be automatically skipped and reported.</li>
                  <li>Leading zeroes in IDs and mobile numbers are preserved as formatted strings.</li>
                  <li>Execution is wrapped in a database transaction with rollback protection.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 4: Summary */}
          {step === 'summary' && importSummary && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'inline-flex',
                  padding: '1rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderRadius: '50%',
                  color: 'var(--accent)',
                  marginBottom: '0.75rem'
                }}>
                  <CheckCircle2 size={40} />
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Import Completed Successfully</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Mode: <strong style={{ textTransform: 'uppercase' }}>{importSummary.mode}</strong> | Dataset: <strong>{importSummary.datasetName}</strong>
                </p>
              </div>

              {/* Counters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PROCESSED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{importSummary.totalProcessed}</div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>INSERTED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>{importSummary.inserted}</div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>UPDATED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>{importSummary.updated}</div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>SKIPPED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24' }}>{importSummary.skipped}</div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>FAILED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171' }}>{importSummary.failed}</div>
                </div>
              </div>

              {/* Skipped Details List */}
              {importSummary.errors?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--warning)', marginBottom: '0.5rem' }}>
                    Skipped & Conflicting Records Log ({importSummary.errors.length})
                  </h4>
                  <div className="table-responsive" style={{ maxHeight: '200px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Excel Row</th>
                          <th>ID</th>
                          <th>Reason Skipped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importSummary.errors.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.row || '—'}</td>
                            <td style={{ fontFamily: 'monospace' }}>{item.id}</td>
                            <td style={{ color: '#fbbf24' }}>{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'configure' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('upload')}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep('confirm')}>
                <span>Next: Choose Mode</span>
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('configure')} disabled={committing}>
                Back
              </button>
              <button className="btn btn-accent" onClick={handleCommit} disabled={committing}>
                <Check size={16} />
                <span>{committing ? 'Committing Transaction...' : 'Commit Import'}</span>
              </button>
            </>
          )}

          {step === 'summary' && (
            <button className="btn btn-primary" onClick={onClose}>
              Done & View Records
            </button>
          )}

          {step === 'upload' && (
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
