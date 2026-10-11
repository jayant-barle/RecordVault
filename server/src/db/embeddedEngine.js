import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'embedded_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class EmbeddedDb {
  constructor() {
    this.tables = {
      users: [],
      datasets: [],
      records: [],
      import_jobs: [],
      search_history: [],
      audit_logs: [],
    };
    this.sequences = {
      users: 1,
      search_history: 1,
      audit_logs: 1,
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        this.tables = { ...this.tables, ...(data.tables || {}) };
        this.sequences = { ...this.sequences, ...(data.sequences || {}) };
      }
    } catch (err) {
      console.warn('[EmbeddedDB] Notice: Could not read previous db file, starting fresh:', err.message);
    }
  }

  save() {
    try {
      const data = {
        tables: this.tables,
        sequences: this.sequences,
        lastSaved: new Date().toISOString(),
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[EmbeddedDB] Failed to save database file:', err.message);
    }
  }

  cloneState() {
    return {
      tables: JSON.parse(JSON.stringify(this.tables)),
      sequences: { ...this.sequences },
    };
  }

  restoreState(snapshot) {
    this.tables = snapshot.tables;
    this.sequences = snapshot.sequences;
    this.save();
  }

  async query(sql, params = []) {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    // DDL or Index statements: no-op in embedded engine
    if (
      upper.startsWith('CREATE TABLE') ||
      upper.startsWith('CREATE INDEX') ||
      upper.startsWith('ALTER TABLE') ||
      upper.startsWith('DROP TABLE')
    ) {
      return { rows: [], rowCount: 0 };
    }

    // USERS table queries
    if (upper.includes('USERS')) {
      return this.handleUsers(trimmed, params);
    }

    // DATASETS table queries
    if (upper.includes('DATASETS')) {
      return this.handleDatasets(trimmed, params);
    }

    // RECORDS table queries
    if (upper.includes('RECORDS')) {
      return this.handleRecords(trimmed, params);
    }

    // IMPORT_JOBS table queries
    if (upper.includes('IMPORT_JOBS')) {
      return this.handleImportJobs(trimmed, params);
    }

    // SEARCH_HISTORY table queries
    if (upper.includes('SEARCH_HISTORY')) {
      return this.handleSearchHistory(trimmed, params);
    }

    // AUDIT_LOGS table queries
    if (upper.includes('AUDIT_LOGS')) {
      return this.handleAuditLogs(trimmed, params);
    }

    return { rows: [], rowCount: 0 };
  }

  // --- Users Handler ---
  handleUsers(sql, params) {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT COUNT(*)')) {
      return { rows: [{ count: String(this.tables.users.length) }], rowCount: 1 };
    }

    if (upper.startsWith('SELECT')) {
      let filtered = [...this.tables.users];
      if (sql.includes('WHERE LOWER(username) = LOWER($1)') || sql.includes('WHERE username = $1')) {
        filtered = filtered.filter(u => u.username.toLowerCase() === String(params[0]).toLowerCase());
      } else if (sql.includes('WHERE id = $1')) {
        filtered = filtered.filter(u => u.id === Number(params[0]));
      }
      return { rows: filtered, rowCount: filtered.length };
    }

    if (upper.startsWith('INSERT INTO USERS')) {
      // Handles multi-row insert: ($1, $2, 'admin'), ($3, $4, 'admin')
      if (params.length === 4) {
        const u1 = {
          id: this.sequences.users++,
          username: params[0],
          password_hash: params[1],
          role: 'admin',
          created_at: new Date().toISOString(),
        };
        const u2 = {
          id: this.sequences.users++,
          username: params[2],
          password_hash: params[3],
          role: 'admin',
          created_at: new Date().toISOString(),
        };
        this.tables.users.push(u1, u2);
        this.save();
        return { rows: [u1, u2], rowCount: 2 };
      }

      const newUser = {
        id: this.sequences.users++,
        username: params[0],
        password_hash: params[1],
        role: params[2] || 'admin',
        created_at: new Date().toISOString(),
      };
      this.tables.users.push(newUser);
      this.save();
      return { rows: [newUser], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  // --- Datasets Handler ---
  handleDatasets(sql, params) {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT COUNT(*)')) {
      return { rows: [{ count: String(this.tables.datasets.length) }], rowCount: 1 };
    }

    if (upper.startsWith('SELECT')) {
      let filtered = [...this.tables.datasets];
      if (sql.includes('WHERE id = $1')) {
        filtered = filtered.filter(d => String(d.id) === String(params[0]));
      }
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: filtered, rowCount: filtered.length };
    }

    if (upper.startsWith('INSERT INTO DATASETS')) {
      const newDataset = {
        id: String(params[0]),
        name: String(params[1]),
        source_filename: String(params[2] || ''),
        worksheet_name: String(params[3] || ''),
        record_count: Number(params[4] || 0),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.tables.datasets.push(newDataset);
      this.save();
      return { rows: [newDataset], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE DATASETS')) {
      if (sql.includes('source_filename = $1')) {
        const ds = this.tables.datasets.find(d => String(d.id) === String(params[2]));
        if (ds) {
          ds.source_filename = String(params[0]);
          ds.worksheet_name = String(params[1]);
          ds.updated_at = new Date().toISOString();
        }
      } else if (sql.includes('record_count = $1')) {
        const ds = this.tables.datasets.find(d => String(d.id) === String(params[1]));
        if (ds) {
          ds.record_count = Number(params[0]);
          ds.updated_at = new Date().toISOString();
        }
      } else if (sql.includes('WHERE id = $1')) {
        const ds = this.tables.datasets.find(d => String(d.id) === String(params[0]));
        if (ds) {
          const c = this.tables.records.filter(r => String(r.dataset_id) === String(ds.id)).length;
          ds.record_count = c;
          ds.updated_at = new Date().toISOString();
        }
      } else {
        // Generic recount
        this.tables.datasets.forEach(d => {
          d.record_count = this.tables.records.filter(r => String(r.dataset_id) === String(d.id)).length;
          d.updated_at = new Date().toISOString();
        });
      }
      this.save();
      return { rows: [], rowCount: 1 };
    }

    if (upper.startsWith('DELETE FROM DATASETS')) {
      const targetId = String(params[0]);
      const initLen = this.tables.datasets.length;
      this.tables.datasets = this.tables.datasets.filter(d => String(d.id) !== targetId);
      this.tables.records = this.tables.records.filter(r => String(r.dataset_id) !== targetId);
      this.save();
      return { rows: [], rowCount: initLen - this.tables.datasets.length };
    }

    return { rows: [], rowCount: 0 };
  }

  // --- Records Handler ---
  handleRecords(sql, params) {
    const upper = sql.toUpperCase();

    if (upper.startsWith('INSERT INTO RECORDS')) {
      let customFields = {};
      try {
        customFields = typeof params[7] === 'string' ? JSON.parse(params[7]) : (params[7] || {});
      } catch {
        customFields = {};
      }

      const newRecord = {
        id: String(params[0]),
        dataset_id: String(params[1] || ''),
        excel_id: String(params[2] ?? ''),
        name: params[3] !== undefined ? String(params[3]) : '',
        mobile: params[4] !== undefined ? String(params[4]) : '',
        email: params[5] !== undefined ? String(params[5]) : '',
        company: params[6] !== undefined ? String(params[6]) : '',
        custom_fields: customFields,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.tables.records.push(newRecord);
      this.save();
      return { rows: [newRecord], rowCount: 1 };
    }

    if (upper.startsWith('UPDATE RECORDS')) {
      // SET name = $1, mobile = $2, email = $3, company = $4, custom_fields = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6
      const idIdx = params.length - 1;
      const targetId = String(params[idIdx]);
      const rec = this.tables.records.find(r => String(r.id) === targetId);
      if (rec) {
        rec.name = String(params[0] ?? '');
        rec.mobile = String(params[1] ?? '');
        rec.email = String(params[2] ?? '');
        rec.company = String(params[3] ?? '');
        try {
          rec.custom_fields = typeof params[4] === 'string' ? JSON.parse(params[4]) : (params[4] || {});
        } catch {
          rec.custom_fields = rec.custom_fields || {};
        }
        rec.updated_at = new Date().toISOString();
        this.save();
        return { rows: [rec], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (upper.startsWith('DELETE FROM RECORDS')) {
      if (sql.includes('WHERE dataset_id = $1')) {
        const datasetId = String(params[0]);
        const before = this.tables.records.length;
        this.tables.records = this.tables.records.filter(r => String(r.dataset_id) !== datasetId);
        this.save();
        return { rows: [], rowCount: before - this.tables.records.length };
      }
      if (sql.includes('WHERE id = $1')) {
        const recId = String(params[0]);
        const before = this.tables.records.length;
        this.tables.records = this.tables.records.filter(r => String(r.id) !== recId);
        this.save();
        return { rows: [], rowCount: before - this.tables.records.length };
      }
      if (sql.includes('WHERE id IN') || sql.includes('WHERE records.id IN')) {
        const ids = params.map(String);
        const before = this.tables.records.length;
        this.tables.records = this.tables.records.filter(r => !ids.includes(String(r.id)));
        this.save();
        return { rows: [], rowCount: before - this.tables.records.length };
      }
    }

    if (upper.startsWith('SELECT')) {
      // Attach dataset details
      let list = this.tables.records.map(r => {
        const ds = this.tables.datasets.find(d => String(d.id) === String(r.dataset_id));
        return {
          ...r,
          dataset_name: ds ? ds.name : 'Unknown Dataset',
          source_filename: ds ? ds.source_filename : '',
          worksheet_name: ds ? ds.worksheet_name : '',
        };
      });

      // Filter by record id
      if (sql.includes('WHERE r.id = $1') || sql.includes('WHERE id = $1') || sql.includes('WHERE records.id = $1')) {
        const targetId = String(params[0]);
        const matched = list.filter(r => String(r.id) === targetId);
        return { rows: matched, rowCount: matched.length };
      }

      // Filter by dataset_id and excel_id
      if (sql.includes('WHERE dataset_id = $1 AND excel_id = $2')) {
        const matched = list.filter(r => String(r.dataset_id) === String(params[0]) && String(r.excel_id) === String(params[1]));
        return { rows: matched, rowCount: matched.length };
      }

      // Filter by record id list
      if (sql.includes('WHERE r.id IN') || sql.includes('WHERE id IN')) {
        const idList = params.map(String);
        const matched = list.filter(r => idList.includes(String(r.id)));
        return { rows: matched, rowCount: matched.length };
      }

      // Filter by dataset_id count
      if (sql.includes('SELECT COUNT(*) FROM records WHERE dataset_id = $1') || sql.includes('SELECT COUNT(*) as count FROM records WHERE dataset_id = $1')) {
        const count = list.filter(r => String(r.dataset_id) === String(params[0])).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      // General Search & Filter parsing
      let filtered = [...list];

      // Dataset filter
      if (sql.includes('r.dataset_id = $1') || sql.includes('dataset_id = $1')) {
        filtered = filtered.filter(r => String(r.dataset_id) === String(params[0]));
      }

      // Search term handling
      for (let i = 0; i < params.length; i++) {
        const pVal = params[i];
        const placeholder = `$${i + 1}`;

        // Standard exact match
        if (sql.includes(`LOWER(TRIM(r.excel_id)) = LOWER(TRIM(${placeholder}))`)) {
          filtered = filtered.filter(r => String(r.excel_id).trim().toLowerCase() === String(pVal).trim().toLowerCase());
        } else if (sql.includes(`LOWER(TRIM(r.name)) = LOWER(TRIM(${placeholder}))`)) {
          filtered = filtered.filter(r => String(r.name).trim().toLowerCase() === String(pVal).trim().toLowerCase());
        } else if (sql.includes(`LOWER(TRIM(r.mobile)) = LOWER(TRIM(${placeholder}))`)) {
          filtered = filtered.filter(r => String(r.mobile).trim().toLowerCase() === String(pVal).trim().toLowerCase());
        } else if (sql.includes(`LOWER(TRIM(r.email)) = LOWER(TRIM(${placeholder}))`)) {
          filtered = filtered.filter(r => String(r.email).trim().toLowerCase() === String(pVal).trim().toLowerCase());
        } else if (sql.includes(`LOWER(TRIM(r.company)) = LOWER(TRIM(${placeholder}))`)) {
          filtered = filtered.filter(r => String(r.company).trim().toLowerCase() === String(pVal).trim().toLowerCase());
        }

        // Custom column match: r.custom_fields->>$X
        const customColMatch = sql.match(/custom_fields->>\$(\d+)/);
        if (customColMatch && customColMatch[1] === String(i + 1)) {
          const colName = String(pVal);
          const nextVal = params[i + 1];
          filtered = filtered.filter(r => {
            const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
            return String(cf[colName] || '').trim().toLowerCase() === String(nextVal || '').trim().toLowerCase();
          });
        }

        // 'all' fields search
        if (
          sql.includes(`LOWER(TRIM(r.excel_id)) = LOWER(TRIM(${placeholder})) OR`) &&
          sql.includes(`LOWER(TRIM(r.name)) = LOWER(TRIM(${placeholder})) OR`)
        ) {
          const term = String(pVal).trim().toLowerCase();
          filtered = filtered.filter(r => {
            if (String(r.excel_id).trim().toLowerCase() === term) return true;
            if (String(r.name).trim().toLowerCase() === term) return true;
            if (String(r.mobile).trim().toLowerCase() === term) return true;
            if (String(r.email).trim().toLowerCase() === term) return true;
            if (String(r.company).trim().toLowerCase() === term) return true;
            const cf = typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields) : (r.custom_fields || {});
            return Object.values(cf).some(val => String(val).trim().toLowerCase() === term);
          });
        }
      }

      // COUNT query
      if (upper.includes('COUNT(*) AS TOTAL') || upper.includes('SELECT COUNT(*)')) {
        return { rows: [{ total: String(filtered.length), count: String(filtered.length) }], rowCount: 1 };
      }

      // Sort
      if (sql.includes('ORDER BY')) {
        const isAsc = sql.toUpperCase().includes('ASC');
        let sortField = 'created_at';
        if (sql.includes('r.excel_id')) sortField = 'excel_id';
        else if (sql.includes('r.name')) sortField = 'name';
        else if (sql.includes('r.mobile')) sortField = 'mobile';
        else if (sql.includes('r.email')) sortField = 'email';
        else if (sql.includes('r.company')) sortField = 'company';

        filtered.sort((a, b) => {
          const va = a[sortField] || '';
          const vb = b[sortField] || '';
          return isAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
      } else {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      // Pagination
      const limitMatch = sql.match(/LIMIT\s+(\$\d+|\d+)/i);
      const offsetMatch = sql.match(/OFFSET\s+(\$\d+|\d+)/i);

      let limit = filtered.length;
      let offset = 0;

      if (limitMatch) {
        const val = limitMatch[1];
        if (val.startsWith('$')) {
          const idx = parseInt(val.slice(1), 10) - 1;
          limit = Number(params[idx]);
        } else {
          limit = parseInt(val, 10);
        }
      }

      if (offsetMatch) {
        const val = offsetMatch[1];
        if (val.startsWith('$')) {
          const idx = parseInt(val.slice(1), 10) - 1;
          offset = Number(params[idx]);
        } else {
          offset = parseInt(val, 10);
        }
      }

      const paged = filtered.slice(offset, offset + limit);
      return { rows: paged, rowCount: paged.length, total: filtered.length };
    }

    return { rows: [], rowCount: 0 };
  }

  // --- Import Jobs Handler ---
  handleImportJobs(sql, params) {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT COUNT(*)')) {
      return { rows: [{ count: String(this.tables.import_jobs.length) }], rowCount: 1 };
    }

    if (upper.startsWith('INSERT INTO IMPORT_JOBS')) {
      let errors = [];
      try {
        errors = typeof params[11] === 'string' ? JSON.parse(params[11]) : (params[11] || []);
      } catch {
        errors = [];
      }
      const job = {
        id: String(params[0]),
        user_id: params[1],
        filename: String(params[2]),
        worksheet: String(params[3]),
        dataset_id: String(params[4]),
        mode: String(params[5]),
        total_processed: Number(params[6] || 0),
        inserted: Number(params[7] || 0),
        updated: Number(params[8] || 0),
        skipped: Number(params[9] || 0),
        failed: Number(params[10] || 0),
        errors,
        status: String(params[12] || 'completed'),
        created_at: new Date().toISOString(),
      };
      this.tables.import_jobs.push(job);
      this.save();
      return { rows: [job], rowCount: 1 };
    }

    if (upper.startsWith('SELECT')) {
      const sorted = [...this.tables.import_jobs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: sorted, rowCount: sorted.length };
    }

    return { rows: [], rowCount: 0 };
  }

  // --- Search History Handler ---
  handleSearchHistory(sql, params) {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT COUNT(*)')) {
      return { rows: [{ count: String(this.tables.search_history.length) }], rowCount: 1 };
    }

    if (upper.startsWith('INSERT INTO SEARCH_HISTORY')) {
      const entry = {
        id: this.sequences.search_history++,
        user_id: params[0],
        username: String(params[1] || 'anonymous'),
        search_field: String(params[2]),
        criteria_summary: String(params[3] || ''),
        result_count: Number(params[4] || 0),
        created_at: new Date().toISOString(),
      };
      this.tables.search_history.push(entry);
      this.save();
      return { rows: [entry], rowCount: 1 };
    }

    if (upper.startsWith('SELECT')) {
      const sorted = [...this.tables.search_history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const limit = params[0] ? Number(params[0]) : 50;
      return { rows: sorted.slice(0, limit), rowCount: Math.min(sorted.length, limit) };
    }

    return { rows: [], rowCount: 0 };
  }

  // --- Audit Logs Handler ---
  handleAuditLogs(sql, params) {
    const upper = sql.toUpperCase();

    if (upper.startsWith('SELECT COUNT(*)')) {
      return { rows: [{ total: String(this.tables.audit_logs.length), count: String(this.tables.audit_logs.length) }], rowCount: 1 };
    }

    if (upper.startsWith('INSERT INTO AUDIT_LOGS')) {
      let details = {};
      try {
        details = typeof params[5] === 'string' ? JSON.parse(params[5]) : (params[5] || {});
      } catch {
        details = {};
      }
      const entry = {
        id: this.sequences.audit_logs++,
        user_id: params[0],
        username: String(params[1] || 'system'),
        action: String(params[2]),
        target_type: String(params[3] || ''),
        target_id: String(params[4] || ''),
        details,
        ip_address: String(params[6] || '127.0.0.1'),
        created_at: new Date().toISOString(),
      };
      this.tables.audit_logs.push(entry);
      this.save();
      return { rows: [entry], rowCount: 1 };
    }

    if (upper.startsWith('SELECT')) {
      const sorted = [...this.tables.audit_logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const limit = params[0] ? Number(params[0]) : 30;
      const offset = params[1] ? Number(params[1]) : 0;
      const paged = sorted.slice(offset, offset + limit);
      return { rows: paged, rowCount: paged.length };
    }

    return { rows: [], rowCount: 0 };
  }
}
