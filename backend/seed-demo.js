'use strict';
require('dotenv').config();

const { db, getSettings, saveSettings, incrementCounter } = require('./db/database');

const force = process.argv.includes('--force');

function hasAnyData() {
  const tables = ['clients', 'projects', 'documents', 'expenses', 'products', 'subscriptions'];
  return tables.some(t => db.prepare(`SELECT COUNT(1) as c FROM ${t}`).get().c > 0);
}

if (hasAnyData() && !force) {
  console.log('Demo data not added: database already contains data. Use --force to insert anyway.');
  process.exit(0);
}

const now = Date.now();
const id = (p, n) => `${p}${now + n}`;

// Settings
const current = getSettings();
saveSettings({
  ...current,
  bizName: current.bizName || 'SHUBIQ Studio',
  ownerName: current.ownerName || 'Shubh',
  currency: current.currency || 'INR',
  tax: typeof current.tax === 'number' ? current.tax : 18,
  terms: typeof current.terms === 'number' ? current.terms : 30,
});

// Clients
const clients = [
  { id: id('c', 1), name: 'Aurora Labs', contact: 'Kriti Shah', email: 'kriti@auroralabs.co', phone: '+91 90000 11111', address: 'Bengaluru, IN', gst: '29ABCDE1234F1Z5', website: 'auroralabs.co', status: 'Active', tags: 'SaaS,Product', notes: 'Retainer client', since: '2025-06-01' },
  { id: id('c', 2), name: 'Northwind Retail', contact: 'Rishi Kapoor', email: 'rishi@northwind.in', phone: '+91 90000 22222', address: 'Mumbai, IN', gst: '27ABCDE1234F1Z5', website: 'northwind.in', status: 'Active', tags: 'Commerce', notes: 'Quarterly revamp', since: '2025-09-15' },
  { id: id('c', 3), name: 'Helio Health', contact: 'Anita Rao', email: 'anita@helio.health', phone: '+91 90000 33333', address: 'Delhi, IN', gst: '07ABCDE1234F1Z5', website: 'helio.health', status: 'Active', tags: 'HealthTech', notes: '', since: '2026-01-10' },
];

const insertClient = db.prepare(`INSERT INTO clients (id,name,contact,email,phone,address,gst,website,status,tags,notes,since) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
clients.forEach(c => insertClient.run(c.id, c.name, c.contact, c.email, c.phone, c.address, c.gst, c.website, c.status, c.tags, c.notes, c.since));

// Projects
const projects = [
  { id: id('p', 10), name: 'Aurora Dashboard 2.0', client_id: clients[0].id, service: 'Product Design', status: 'Active', budget: 450000, paid: 180000, currency: 'INR', progress: 40, start_date: '2026-02-01', due_date: '2026-05-01', description: 'Redesign analytics dashboard and onboarding' },
  { id: id('p', 11), name: 'Northwind Storefront', client_id: clients[1].id, service: 'Web Development', status: 'Active', budget: 600000, paid: 300000, currency: 'INR', progress: 55, start_date: '2026-01-15', due_date: '2026-04-15', description: 'Modern ecommerce experience with headless CMS' },
  { id: id('p', 12), name: 'Helio Mobile MVP', client_id: clients[2].id, service: 'MVP Build', status: 'In Review', budget: 350000, paid: 350000, currency: 'INR', progress: 100, start_date: '2025-11-10', due_date: '2026-02-20', description: 'Patient tracking and appointment flow' },
];

const insertProject = db.prepare(`INSERT INTO projects (id,name,client_id,service,status,budget,paid,currency,progress,start_date,due_date,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
projects.forEach(p => insertProject.run(p.id, p.name, p.client_id, p.service, p.status, p.budget, p.paid, p.currency, p.progress, p.start_date, p.due_date, p.description));

// Products
const products = [
  { id: id('prd', 20), name: 'SHUBIQ OS', cat: 'Business OS', description: 'Agency operating system', status: 'Live', launch_date: '2025-12-01', monthly: 1499, yearly: 14999, lifetime: 49999, currency: 'INR', total_rev: 0 },
  { id: id('prd', 21), name: 'Pulse CRM', cat: 'SaaS', description: 'Lightweight CRM for small teams', status: 'Beta', launch_date: '2026-03-01', monthly: 999, yearly: 9999, lifetime: 0, currency: 'INR', total_rev: 0 },
];

const insertProduct = db.prepare(`INSERT INTO products (id,name,cat,description,status,launch_date,monthly,yearly,lifetime,currency,total_rev) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
products.forEach(p => insertProduct.run(p.id, p.name, p.cat, p.description, p.status, p.launch_date, p.monthly, p.yearly, p.lifetime, p.currency, p.total_rev));

// Subscriptions
const subs = [
  { id: id('s', 30), product_id: products[0].id, plan: 'monthly', amount: 1499, currency: 'INR', subscribers: 12, date: '2026-02-28', notes: 'Early adopters' },
  { id: id('s', 31), product_id: products[0].id, plan: 'yearly', amount: 14999, currency: 'INR', subscribers: 4, date: '2026-03-10', notes: '' },
  { id: id('s', 32), product_id: products[1].id, plan: 'monthly', amount: 999, currency: 'INR', subscribers: 7, date: '2026-03-15', notes: 'Beta cohort' },
];

const insertSub = db.prepare(`INSERT INTO subscriptions (id,product_id,plan,amount,currency,subscribers,date,notes) VALUES (?,?,?,?,?,?,?,?)`);
subs.forEach(s => insertSub.run(s.id, s.product_id, s.plan, s.amount, s.currency, s.subscribers, s.date, s.notes));

// Expenses
const expenses = [
  { id: id('e', 40), description: 'AWS + Email', category: 'Infrastructure', amount: 9200, currency: 'INR', date: '2026-03-05', vendor: 'AWS', notes: '' },
  { id: id('e', 41), description: 'Ad Campaigns', category: 'Marketing', amount: 24000, currency: 'INR', date: '2026-03-08', vendor: 'Meta', notes: 'Spring push' },
  { id: id('e', 42), description: 'Tools & SaaS', category: 'Software', amount: 6700, currency: 'INR', date: '2026-03-12', vendor: 'Figma', notes: '' },
];

const insertExp = db.prepare(`INSERT INTO expenses (id,description,category,amount,currency,date,vendor,notes) VALUES (?,?,?,?,?,?,?,?)`);
expenses.forEach(e => insertExp.run(e.id, e.description, e.category, e.amount, e.currency, e.date, e.vendor, e.notes));

// Documents (Invoices / Quotations)
const docs = [
  { type: 'invoice', client_id: clients[0].id, subject: 'Aurora Dashboard Sprint 1', items: [{ name: 'Design Sprint', qty: 1, rate: 120000 }], subtotal: 120000, tax: 18, tax_amt: 21600, total: 141600, currency: 'INR', date: '2026-02-10', due_date: '2026-02-24', status: 'Paid', notes: 'Thanks!' },
  { type: 'invoice', client_id: clients[1].id, subject: 'Northwind Development Phase 1', items: [{ name: 'Dev Phase 1', qty: 1, rate: 200000 }], subtotal: 200000, tax: 18, tax_amt: 36000, total: 236000, currency: 'INR', date: '2026-03-01', due_date: '2026-03-15', status: 'Pending', notes: '' },
  { type: 'quotation', client_id: clients[2].id, subject: 'Helio Support Retainer', items: [{ name: 'Support Retainer', qty: 1, rate: 80000 }], subtotal: 80000, tax: 18, tax_amt: 14400, total: 94400, currency: 'INR', date: '2026-03-05', due_date: '2026-03-20', status: 'Accepted', notes: 'Q2 retainer' },
];

const insertDoc = db.prepare(`INSERT INTO documents (id,type,num,client_id,subject,items,subtotal,tax,tax_amt,total,currency,date,due_date,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
docs.forEach((d, i) => {
  const prefix = d.type === 'invoice' ? 'INV' : d.type === 'quotation' ? 'QUO' : 'PRO';
  const count = incrementCounter(prefix);
  const num = `${prefix}-${String(count).padStart(3, '0')}`;
  const docId = id('d', 60 + i);
  insertDoc.run(docId, d.type, num, d.client_id, d.subject, JSON.stringify(d.items), d.subtotal, d.tax, d.tax_amt, d.total, d.currency, d.date, d.due_date, d.status, d.notes);
});

console.log('Demo data inserted successfully.');
