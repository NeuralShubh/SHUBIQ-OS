# SHUBIQ Business OS

A complete business management platform for agencies and freelancers — fully self-hosted on your VPS with a SQLite database backend.

---

## Features

- Dashboard with revenue charts, deadlines, outstanding payments
- Projects — budget tracking, progress, status
- Clients — CRM card view with contact details
- Invoices / Quotations / Proposals — with PDF print
- Expenses — categorized tracking with charts
- P&L Report — monthly breakdown with charts
- Products (Labs) — SaaS/digital product portfolio
- Subscriptions — revenue entry per product/plan
- Labs Analytics — subscriber and revenue charts
- Settings — business profile, bank details, tax config
- Password-protected login with JWT auth
- Fully responsive (mobile + desktop)

---

## Project Structure

```
shubiq/
├── backend/
│   ├── db/
│   │   └── database.js       # SQLite schema & helpers
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   ├── routes/
│   │   ├── auth.js           # Login, change password
│   │   └── api.js            # All CRUD endpoints
│   ├── data/                 # Auto-created, holds shubiq.db
│   ├── server.js             # Express entry point
│   ├── package.json
│   └── .env.example          # Copy to .env and configure
├── frontend/
│   ├── css/
│   │   └── main.css
│   ├── js/
│   │   └── app.js
│   └── index.html
├── ecosystem.config.js       # PM2 config
├── nginx.conf                # Nginx reverse proxy config
└── README.md
```

---

## Quick Start (Local)

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your settings (JWT secret, admin password)

# 3. Start the server
node server.js

# 4. Open browser
# http://localhost:3000
# Default password: admin123
```

---

## VPS Deployment

### Prerequisites
- Ubuntu 20.04+ VPS
- Node.js 18+
- Nginx
- PM2
- (Optional) Certbot for SSL

### Step 1 — Upload files to VPS

```bash
# From local machine
scp -r shubiq/ user@your-server-ip:/var/www/shubiq
```

Or use git:
```bash
ssh user@your-server-ip
git clone https://your-repo.git /var/www/shubiq
```

### Step 2 — Install dependencies

```bash
cd /var/www/shubiq/backend
npm install --production
```

### Step 3 — Configure environment

```bash
cp .env.example .env
nano .env
```

Set these values:
```
PORT=3000
NODE_ENV=production
JWT_SECRET=your_very_long_random_secret_here_minimum_32_chars
ADMIN_PASSWORD=your_secure_password_here
ALLOWED_ORIGINS=https://yourdomain.com
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Step 4 — Create logs directory

```bash
mkdir -p /var/www/shubiq/logs
```

### Step 5 — Start with PM2

```bash
# Install PM2 globally if not installed
npm install -g pm2

cd /var/www/shubiq
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

### Step 6 — Configure Nginx

```bash
# Copy config
sudo cp /var/www/shubiq/nginx.conf /etc/nginx/sites-available/shubiq

# Edit the server_name
sudo nano /etc/nginx/sites-available/shubiq
# Change: server_name yourdomain.com www.yourdomain.com;

# Enable site
sudo ln -s /etc/nginx/sites-available/shubiq /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7 — SSL with Let's Encrypt (recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Then edit nginx.conf to uncomment the HTTPS block
```

---

## API Endpoints

All API routes require `Authorization: Bearer <token>` header except `/api/auth/login`.

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login with password |
| GET | /api/auth/verify | Verify token |
| POST | /api/auth/change-password | Change password |
| GET | /api/db | Full data export |
| GET/PUT | /api/settings | Settings |
| GET/POST | /api/clients | List / create clients |
| PUT/DELETE | /api/clients/:id | Update / delete client |
| GET/POST | /api/projects | List / create projects |
| PUT/DELETE | /api/projects/:id | Update / delete project |
| GET/POST | /api/documents | List / create documents |
| PUT/DELETE | /api/documents/:id | Update / delete document |
| GET/POST | /api/expenses | List / create expenses |
| PUT/DELETE | /api/expenses/:id | Update / delete expense |
| GET/POST | /api/products | List / create products |
| PUT/DELETE | /api/products/:id | Update / delete product |
| GET/POST | /api/subscriptions | List / create subscriptions |
| DELETE | /api/subscriptions/:id | Delete subscription |
| POST | /api/reset | Reset all data |

---

## Backup

The database is a single SQLite file at `backend/data/shubiq.db`. Back it up regularly:

```bash
# Add to crontab for daily backup
0 2 * * * cp /var/www/shubiq/backend/data/shubiq.db /backups/shubiq-$(date +%Y%m%d).db
```

---

## Changing Password

1. Go to Settings in the app
2. Enter current password and new password
3. Click "Update Password"

Or via CLI:
```bash
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your_new_password', 12);
const db = require('better-sqlite3')('./backend/data/shubiq.db');
db.prepare('UPDATE auth SET password_hash = ? WHERE id = 1').run(hash);
console.log('Password updated');
"
```

---

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, JWT, bcryptjs
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js
- **Database:** SQLite (single file, zero config)
- **Server:** Nginx + PM2

---

## Default Login

Password: `admin123`

**Change this immediately in production** via Settings or the `.env` file.
