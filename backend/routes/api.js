'use strict';
const router = require('express').Router();
const { db, exportFullDB, getSettings, saveSettings, incrementCounter } = require('../db/database');

// ── Full DB export ─────────────────────────────────────────────────────────────
router.get('/db', (req, res) => {
  try {
    res.json(exportFullDB());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// ── Settings ───────────────────────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  res.json(getSettings());
});

router.put('/settings', (req, res) => {
  try {
    const current = getSettings();
    const updated = Object.assign({}, current, req.body);
    saveSettings(updated);
    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ── Clients ────────────────────────────────────────────────────────────────────
router.get('/clients', (req, res) => {
  const rows = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, name: r.name, contact: r.contact, email: r.email,
    phone: r.phone, address: r.address, gst: r.gst, website: r.website,
    status: r.status, tags: r.tags ? r.tags.split(',').filter(Boolean) : [],
    notes: r.notes, since: r.since,
  })));
});

router.post('/clients', (req, res) => {
  try {
    const { name, contact='', email='', phone='', address='', gst='', website='', status='Active', tags=[], notes='', since='' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = 'c' + Date.now();
    db.prepare(`INSERT INTO clients (id,name,contact,email,phone,address,gst,website,status,tags,notes,since)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, name, contact, email, phone, address, gst, website, status,
      Array.isArray(tags) ? tags.join(',') : tags, notes, since
    );
    res.status(201).json({ id, name, contact, email, phone, address, gst, website, status, tags: Array.isArray(tags) ? tags : [], notes, since });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.put('/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact='', email='', phone='', address='', gst='', website='', status='Active', tags=[], notes='', since='' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare(`UPDATE clients SET name=?,contact=?,email=?,phone=?,address=?,gst=?,website=?,status=?,tags=?,notes=?,since=? WHERE id=?`).run(
      name, contact, email, phone, address, gst, website, status,
      Array.isArray(tags) ? tags.join(',') : tags, notes, since, id
    );
    if (!result.changes) return res.status(404).json({ error: 'Client not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/clients/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Client not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ── Projects ───────────────────────────────────────────────────────────────────
router.get('/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, name: r.name, client: r.client_id,
    service: r.service, status: r.status, budget: r.budget, paid: r.paid,
    currency: r.currency, progress: r.progress, start: r.start_date,
    due: r.due_date, desc: r.description,
  })));
});

router.post('/projects', (req, res) => {
  try {
    const { name, client='', service='Web Design', status='Active', budget=0, paid=0, currency='INR', progress=0, start='', due='', desc='' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = 'p' + Date.now();
    db.prepare(`INSERT INTO projects (id,name,client_id,service,status,budget,paid,currency,progress,start_date,due_date,description)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, name, client||null, service, status, budget, paid, currency, progress, start, due, desc);
    res.status(201).json({ id, name, client, service, status, budget, paid, currency, progress, start, due, desc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, client='', service='Web Design', status='Active', budget=0, paid=0, currency='INR', progress=0, start='', due='', desc='' } = req.body;
    const result = db.prepare(`UPDATE projects SET name=?,client_id=?,service=?,status=?,budget=?,paid=?,currency=?,progress=?,start_date=?,due_date=?,description=? WHERE id=?`).run(
      name, client||null, service, status, budget, paid, currency, progress, start, due, desc, id
    );
    if (!result.changes) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ── Documents (Invoices / Quotations / Proposals) ──────────────────────────────
router.get('/documents', (req, res) => {
  const rows = db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, type: r.type, num: r.num, client: r.client_id,
    subject: r.subject, items: JSON.parse(r.items || '[]'),
    subtotal: r.subtotal, tax: r.tax, taxAmt: r.tax_amt,
    total: r.total, paidAmount: r.paid_amount, projectId: r.project_id,
    currency: r.currency, date: r.date,
    due: r.due_date, status: r.status, notes: r.notes,
  })));
});

router.post('/documents', (req, res) => {
  try {
    const { type, client='', subject='', items=[], subtotal=0, tax=0, taxAmt=0, total=0, paidAmount=0, projectId='', currency='INR', date='', due='', status='Pending', notes='' } = req.body;
    if (!type) return res.status(400).json({ error: 'Type is required' });
    const prefix = type === 'invoice' ? 'INV' : type === 'quotation' ? 'QUO' : 'PRO';
    const count = incrementCounter(prefix);
    const num = `${prefix}-${String(count).padStart(3, '0')}`;
    const id = 'd' + Date.now();
    db.prepare(`INSERT INTO documents (id,type,num,client_id,subject,items,subtotal,tax,tax_amt,total,paid_amount,project_id,currency,date,due_date,status,notes)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, type, num, client||null, subject, JSON.stringify(items),
      subtotal, tax, taxAmt, total, paidAmount, projectId||null, currency, date, due, status, notes
    );
    res.status(201).json({ id, type, num, client, subject, items, subtotal, tax, taxAmt, total, paidAmount, projectId, currency, date, due, status, notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.put('/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    const body = req.body || {};
    const client = body.client !== undefined ? body.client : existing.client_id;
    const subject = body.subject !== undefined ? body.subject : existing.subject;
    const items = body.items !== undefined ? JSON.stringify(body.items) : existing.items;
    const subtotal = body.subtotal !== undefined ? body.subtotal : existing.subtotal;
    const tax = body.tax !== undefined ? body.tax : existing.tax;
    const taxAmt = body.taxAmt !== undefined ? body.taxAmt : existing.tax_amt;
    const total = body.total !== undefined ? body.total : existing.total;
    const paidAmount = body.paidAmount !== undefined ? body.paidAmount : existing.paid_amount;
    const projectId = body.projectId !== undefined ? body.projectId : existing.project_id;
    const currency = body.currency !== undefined ? body.currency : existing.currency;
    const date = body.date !== undefined ? body.date : existing.date;
    const due = body.due !== undefined ? body.due : existing.due_date;
    const status = body.status !== undefined ? body.status : existing.status;
    const notes = body.notes !== undefined ? body.notes : existing.notes;
    const result = db.prepare(`UPDATE documents SET client_id=?,subject=?,items=?,subtotal=?,tax=?,tax_amt=?,total=?,paid_amount=?,project_id=?,currency=?,date=?,due_date=?,status=?,notes=? WHERE id=?`).run(
      client||null, subject||'', items||'[]',
      subtotal||0, tax||0, taxAmt||0, total||0,
      paidAmount||0, projectId||null, currency||'INR', date||'', due||'', status||'Pending', notes||'', id
    );
    if (!result.changes) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/documents/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT type FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const result = db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Document not found' });
    const prefix = doc.type === 'invoice' ? 'INV' : doc.type === 'quotation' ? 'QUO' : 'PRO';
    const maxRow = db.prepare("SELECT MAX(CAST(substr(num, 5) AS INTEGER)) as max FROM documents WHERE type = ?").get(doc.type);
    const maxVal = maxRow && maxRow.max ? maxRow.max : 0;
    db.prepare('UPDATE counters SET value = ? WHERE key = ?').run(maxVal, prefix);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ── Expenses ───────────────────────────────────────────────────────────────────
router.get('/expenses', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, description: r.description, category: r.category,
    amount: r.amount, currency: r.currency, date: r.date,
    vendor: r.vendor, notes: r.notes, scope: r.scope || 'studio',
  })));
});

router.post('/expenses', (req, res) => {
  try {
    const { description, category='Misc', amount=0, currency='INR', date='', vendor='', notes='', scope='studio' } = req.body;
    if (!description) return res.status(400).json({ error: 'Description is required' });
    const id = 'e' + Date.now();
    db.prepare(`INSERT INTO expenses (id,description,category,amount,currency,date,vendor,notes,scope)
                VALUES (?,?,?,?,?,?,?,?,?)`).run(id, description, category, amount, currency, date, vendor, notes, scope);
    res.status(201).json({ id, description, category, amount, currency, date, vendor, notes, scope });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.put('/expenses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { description, category='Misc', amount=0, currency='INR', date='', vendor='', notes='', scope='studio' } = req.body;
    const result = db.prepare(`UPDATE expenses SET description=?,category=?,amount=?,currency=?,date=?,vendor=?,notes=?,scope=? WHERE id=?`).run(
      description, category, amount, currency, date, vendor, notes, scope, id
    );
    if (!result.changes) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/expenses/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ── Products ───────────────────────────────────────────────────────────────────
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, name: r.name, cat: r.cat, desc: r.description,
    status: r.status, launch: r.launch_date,
    monthly: r.monthly, yearly: r.yearly, lifetime: r.lifetime,
    currency: r.currency, totalRev: r.total_rev,
  })));
});

router.post('/products', (req, res) => {
  try {
    const { name, cat='', desc='', status='Development', launch='', monthly=0, yearly=0, lifetime=0, currency='INR' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = 'prod' + Date.now();
    db.prepare(`INSERT INTO products (id,name,cat,description,status,launch_date,monthly,yearly,lifetime,currency,total_rev)
                VALUES (?,?,?,?,?,?,?,?,?,?,0)`).run(id, name, cat, desc, status, launch, monthly, yearly, lifetime, currency);
    res.status(201).json({ id, name, cat, desc, status, launch, monthly, yearly, lifetime, currency, totalRev: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, cat='', desc='', status='Development', launch='', monthly=0, yearly=0, lifetime=0, currency='INR', totalRev=0 } = req.body;
    const result = db.prepare(`UPDATE products SET name=?,cat=?,description=?,status=?,launch_date=?,monthly=?,yearly=?,lifetime=?,currency=?,total_rev=? WHERE id=?`).run(
      name, cat, desc, status, launch, monthly, yearly, lifetime, currency, totalRev, id
    );
    if (!result.changes) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ── Subscriptions ──────────────────────────────────────────────────────────────
router.get('/subscriptions', (req, res) => {
  const rows = db.prepare('SELECT * FROM subscriptions ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, product: r.product_id, plan: r.plan,
    amount: r.amount, currency: r.currency,
    subscribers: r.subscribers, date: r.date, notes: r.notes,
  })));
});

router.post('/subscriptions', (req, res) => {
  try {
    const { product='', plan='monthly', amount=0, currency='INR', subscribers=0, date='', notes='' } = req.body;
    const id = 'sub' + Date.now();
    db.prepare(`INSERT INTO subscriptions (id,product_id,plan,amount,currency,subscribers,date,notes)
                VALUES (?,?,?,?,?,?,?,?)`).run(id, product||null, plan, amount, currency, subscribers, date, notes);

    // Update product total_rev
    if (product) {
      db.prepare('UPDATE products SET total_rev = total_rev + ? WHERE id = ?').run(amount, product);
    }

    res.status(201).json({ id, product, plan, amount, currency, subscribers, date, notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create subscription entry' });
  }
});

router.delete('/subscriptions/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Subscription not found' });
    db.prepare('DELETE FROM subscriptions WHERE id = ?').run(req.params.id);
    // Subtract from product total_rev
    if (row.product_id) {
      db.prepare('UPDATE products SET total_rev = MAX(0, total_rev - ?) WHERE id = ?').run(row.amount, row.product_id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// ── Data reset (danger zone) ──────────────────────────────────────────────────
router.post('/reset', (req, res) => {
  try {
    db.prepare('DELETE FROM subscriptions').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM projects').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare("UPDATE counters SET value = 0").run();
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify({
      bizName:'',ownerName:'Admin',email:'',phone:'',address:'',
      gst:'',website:'',bankName:'',bankHolder:'',bankAcc:'',
      bankIfsc:'',upi:'',currency:'INR',tax:18,terms:30,fyStart:'April',invNotes:''
    }));
    res.json({ success: true, message: 'All data has been reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = router;
