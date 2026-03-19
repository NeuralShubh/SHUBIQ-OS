'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/shubiq.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    data     TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS auth (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    contact   TEXT DEFAULT '',
    email     TEXT DEFAULT '',
    phone     TEXT DEFAULT '',
    address   TEXT DEFAULT '',
    gst       TEXT DEFAULT '',
    website   TEXT DEFAULT '',
    status    TEXT DEFAULT 'Active',
    tags      TEXT DEFAULT '',
    notes     TEXT DEFAULT '',
    since     TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    service   TEXT DEFAULT '',
    status    TEXT DEFAULT 'Active',
    budget    REAL DEFAULT 0,
    paid      REAL DEFAULT 0,
    currency  TEXT DEFAULT 'INR',
    progress  INTEGER DEFAULT 0,
    start_date TEXT DEFAULT '',
    due_date  TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id        TEXT PRIMARY KEY,
    type      TEXT NOT NULL,
    num       TEXT NOT NULL UNIQUE,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    subject   TEXT DEFAULT '',
    items     TEXT DEFAULT '[]',
    subtotal  REAL DEFAULT 0,
    tax       REAL DEFAULT 0,
    tax_amt   REAL DEFAULT 0,
    total     REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    currency  TEXT DEFAULT 'INR',
    date      TEXT DEFAULT '',
    due_date  TEXT DEFAULT '',
    status    TEXT DEFAULT 'Pending',
    notes     TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id          TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category    TEXT DEFAULT 'Misc',
    amount      REAL DEFAULT 0,
    currency    TEXT DEFAULT 'INR',
    date        TEXT DEFAULT '',
    vendor      TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    scope       TEXT DEFAULT 'studio',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    cat        TEXT DEFAULT '',
    description TEXT DEFAULT '',
    status     TEXT DEFAULT 'Development',
    launch_date TEXT DEFAULT '',
    monthly    REAL DEFAULT 0,
    yearly     REAL DEFAULT 0,
    lifetime   REAL DEFAULT 0,
    currency   TEXT DEFAULT 'INR',
    total_rev  REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id          TEXT PRIMARY KEY,
    product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
    plan        TEXT DEFAULT 'monthly',
    amount      REAL DEFAULT 0,
    currency    TEXT DEFAULT 'INR',
    subscribers INTEGER DEFAULT 0,
    date        TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS counters (
    key   TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO counters (key, value) VALUES ('INV', 0);
  INSERT OR IGNORE INTO counters (key, value) VALUES ('QUO', 0);
  INSERT OR IGNORE INTO counters (key, value) VALUES ('PRO', 0);

  INSERT OR IGNORE INTO settings (id, data) VALUES (1, '{"bizName":"","ownerName":"Admin","email":"","phone":"","address":"","gst":"","website":"","bankName":"","bankHolder":"","bankAcc":"","bankIfsc":"","upi":"","currency":"INR","tax":18,"terms":30,"fyStart":"April","invNotes":""}');
`);

// ── Seed default admin password if not set ────────────────────────────────────
const existingAuth = db.prepare('SELECT id FROM auth WHERE id = 1').get();
if (!existingAuth) {
  const rawPass = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(rawPass, 12);
  db.prepare('INSERT INTO auth (id, password_hash) VALUES (1, ?)').run(hash);
  console.log(`  [DB] Default admin password set. Change via Settings or ADMIN_PASSWORD env var.`);
}

// Ensure scope column exists on expenses (migration)
const expenseCols = db.prepare("PRAGMA table_info(expenses)").all().map(c => c.name);
if (!expenseCols.includes('scope')) {
  db.prepare("ALTER TABLE expenses ADD COLUMN scope TEXT DEFAULT 'studio'").run();
}
// Ensure paid_amount exists on documents (migration)
const docCols = db.prepare("PRAGMA table_info(documents)").all().map(c => c.name);
if (!docCols.includes('paid_amount')) {
  db.prepare("ALTER TABLE documents ADD COLUMN paid_amount REAL DEFAULT 0").run();
}
if (!docCols.includes('project_id')) {
  db.prepare("ALTER TABLE documents ADD COLUMN project_id TEXT").run();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCounter(key) {
  const row = db.prepare('SELECT value FROM counters WHERE key = ?').get(key);
  return row ? row.value : 0;
}

function incrementCounter(key) {
  db.prepare('UPDATE counters SET value = value + 1 WHERE key = ?').run(key);
  return getCounter(key);
}

function getSettings() {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get();
  return row ? JSON.parse(row.data) : {};
}

function saveSettings(data) {
  db.prepare('UPDATE settings SET data = ? WHERE id = 1').run(JSON.stringify(data));
}

function getPasswordHash() {
  const row = db.prepare('SELECT password_hash FROM auth WHERE id = 1').get();
  return row ? row.password_hash : null;
}

function setPasswordHash(hash) {
  db.prepare('UPDATE auth SET password_hash = ? WHERE id = 1').run(hash);
}

// ── Full DB export (for frontend state sync) ──────────────────────────────────
function exportFullDB() {
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all()
    .map(r => ({
      id: r.id, name: r.name, contact: r.contact, email: r.email,
      phone: r.phone, address: r.address, gst: r.gst, website: r.website,
      status: r.status, tags: r.tags ? r.tags.split(',').filter(Boolean) : [],
      notes: r.notes, since: r.since,
    }));

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
    .map(r => ({
      id: r.id, name: r.name, client: r.client_id,
      service: r.service, status: r.status,
      budget: r.budget, paid: r.paid, currency: r.currency,
      progress: r.progress, start: r.start_date, due: r.due_date,
      desc: r.description,
    }));

  const documents = db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all()
    .map(r => ({
      id: r.id, type: r.type, num: r.num, client: r.client_id,
      subject: r.subject, items: JSON.parse(r.items || '[]'),
      subtotal: r.subtotal, tax: r.tax, taxAmt: r.tax_amt,
      total: r.total, paidAmount: r.paid_amount, projectId: r.project_id,
      currency: r.currency, date: r.date,
      due: r.due_date, status: r.status, notes: r.notes,
    }));

  const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all()
    .map(r => ({
      id: r.id, description: r.description, category: r.category,
      amount: r.amount, currency: r.currency, date: r.date,
      vendor: r.vendor, notes: r.notes, scope: r.scope || 'studio',
    }));

  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
    .map(r => ({
      id: r.id, name: r.name, cat: r.cat, desc: r.description,
      status: r.status, launch: r.launch_date,
      monthly: r.monthly, yearly: r.yearly, lifetime: r.lifetime,
      currency: r.currency, totalRev: r.total_rev,
    }));

  const subscriptions = db.prepare('SELECT * FROM subscriptions ORDER BY created_at DESC').all()
    .map(r => ({
      id: r.id, product: r.product_id, plan: r.plan,
      amount: r.amount, currency: r.currency,
      subscribers: r.subscribers, date: r.date, notes: r.notes,
    }));

  const countersRows = db.prepare('SELECT * FROM counters').all();
  const counters = Object.fromEntries(countersRows.map(r => [r.key, r.value]));

  return {
    settings: getSettings(),
    clients,
    projects,
    documents,
    expenses,
    products,
    subscriptions,
    counters,
  };
}

module.exports = {
  db,
  getCounter,
  incrementCounter,
  getSettings,
  saveSettings,
  getPasswordHash,
  setPasswordHash,
  exportFullDB,
};
