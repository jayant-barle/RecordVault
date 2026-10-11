import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
    }

    const trimmedUser = String(username).trim();
    const userRes = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [trimmedUser]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your username and password.',
      });
    }

    const user = userRes.rows[0];
    const isMatch = bcrypt.compareSync(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your username and password.',
      });
    }

    const token = generateToken(user);

    // Audit log login
    await query(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, 'USER_LOGIN', 'user', $3, '{}', $4, CURRENT_TIMESTAMP)
    `, [user.id, user.username, String(user.id), req.ip || '127.0.0.1']);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during authentication.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userRes = await query('SELECT id, username, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true, user: userRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
