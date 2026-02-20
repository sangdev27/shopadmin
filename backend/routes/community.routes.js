// ============================================
// COMMUNITY ROUTES
// File: backend/routes/community.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

// GET /api/community/messages
router.get('/messages', authenticate, async (req, res) => {
    try {
        await db.execute(
            "DELETE FROM community_messages WHERE created_at < datetime('now', '-7 days')"
        );
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
        const [rows] = await db.execute(
            `SELECT cm.*, u.full_name, u.email, u.avatar, u.gender
             FROM community_messages cm
             JOIN users u ON u.id = cm.user_id
             ORDER BY cm.created_at DESC
             LIMIT ?`,
            [limit]
        );
        res.json({ success: true, data: rows.reverse() });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/community/messages
router.post('/messages', authenticate, async (req, res) => {
    try {
        const { content = '', message_type = 'text', media_url = null } = req.body;
        await db.execute(
            "DELETE FROM community_messages WHERE created_at < datetime('now', '-7 days')"
        );
        if (!content.trim() && !media_url) {
            return res.status(400).json({ success: false, message: 'Content or media is required' });
        }
        if (!['text', 'image'].includes(message_type)) {
            return res.status(400).json({ success: false, message: 'Invalid message type' });
        }

        const [result] = await db.execute(
            `INSERT INTO community_messages (user_id, content, message_type, media_url)
             VALUES (?, ?, ?, ?)`
            , [req.user.id, content.trim(), message_type, media_url]
        );

        res.json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
