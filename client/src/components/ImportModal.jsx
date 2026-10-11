import React, { useState, useRef } from 'react';
import {
  X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ArrowRight, ArrowLeft, RefreshCw, Layers, Database, ShieldAlert
} from 'lucide-react';
import { api } from '../services/api.js';

export default function ImportModal({ onClose, onImportSuccess }) {
  // Steps: 'upload' -> 'preview' -> 'mapping' -> 'confirm' -> 'result'
  const [step, setStep] = useState('upload');
  const [files, setFiles] = useState([]);
  const [inspectedData, setInspectedData] = useState(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [columnMapping, setColumnMapping] = useState({});
  const [importMode, setImportMode] = useState('merge'); // 'merge' or 'replace'
  const [datasetName, setDatasetName] = useState('');
  const [existingDatasets, setExistingDatasets] = useState([]);
  const [targetDatasetId, setTargetDatasetId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  const fileInputRef = useRef(null);

  // Load existing datasets for replace / merge targeting
  React.useEffect(() => {
    api.getDatasets().then(setExistingDatasets).catch(() => {});
  }, []);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setFiles(selected);
      inspectSelectedFiles(selected);
    }
  };

  const inspectSelectedFiles = async (fileList) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.inspectFiles(fileList);
      setInspectedData(res.files);
      if (res.files.length > 0 && res.files[0].sheets.length > 0) {
        setSelectedFileIndex(0);
        const firstSheet = res.files[0].sheets[0];
        setSelectedSheetName(firstSheet.name);
        setColumnMapping({ ...firstSheet.suggestedMapping });
        setDatasetName(`${res.files[0].filename} - ${firstSheet.name}`);
      }
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Failed to parse Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const currentFile = inspectedData ? inspectedData[selectedFileIndex] : null;
  const currentSheet = currentFile ? currentFile.sheets.find(s => s.name === selectedSheetName) : null;

  const handleSheetChange = (sheetName) => {
    setSelectedSheetName(sheetName);
    const sheet = currentFile.sheets.find(s => s.name === sheetName);
    if (sheet) {
      setColumnMapping({ ...sheet.suggestedMapping });
      setDatasetName(`${currentFile.filename} - ${sheetName}`);
    }
  };

  const handleMappingChange = (header, targetField) => {
    setColumnMapping(prev => ({ ...prev, [header]: targetField }));
  };

  const handleCommitImport = async () => {
    if (!currentFile || !selectedSheetName) return;
    setError('');
    setLoading(true);

    try {
      const payload = {
        fileId: currentFile.fileId,
        sheetName: selectedSheetName,
        columnMapping,
        mode: importMode,
        datasetId: targetDatasetId || null,
        datasetName: datasetName || `${currentFile.filename} - ${selectedSheetName}`,
      };

      const result = await api.commitImport(payload);
      setImportSummary(result.summary);
      setStep('result');
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.message || 'Failed to execute transactional import.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Excel Import Engine
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Transactional Multi-Sheet Importer with Leading Zero Preservation
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(99, 102, 241, 0.4)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '48px 24px',
                  background: 'rgba(99, 102, 241, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  maxWidth: '520px',
                  margin: '0 auto'
                }}
              >
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  marginBottom: '16px'
                }}>
                  <UploadCloud size={32} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>
                  Select Excel Workbooks
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Drag & drop or browse for <code>.xlsx</code> or <code>.xls</code> spreadsheets (Multiple files supported)
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={loading}
                >
                  {loading ? 'Inspecting Files...' : 'Browse Computer'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx, .xls"
                  multiple
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && currentFile && (
            <div>
              {/* File & Sheet selector bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
                background: 'rgba(0,0,0,0.2)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px'
              }}>
                <div>
                  <label className="form-label">Active File ({inspectedData.length})</label>
                  <select
                    className="select"
                    value={selectedFileIndex}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      setSelectedFileIndex(idx);
                      const f = inspectedData[idx];
                      if (f.sheets.length > 0) {
                        setSelectedSheetName(f.sheets[0].name);
                        setColumnMapping({ ...f.sheets[0].suggestedMapping });
                        setDatasetName(`${f.filename} - ${f.sheets[0].name}`);
                      }
                    }}
                  >
                    {inspectedData.map((f, i) => (
                      <option key={f.fileId} value={i}>{f.filename} ({(f.sizeBytes / 1024).toFixed(1)} KB)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Worksheet</label>
                  <select
                    className="select"
                    value={selectedSheetName}
                    onChange={(e) => handleSheetChange(e.target.value)}
                  >
                    {currentFile.sheets.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.rowCount} rows)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duplicate check warning if duplicate IDs detected in this sheet */}
              {currentSheet?.duplicateIdsInSheet?.length > 0 && (
                <div style={{
                  background: 'var(--warning-bg)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--warning)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '14px'
                }}>
                  <AlertTriangle size={16} />
                  <span>
                    Detected {currentSheet.duplicateIdsInSheet.length} duplicate ID row(s) within this worksheet (e.g. ID "{currentSheet.duplicateIdsInSheet[0]?.id}"). Subsequent duplicate rows will be skipped during import.
                  </span>
                </div>
              )}

              {/* Sample Data Table Preview */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Spreadsheet Preview (First 5 Rows)
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Total: {currentSheet?.rowCount || 0} Records
                  </span>
                </div>

                <div className="table-wrapper" style={{ maxHeight: '220px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {currentSheet?.headers.map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentSheet?.sampleRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {currentSheet.headers.map((h, cIdx) => (
                            <td key={cIdx} style={{ whiteSpace: 'nowrap' }}>
                              {String(row[h] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep('upload')}
                >
                  <ArrowLeft size={15} /> Select Different File
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep('mapping')}
                >
                  Configure Column Mapping <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: COLUMN MAPPING */}
          {step === 'mapping' && currentSheet && (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Map headers from worksheet <strong>"{selectedSheetName}"</strong> to standard database attributes. Unmapped headers will be retained safely as custom attributes.
              </p>

              <div style={{
                maxHeight: '280px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border-subtle)'
                }}>
                  <div>Excel Header</div>
                  <div>Target Database Field</div>
                </div>

                {currentSheet.headers.map((header) => (
                  <div
                    key={header}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{header}</div>
                    <div>
                      <select
                        className="select"
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        value={columnMapping[header] || 'custom'}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                      >
                        <option value="excel_id">Excel Business ID (Required)</option>
                        <option value="name">Full Name</option>
                        <option value="mobile">Mobile Number (Preserve 0)</option>
                        <option value="email">Email Address</option>
                        <option value="company">Company / Department</option>
                        <option value="custom">Retain as Custom Field</option>
                        <option value="ignore">Ignore / Skip Column</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep('preview')}
                >
                  <ArrowLeft size={15} /> Back to Preview
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep('confirm')}
                >
                  Set Import Mode & Confirm <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT MODE & CONFIRM */}
          {step === 'confirm' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>Select Import Mode</label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  {/* Merge Mode */}
                  <div
                    onClick={() => setImportMode('merge')}
                    style={{
                      border: importMode === 'merge' ? '2px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                      background: importMode === 'merge' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(0,0,0,0.2)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#818cf8', marginBottom: '6px' }}>
                      <RefreshCw size={16} /> Merge Records
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Updates existing records that match by Excel ID, inserts newly discovered records, and preserves existing database records.
                    </p>
                  </div>

                  {/* Replace Mode */}
                  <div
                    onClick={() => setImportMode('replace')}
                    style={{
                      border: importMode === 'replace' ? '2px solid var(--danger)' : '1px solid var(--border-subtle)',
                      background: importMode === 'replace' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0,0,0,0.2)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--danger)', marginBottom: '6px' }}>
                      <ShieldAlert size={16} /> Replace Dataset
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Replaces all records belonging strictly to this target dataset with the uploaded rows. Unrelated datasets remain 100% untouched.
                    </p>
                  </div>
                </div>

                {/* Target dataset configuration */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px'
                }}>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Target Dataset Name</label>
                    <input
                      type="text"
                      className="input"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      placeholder="e.g. Q4 2026 Staff Directory"
                    />
                  </div>

                  {existingDatasets.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Or Target Existing Dataset</label>
                      <select
                        className="select"
                        value={targetDatasetId}
                        onChange={(e) => setTargetDatasetId(e.target.value)}
                      >
                        <option value="">-- Create As New Dataset --</option>
                        {existingDatasets.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.record_count} records)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {importMode === 'replace' && (
                  <div style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    marginBottom: '16px'
                  }}>
                    <strong>Destructive Action Confirmation:</strong> Replace mode will remove all current records inside the selected dataset before importing new rows. This action cannot be undone.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep('mapping')}
                  disabled={loading}
                >
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  className={`btn ${importMode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={handleCommitImport}
                  disabled={loading}
                >
                  {loading ? 'Committing Transaction...' : (
                    <>
                      Confirm & Execute {importMode.toUpperCase()} Import <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: IMPORT SUMMARY RESULT */}
          {step === 'result' && importSummary && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--success-bg)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                  marginBottom: '12px'
                }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Import Completed Successfully!
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Dataset: <strong>{importSummary.datasetName}</strong> ({importSummary.mode.toUpperCase()} mode)
                </p>
              </div>

              {/* Metrics cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '10px',
                textAlign: 'center',
                marginBottom: '20px'
              }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{importSummary.totalProcessed}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Processed</div>
                </div>
                <div style={{ background: 'var(--success-bg)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--success)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{importSummary.inserted}</div>
                  <div style={{ fontSize: '0.72rem' }}>Inserted</div>
                </div>
                <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '12px', borderRadius: 'var(--radius-md)', color: '#60a5fa' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{importSummary.updated}</div>
                  <div style={{ fontSize: '0.72rem' }}>Updated</div>
                </div>
                <div style={{ background: 'var(--warning-bg)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--warning)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{importSummary.skipped}</div>
                  <div style={{ fontSize: '0.72rem' }}>Skipped</div>
                </div>
                <div style={{ background: importSummary.failed > 0 ? 'var(--danger-bg)' : 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: 'var(--radius-md)', color: importSummary.failed > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{importSummary.failed}</div>
                  <div style={{ fontSize: '0.72rem' }}>Failed</div>
                </div>
              </div>

              {/* Skipped rows explanation list */}
              {importSummary.errors?.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--warning)', marginBottom: '8px' }}>
                    Skipped / Errored Rows ({importSummary.errors.length})
                  </h4>
                  <div style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    background: '#090d16',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {importSummary.errors.map((err, i) => (
                      <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        Row {err.row || '?'}: ID <strong>"{err.id}"</strong> &mdash; {err.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setStep('upload');
                    setFiles([]);
                    setInspectedData(null);
                  }}
                >
                  Import Another File
                </button>
                <button
                  className="btn btn-primary"
                  onClick={onClose}
                >
                  View Records in Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
