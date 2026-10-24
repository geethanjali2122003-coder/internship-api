const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

// ---------- Sample data (internship-board-sample.sql-ലെ അതേ SQL) ----------
const SAMPLE_SQL = `
CREATE TABLE internships (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    mode TEXT NOT NULL,
    duration_weeks INTEGER NOT NULL,
    applications_open INTEGER NOT NULL DEFAULT 1
);

INSERT INTO internships (id, title, domain, mode, duration_weeks, applications_open) VALUES
('INT-001', 'Frontend Practice Internship', 'Web Development', 'Remote', 4, 1),
('INT-002', 'Data Dashboard Internship', 'Data Analytics', 'Remote', 6, 1),
('INT-003', 'Product Design Internship', 'UI/UX', 'Hybrid', 4, 1),
('INT-004', 'C++ Utility Internship', 'C++ Programming', 'Remote', 5, 0);

CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id TEXT NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (internship_id, applicant_email),
    FOREIGN KEY (internship_id) REFERENCES internships(id)
);
`;

// ---------- Database ----------
const db = new Database(path.join(__dirname, 'internships.db'));
db.pragma('foreign_keys = ON');

// internships table ഇല്ലെങ്കിൽ മാത്രം sample data ഇടും
const hasTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'internships'")
  .get();
if (!hasTable) {
  db.exec(SAMPLE_SQL);
  console.log('Sample database loaded');
}

const app = express();
app.use(express.json());

const MODES = ['Remote', 'Hybrid', 'Onsite'];

// ---------- Helpers ----------

// എല്ലാ error-ഉം ഒരേ രൂപത്തിൽ: { error: { message, details? } }
function fail(res, status, message, details) {
  const error = { message };
  if (details) error.details = details;
  return res.status(status).json({ error });
}

// applications_open 0/1 എന്നത് true/false ആക്കി കാണിക്കുന്നു
function show(row) {
  return { ...row, applications_open: row.applications_open === 1 };
}

function findOne(id) {
  return db.prepare('SELECT * FROM internships WHERE id = ?').get(id);
}

// പുതിയ id ഉണ്ടാക്കുന്നു: INT-005, INT-006 ...
function nextId() {
  const row = db
    .prepare("SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS m FROM internships")
    .get();
  const n = (row.m || 0) + 1;
  return 'INT-' + String(n).padStart(3, '0');
}

// Validation: എല്ലാ തെറ്റും ഒരുമിച്ച് തിരിച്ചു തരും
function validate(body, existing) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];

  for (const f of ['title', 'domain']) {
    if (typeof b[f] !== 'string' || b[f].trim() === '') {
      errors.push(`${f} is required and must be non-empty text`);
    }
  }
  if (!MODES.includes(b.mode)) {
    errors.push(`mode must be one of: ${MODES.join(', ')}`);
  }
  if (!Number.isInteger(b.duration_weeks) || b.duration_weeks < 1 || b.duration_weeks > 52) {
    errors.push('duration_weeks must be a whole number between 1 and 52');
  }

  // applications_open ഓപ്ഷണൽ ആണ്. തന്നില്ലെങ്കിൽ പഴയ മൂല്യം (പുതിയതിന് 1) നിൽക്കും
  let open = existing ? existing.applications_open : 1;
  if (b.applications_open !== undefined) {
    if (typeof b.applications_open === 'boolean') open = b.applications_open ? 1 : 0;
    else if (b.applications_open === 0 || b.applications_open === 1) open = b.applications_open;
    else errors.push('applications_open must be true or false');
  }

  return {
    errors,
    values: {
      title: String(b.title || '').trim(),
      domain: String(b.domain || '').trim(),
      mode: b.mode,
      duration_weeks: b.duration_weeks,
      applications_open: open,
    },
  };
}

// ---------- Endpoints ----------

// 1) LIST + pagination:  GET /internships?page=1&limit=10
app.get('/internships', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  if (!Number.isInteger(page) || page < 1) {
    return fail(res, 400, 'page must be a whole number, 1 or more');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return fail(res, 400, 'limit must be a whole number between 1 and 50');
  }

  const total = db.prepare('SELECT COUNT(*) AS c FROM internships').get().c;
  const rows = db
    .prepare('SELECT * FROM internships ORDER BY id LIMIT ? OFFSET ?')
    .all(limit, (page - 1) * limit);

  res.json({
    data: rows.map(show),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// 2) DETAIL:  GET /internships/INT-001
app.get('/internships/:id', (req, res) => {
  const row = findOne(req.params.id);
  if (!row) return fail(res, 404, 'Internship not found');
  res.json({ data: show(row) });
});

// 3) CREATE:  POST /internships
app.post('/internships', (req, res) => {
  const { errors, values } = validate(req.body, null);
  if (errors.length) return fail(res, 400, 'Validation failed', errors);

  const id = nextId();
  db.prepare(
    `INSERT INTO internships (id, title, domain, mode, duration_weeks, applications_open)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, values.title, values.domain, values.mode, values.duration_weeks, values.applications_open);

  res.status(201).json({ data: show(findOne(id)) });
});

// 4) UPDATE:  PUT /internships/INT-001
app.put('/internships/:id', (req, res) => {
  const existing = findOne(req.params.id);
  if (!existing) return fail(res, 404, 'Internship not found');

  const { errors, values } = validate(req.body, existing);
  if (errors.length) return fail(res, 400, 'Validation failed', errors);

  db.prepare(
    `UPDATE internships
     SET title = ?, domain = ?, mode = ?, duration_weeks = ?, applications_open = ?
     WHERE id = ?`
  ).run(values.title, values.domain, values.mode, values.duration_weeks, values.applications_open, existing.id);

  res.json({ data: show(findOne(existing.id)) });
});

// 5) DELETE:  DELETE /internships/INT-001
app.delete('/internships/:id', (req, res) => {
  if (!findOne(req.params.id)) return fail(res, 404, 'Internship not found');
  try {
    db.prepare('DELETE FROM internships WHERE id = ?').run(req.params.id);
    res.json({ data: { message: 'Internship deleted' } });
  } catch (e) {
    // applications table-ൽ ഈ internship-ന് applications ഉണ്ടെങ്കിൽ
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
      return fail(res, 409, 'Cannot delete: this internship has applications');
    }
    throw e;
  }
});

// ---------- Errors ----------
app.use((req, res) => fail(res, 404, 'Route not found'));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Invalid JSON in request body');
  console.error(err);
  fail(res, 500, 'Server error');
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));