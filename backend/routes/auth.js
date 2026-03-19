'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getPasswordHash, setPasswordHash, exportFullDB, getSettings } = require('../db/database');
const { signToken, verifyToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const hash = getPasswordHash();
    if (!hash) {
      return res.status(500).json({ error: 'Auth not configured' });
    }

    const valid = await bcrypt.compare(String(password), hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const settings = getSettings();
    const token = signToken({ role: 'admin', biz: settings.bizName });
    const data = exportFullDB();

    return res.json({ token, data });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/change-password  (requires valid token)
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const hash = getPasswordHash();
    const valid = await bcrypt.compare(String(currentPassword), hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(String(newPassword), 12);
    setPasswordHash(newHash);

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/auth/verify  — lightweight token check
router.get('/verify', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
