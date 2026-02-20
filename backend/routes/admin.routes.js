// ============================================
// ADMIN ROUTES
// File: backend/routes/admin.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/database');
const notificationService = require('../services/notificationService');
const { exportAll, queueFullBackup } = require('../services/telegramBackupService');
const { getArchive } = require('../services/archiveService');
const logService = require('../services/logService');
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL || 'duongthithuyhangkupee@gmail.com';
const slugify = (text = '') => text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

async function getDatabaseSizeBytes() {
    try {
        const [pageSizeRows] = await db.execute('PRAGMA page_size');
        const [pageCountRows] = await db.execute('PRAGMA page_count');
        const pageSize = Number(pageSizeRows[0]?.page_size || 0);
        const pageCount = Number(pageCountRows[0]?.page_count || 0);
        return pageSize * pageCount;
    } catch (error) {
        return 0;
    }
}

async function getTableStats() {
    try {
        const [tableRows] = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        const results = [];
        for (const row of tableRows) {
            const tableName = row.name;
            if (!tableName) continue;
            const [countRows] = await db.execute(`SELECT COUNT(*) as rows FROM ${tableName}`);
            results.push({
                name: tableName,
                rows: countRows[0]?.rows || 0,
                bytes: 0
            });
        }
        return results;
    } catch (error) {
        return [];
    }
}

async function getUserById(userId) {
    const [rows] = await db.execute(
        'SELECT id, email, role FROM users WHERE id = ?',
        [userId]
    );
    return rows[0] || null;
}

function isPrimaryAdmin(user) {
    return !!user && user.email === PRIMARY_ADMIN_EMAIL;
}

function isRequestFromPrimary(req) {
    return req.user && req.user.email === PRIMARY_ADMIN_EMAIL;
}

// All admin routes require admin role
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Total revenue
        const [revenue] = await db.execute(
            "SELECT setting_value as total_revenue FROM system_settings WHERE setting_key = 'total_revenue'"
        );

        // Total users
        const [totalUsers] = await db.execute(
            'SELECT COUNT(*) as total FROM users'
        );

        // Active users (logged in last 30 days)
        const [activeUsers] = await db.execute(
            "SELECT COUNT(*) as total FROM users WHERE last_login >= datetime('now', '-30 days')"
        );

        // Total products
        const [totalProducts] = await db.execute(
            "SELECT COUNT(*) as total FROM products WHERE status = 'active'"
        );

        const dbSizeBytes = await getDatabaseSizeBytes();

        // Revenue series (purchases only)
        const [dailyRows] = await db.execute(
            `SELECT strftime('%Y-%m-%d', created_at) as label, SUM(-amount) as revenue
             FROM transactions
             WHERE type = 'purchase'
             GROUP BY label
             ORDER BY label DESC
             LIMIT 30`
        );

        const [monthlyRows] = await db.execute(
            `SELECT strftime('%Y-%m', created_at) as label, SUM(-amount) as revenue
             FROM transactions
             WHERE type = 'purchase'
             GROUP BY label
             ORDER BY label DESC
             LIMIT 12`
        );

        const normalizeSeries = (rows = []) =>
            rows
                .map(r => ({ label: r.label, value: parseFloat(r.revenue || 0) }))
                .sort((a, b) => a.label.localeCompare(b.label));

        res.json({
            success: true,
            data: {
                totalRevenue: parseFloat(revenue[0]?.total_revenue || 0),
                totalUsers: totalUsers[0].total,
                activeUsers: activeUsers[0].total,
                totalProducts: totalProducts[0].total,
                dbSizeBytes: parseInt(dbSizeBytes || 0, 10),
                dailyRevenue: normalizeSeries(dailyRows),
                monthlyRevenue: normalizeSeries(monthlyRows)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 50, status, role } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT id, email, full_name, avatar, role, balance, status, created_at, last_login FROM users';
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }

        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [users] = await db.execute(query, params);

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/admin/users/inactive
router.get('/users/inactive', async (req, res) => {
    try {
        const days = Math.max(parseInt(req.query.days || '30', 10), 1);
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
        const [rows] = await db.execute(
            `SELECT id, email, full_name, role, status, created_at, last_login
             FROM users
             WHERE role != 'admin'
               AND (
                    (last_login IS NULL AND created_at < datetime('now', '-' || ? || ' days'))
                    OR (last_login < datetime('now', '-' || ? || ' days'))
               )
             ORDER BY COALESCE(last_login, created_at) ASC
             LIMIT ?`,
            [days, days, limit]
        );
        res.json({ success: true, data: rows, days });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/users/inactive
router.delete('/users/inactive', async (req, res) => {
    try {
        const days = Math.max(parseInt(req.query.days || '30', 10), 1);
        const [result] = await db.execute(
            `DELETE FROM users
             WHERE role != 'admin'
               AND (
                    (last_login IS NULL AND created_at < datetime('now', '-' || ? || ' days'))
                    OR (last_login < datetime('now', '-' || ? || ' days'))
               )`,
            [days, days]
        );
        res.json({ success: true, deleted: result.affectedRows || 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;

        if (!['user', 'seller', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        const target = await getUserById(req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (isPrimaryAdmin(target) && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể chỉnh sửa vai trò của admin chính'
            });
        }

        if (role === 'admin' && !isPrimaryAdmin(target)) {
            return res.status(403).json({
                success: false,
                message: 'Không được tăng cấp user lên admin'
            });
        }

        if (target.role === 'admin' && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ admin chính mới được chỉnh sửa vai trò của admin'
            });
        }

        await db.execute(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, req.params.id]
        );

        res.json({
            success: true,
            message: 'User role updated'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        if (!['active', 'banned'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const target = await getUserById(req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (isPrimaryAdmin(target) && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể khóa hoặc mở khóa admin chính'
            });
        }

        await db.execute(
            'UPDATE users SET status = ? WHERE id = ?',
            [status, req.params.id]
        );

        res.json({
            success: true,
            message: `User ${status === 'banned' ? 'banned' : 'unbanned'} successfully`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST /api/admin/revenue/reset
router.post('/revenue/reset', async (req, res) => {
    try {
        await db.execute(
            "UPDATE system_settings SET setting_value = '0' WHERE setting_key = 'total_revenue'"
        );

        res.json({
            success: true,
            message: 'Revenue reset successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/admin/deposit-requests
router.get('/deposit-requests', async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const params = [];
        let where = '';

        if (status) {
            where = 'WHERE dr.status = ?';
            params.push(status);
        }

        const [rows] = await db.execute(
            `SELECT dr.*, u.email, u.full_name
             FROM deposit_requests dr
             JOIN users u ON u.id = dr.user_id
             ${where}
             ORDER BY dr.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/deposit-requests/:id/approve
router.put('/deposit-requests/:id/approve', async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { approve = true, admin_note } = req.body;

        await connection.beginTransaction();

        const [rows] = await connection.execute(
            'SELECT * FROM deposit_requests WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            throw new Error('Deposit request not found');
        }

        const request = rows[0];

        if (request.status !== 'pending') {
            throw new Error('Request already processed');
        }

        const newStatus = approve ? 'approved' : 'rejected';

        await connection.execute(
            `UPDATE deposit_requests
             SET status = ?, admin_note = ?, approved_by = ?, processed_at = datetime('now')
             WHERE id = ?`,
            [newStatus, admin_note || null, req.user.id, req.params.id]
        );

        if (approve) {
            const amount = parseFloat(request.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error('Invalid deposit amount');
            }

            const [users] = await connection.execute(
                'SELECT balance FROM users WHERE id = ?',
                [request.user_id]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            const before = parseFloat(users[0].balance || 0);
            const after = before + amount;

            const [updateResult] = await connection.execute(
                'UPDATE users SET balance = ? WHERE id = ?',
                [after, request.user_id]
            );

            if (updateResult.affectedRows === 0) {
                throw new Error('Failed to update user balance');
            }

            await connection.execute(
                `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description, reference_id)
                 VALUES (?, 'deposit', ?, ?, ?, ?, ?)`,
                [request.user_id, amount, before, after, 'Deposit approved', request.id]
            );
        }

        await connection.commit();

        res.json({ success: true, message: `Deposit ${newStatus}` });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

// POST /api/admin/balance/adjust
router.post('/balance/adjust', async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { user_id, amount, description } = req.body;

        if (!user_id || !amount) {
            throw new Error('user_id and amount are required');
        }

        const target = await getUserById(user_id);
        if (!target) {
            throw new Error('User not found');
        }

        if (isPrimaryAdmin(target) && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể chỉnh số dư của admin chính'
            });
        }

        await connection.beginTransaction();

        const [users] = await connection.execute(
            'SELECT balance FROM users WHERE id = ?',
            [user_id]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const before = users[0].balance;
        const after = before + parseFloat(amount);

        await connection.execute(
            'UPDATE users SET balance = ? WHERE id = ?',
            [after, user_id]
        );

        await connection.execute(
            `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
             VALUES (?, 'admin_adjust', ?, ?, ?, ?)`,
            [user_id, amount, before, after, description || 'Admin balance adjust']
        );

        await connection.commit();
        res.json({ success: true, message: 'Balance updated', data: { balance: after } });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

// GET /api/admin/products
router.get('/products', async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('p.status = ?');
            params.push(status);
        }
        if (search) {
            conditions.push('(p.title LIKE ? OR p.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await db.execute(
            `SELECT p.*, u.full_name as seller_name
             FROM products p
             JOIN users u ON u.id = p.seller_id
             ${where}
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/categories
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, name, slug, description, icon, parent_id, display_order, is_active, created_at
             FROM categories
             ORDER BY display_order ASC, id ASC`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/categories
router.post('/categories', async (req, res) => {
    try {
        const { name, slug, icon, display_order = 0, is_active = true } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        let finalSlug = (slug && slug.trim()) ? slugify(slug) : slugify(name);
        if (!finalSlug) finalSlug = `category-${Date.now()}`;

        const [exists] = await db.execute('SELECT id FROM categories WHERE slug = ?', [finalSlug]);
        if (exists.length > 0) {
            finalSlug = `${finalSlug}-${Date.now()}`;
        }

        const [result] = await db.execute(
            `INSERT INTO categories (name, slug, icon, display_order, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), finalSlug, icon || null, parseInt(display_order, 10) || 0, !!is_active]
        );

        res.json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res) => {
    try {
        const { name, slug, icon, display_order = 0, is_active = true } = req.body;
        const id = req.params.id;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        let finalSlug = (slug && slug.trim()) ? slugify(slug) : slugify(name);
        if (!finalSlug) finalSlug = `category-${Date.now()}`;

        const [exists] = await db.execute(
            'SELECT id FROM categories WHERE slug = ? AND id != ?',
            [finalSlug, id]
        );
        if (exists.length > 0) {
            finalSlug = `${finalSlug}-${Date.now()}`;
        }

        await db.execute(
            `UPDATE categories
             SET name = ?, slug = ?, icon = ?, display_order = ?, is_active = ?
             WHERE id = ?`,
            [name.trim(), finalSlug, icon || null, parseInt(display_order, 10) || 0, !!is_active, id]
        );

        res.json({ success: true, message: 'Category updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/products/:id/status
router.put('/products/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'inactive', 'banned'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const [rows] = await db.execute(
            `SELECT u.email
             FROM products p
             JOIN users u ON u.id = p.seller_id
             WHERE p.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (rows[0].email === PRIMARY_ADMIN_EMAIL && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể chỉnh trạng thái sản phẩm của admin chính'
            });
        }

        await db.execute('UPDATE products SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ success: true, message: 'Product status updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.email
             FROM products p
             JOIN users u ON u.id = p.seller_id
             WHERE p.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (rows[0].email === PRIMARY_ADMIN_EMAIL && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể xóa sản phẩm của admin chính'
            });
        }

        await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/posts
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(
            `SELECT p.*, u.full_name
             FROM posts p
             JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/posts/:id
router.delete('/posts/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.email
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        if (rows[0].email === PRIMARY_ADMIN_EMAIL && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể xóa bài đăng của admin chính'
            });
        }

        await db.execute('DELETE FROM posts WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/messages
router.get('/messages', async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const offset = (page - 1) * limit;

        const [rows] = await db.execute(
            `SELECT m.*, 
                    us.full_name as sender_name, 
                    ur.full_name as receiver_name
             FROM messages m
             JOIN users us ON us.id = m.sender_id
             JOIN users ur ON ur.id = m.receiver_id
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/support
router.get('/support', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT sr.*, u.email
             FROM support_requests sr
             JOIN users u ON u.id = sr.user_id
             ORDER BY sr.created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/support/:id/reply
router.put('/support/:id/reply', async (req, res) => {
    try {
        const { reply } = req.body;
        if (!reply) {
            return res.status(400).json({ success: false, message: 'Reply is required' });
        }
        await db.execute(
            `UPDATE support_requests
             SET admin_reply = ?, status = 'replied', replied_at = datetime('now')
             WHERE id = ?`,
            [reply, req.params.id]
        );
        res.json({ success: true, message: 'Replied' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// GET /api/admin/support/threads
router.get('/support/threads', async (req, res) => {
    try {
        const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
        if (adminRows.length === 0) {
            return res.status(400).json({ success: false, message: 'Admin not found' });
        }
        const adminId = adminRows[0].id;

        const [threads] = await db.execute(
            `SELECT u.id as user_id, u.email, u.full_name, m.content, m.created_at
             FROM users u
             JOIN (
                SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS user_id,
                       MAX(created_at) AS last_time
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY user_id
             ) t ON t.user_id = u.id
             JOIN messages m ON m.created_at = t.last_time
             WHERE (m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id)
             ORDER BY t.last_time DESC`,
            [adminId, adminId, adminId, adminId, adminId]
        );

        res.json({ success: true, data: threads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/support/thread/:userId
router.get('/support/thread/:userId', async (req, res) => {
    try {
        const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
        if (adminRows.length === 0) {
            return res.status(400).json({ success: false, message: 'Admin not found' });
        }
        const adminId = adminRows[0].id;
        const userId = req.params.userId;
        const [rows] = await db.execute(
            `SELECT * FROM messages
             WHERE (sender_id = ? AND receiver_id = ?)
                OR (sender_id = ? AND receiver_id = ?)
             ORDER BY created_at ASC`,
            [userId, adminId, adminId, userId]
        );
        res.json({ success: true, data: rows, admin_id: adminId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/support/thread/:userId
router.post('/support/thread/:userId', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }
        const [adminRows] = await db.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
        if (adminRows.length === 0) {
            return res.status(400).json({ success: false, message: 'Admin not found' });
        }
        const adminId = adminRows[0].id;
        const userId = req.params.userId;

        const [result] = await db.execute(
            'INSERT INTO messages (sender_id, receiver_id, message_type, content) VALUES (?, ?, ?, ?)',
            [adminId, userId, 'text', content]
        );

        res.json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    try {
        const target = await getUserById(req.params.id);
        if (!target) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (isPrimaryAdmin(target) && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Không thể xóa tài khoản admin chính'
            });
        }

        if (target.role === 'admin' && !isRequestFromPrimary(req)) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ admin chính mới được xóa tài khoản admin'
            });
        }

        await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/settings/:key
router.put('/settings/:key', async (req, res) => {
    try {
        const { value } = req.body;
        const key = req.params.key;
        const [existing] = await db.execute(
            'SELECT id FROM system_settings WHERE setting_key = ?',
            [key]
        );

        if (existing.length > 0) {
            await db.execute(
                'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
                [value, key]
            );
        } else {
            await db.execute(
                'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
                [key, value]
            );
        }
        res.json({ success: true, message: 'Setting updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/notifications
router.get('/notifications', async (req, res) => {
    try {
        await db.execute(
            "DELETE FROM notifications WHERE created_at < datetime('now', '-12 hours')"
        );
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
        const [rows] = await db.execute(
            `SELECT n.*, u.email as target_email, u.full_name as target_name
             FROM notifications n
             LEFT JOIN users u ON u.id = n.target_user_id
             ORDER BY n.created_at DESC
             LIMIT ?`,
            [limit]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/storage-info
router.get('/storage-info', async (req, res) => {
    try {
        const dbSizeBytes = await getDatabaseSizeBytes();
        const tableRows = await getTableStats();
        const [counts] = await db.execute(
            `SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM products) AS products,
                (SELECT COUNT(*) FROM posts) AS posts,
                (SELECT COUNT(*) FROM messages) AS messages,
                (SELECT COUNT(*) FROM community_messages) AS community_messages,
                (SELECT COUNT(*) FROM notifications) AS notifications,
                (SELECT COUNT(*) FROM purchases) AS purchases
            `
        );
        res.json({
            success: true,
            data: {
                dbSizeBytes,
                counts: counts[0] || {},
                tables: tableRows || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/backup/export
router.get('/backup/export', async (req, res) => {
    try {
        const data = await exportAll();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=\"data.json\"');
        res.send(JSON.stringify(data, null, 2));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/backup/telegram
router.post('/backup/telegram', async (req, res) => {
    try {
        queueFullBackup('manual', { by: req.user.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/notifications
router.post('/notifications', async (req, res) => {
    try {
        const { title, content = '', image_url = null, target_user_id = null, target_user_ids = null, target_email = null } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        let resolvedTargetId = target_user_id ? parseInt(target_user_id, 10) : null;
        const targetEmail = target_email ? target_email.trim() : '';

        if (targetEmail) {
            const [targets] = await db.execute(
                'SELECT id FROM users WHERE email = ?',
                [targetEmail]
            );
            if (targets.length === 0) {
                return res.status(400).json({ success: false, message: 'Target user not found' });
            }
            resolvedTargetId = targets[0].id;
        } else if (resolvedTargetId) {
            const [targets] = await db.execute(
                'SELECT id FROM users WHERE id = ?',
                [resolvedTargetId]
            );
            if (targets.length === 0) {
                return res.status(400).json({ success: false, message: 'Target user not found' });
            }
        }

        const ids = [];
        const normalizedTitle = title.trim();
        const normalizedContent = content.trim();
        const normalizedImage = image_url ? String(image_url).trim() : null;

        if (Array.isArray(target_user_ids) && target_user_ids.length) {
            const uniqueIds = [...new Set(target_user_ids.map(id => parseInt(id, 10)).filter(id => Number.isFinite(id)))];
            if (!uniqueIds.length) {
                return res.status(400).json({ success: false, message: 'Target user not found' });
            }
            const placeholders = uniqueIds.map(() => '?').join(',');
            const [targets] = await db.execute(
                `SELECT id FROM users WHERE id IN (${placeholders})`,
                uniqueIds
            );
            const existingIds = new Set(targets.map(t => t.id));
            const filtered = uniqueIds.filter(id => existingIds.has(id));
            if (!filtered.length) {
                return res.status(400).json({ success: false, message: 'Target user not found' });
            }

            for (const userId of filtered) {
                const id = await notificationService.createNotification({
                    title: normalizedTitle,
                    content: normalizedContent,
                    image_url: normalizedImage,
                    target_user_id: userId,
                    created_by: req.user.id
                });
                ids.push(id);
            }
        } else {
            const id = await notificationService.createNotification({
                title: normalizedTitle,
                content: normalizedContent,
                image_url: normalizedImage,
                target_user_id: resolvedTargetId || null,
                created_by: req.user.id
            });
            ids.push(id);
        }

        res.json({ success: true, data: { ids } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/api-keys
router.get('/api-keys', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, name, created_at, revoked_at
             FROM api_keys
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/logs
router.get('/logs', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
        const logs = logService.getLogs(limit);
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/admin/api-keys
router.post('/api-keys', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const crypto = require('crypto');
        const rawKey = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const [result] = await db.execute(
            'INSERT INTO api_keys (name, key_hash, created_by) VALUES (?, ?, ?)',
            [name.trim(), hash, req.user.id]
        );

        res.json({ success: true, data: { id: result.insertId, key: rawKey } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/admin/api-keys/:id
router.delete('/api-keys/:id', async (req, res) => {
    try {
        await db.execute(
            "UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?",
            [req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// SHARE DATA (chiase.json)
// ============================================

const SHARE_CATEGORIES = [
    {
        key: 'products_inactive',
        label: 'Sản phẩm cũ',
        description: 'Sản phẩm inactive/banned hoặc đăng hơn 120 ngày trước'
    },
    {
        key: 'users_inactive',
        label: 'Tài khoản cũ',
        description: 'Tài khoản không hoạt động trên 180 ngày (trừ admin)'
    },
    {
        key: 'posts_old',
        label: 'Bài viết cũ',
        description: 'Bài viết đăng hơn 90 ngày trước'
    }
];

function mergeById(existing = [], incoming = []) {
    const map = new Map();
    existing.forEach(item => {
        if (item && item.id !== undefined && item.id !== null) {
            map.set(String(item.id), item);
        }
    });
    incoming.forEach(item => {
        if (item && item.id !== undefined && item.id !== null) {
            map.set(String(item.id), item);
        }
    });
    return Array.from(map.values());
}

async function exportArchivedProducts() {
    const [products] = await db.execute(
        `SELECT p.*,
                c.name as category_name,
                c.slug as category_slug,
                u.full_name as seller_name,
                u.avatar as seller_avatar,
                u.gender as seller_gender,
                u.email as seller_email
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN users u ON p.seller_id = u.id
         WHERE p.status != 'active'
            OR p.created_at < datetime('now', '-120 days')
         ORDER BY p.created_at DESC`
    );

    const productIds = products.map(p => p.id);
    const imagesMap = {};
    const categoriesMap = {};

    if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(',');
        const [images] = await db.execute(
            `SELECT * FROM product_images WHERE product_id IN (${placeholders})`,
            productIds
        );
        images.forEach(img => {
            if (!imagesMap[img.product_id]) imagesMap[img.product_id] = [];
            imagesMap[img.product_id].push(img);
        });

        const [categories] = await db.execute(
            `SELECT pc.product_id, c.id, c.name, c.slug
             FROM product_categories pc
             JOIN categories c ON c.id = pc.category_id
             WHERE pc.product_id IN (${placeholders})`,
            productIds
        );
        categories.forEach(item => {
            if (!categoriesMap[item.product_id]) categoriesMap[item.product_id] = [];
            categoriesMap[item.product_id].push({
                id: item.id,
                name: item.name,
                slug: item.slug
            });
        });
    }

    return products.map(product => ({
        ...product,
        gallery: imagesMap[product.id] || [],
        categories: categoriesMap[product.id] || (product.category_id ? [{
            id: product.category_id,
            name: product.category_name,
            slug: product.category_slug
        }] : []),
        is_archived: true
    }));
}

async function exportArchivedPosts() {
    const [posts] = await db.execute(
        `SELECT p.*, u.full_name, u.avatar, u.gender
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.created_at < datetime('now', '-90 days')
         ORDER BY p.created_at DESC`
    );

    const postIds = posts.map(p => p.id);
    const mediaMap = {};
    const commentsMap = {};
    const likeCountMap = {};

    if (postIds.length > 0) {
        const placeholders = postIds.map(() => '?').join(',');
        const [media] = await db.execute(
            `SELECT * FROM post_media WHERE post_id IN (${placeholders})`,
            postIds
        );
        media.forEach(item => {
            if (!mediaMap[item.post_id]) mediaMap[item.post_id] = [];
            mediaMap[item.post_id].push(item);
        });

        const [comments] = await db.execute(
            `SELECT c.*, u.full_name, u.avatar, u.gender
             FROM post_comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.post_id IN (${placeholders})
             ORDER BY c.created_at ASC`,
            postIds
        );
        comments.forEach(item => {
            if (!commentsMap[item.post_id]) commentsMap[item.post_id] = [];
            commentsMap[item.post_id].push(item);
        });

        const [likes] = await db.execute(
            `SELECT post_id, COUNT(*) as total
             FROM post_likes
             WHERE post_id IN (${placeholders})
             GROUP BY post_id`,
            postIds
        );
        likes.forEach(item => {
            likeCountMap[item.post_id] = item.total;
        });
    }

    return posts.map(post => ({
        ...post,
        media: mediaMap[post.id] || [],
        comments: commentsMap[post.id] || [],
        like_count: likeCountMap[post.id] || 0,
        comment_count: (commentsMap[post.id] || []).length,
        is_archived: true,
        is_liked: false
    }));
}

async function exportArchivedUsers() {
    const [users] = await db.execute(
        `SELECT id, email, full_name, avatar, gender, bio, contact_info, phone, role, status, created_at, last_login
         FROM users
         WHERE role != 'admin'
           AND (
                (last_login IS NULL AND created_at < datetime('now', '-180 days'))
                OR (last_login < datetime('now', '-180 days'))
                OR status = 'banned'
           )
         ORDER BY COALESCE(last_login, created_at) ASC`
    );
    return users.map(user => ({
        ...user,
        is_archived: true
    }));
}

router.get('/share/categories', async (req, res) => {
    try {
        const [productCount] = await db.execute(
            `SELECT COUNT(*) as total FROM products
             WHERE status != 'active'
                OR created_at < datetime('now', '-120 days')`
        );
        const [postCount] = await db.execute(
            `SELECT COUNT(*) as total FROM posts
             WHERE created_at < datetime('now', '-90 days')`
        );
        const [userCount] = await db.execute(
            `SELECT COUNT(*) as total FROM users
             WHERE role != 'admin'
               AND (
                    (last_login IS NULL AND created_at < datetime('now', '-180 days'))
                    OR (last_login < datetime('now', '-180 days'))
                    OR status = 'banned'
               )`
        );

        const counts = {
            products_inactive: productCount[0]?.total || 0,
            posts_old: postCount[0]?.total || 0,
            users_inactive: userCount[0]?.total || 0
        };

        const categories = SHARE_CATEGORIES.map(item => ({
            ...item,
            count: counts[item.key] || 0
        }));

        res.json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/share/data/:key', async (req, res) => {
    try {
        const key = req.params.key;
        let data = [];

        if (key === 'products_inactive') {
            data = await exportArchivedProducts();
        } else if (key === 'users_inactive') {
            data = await exportArchivedUsers();
        } else if (key === 'posts_old') {
            data = await exportArchivedPosts();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid category' });
        }

        const currentArchive = await getArchive();
        const mergedArchive = {
            meta: {
                ...(currentArchive.meta || {}),
                last_shared_at: new Date().toISOString(),
                last_shared_key: key
            },
            products: Array.isArray(currentArchive.products) ? currentArchive.products : [],
            posts: Array.isArray(currentArchive.posts) ? currentArchive.posts : []
        };

        if (key === 'products_inactive') {
            mergedArchive.products = mergeById(mergedArchive.products, data);
        }
        if (key === 'users_inactive') {
            mergedArchive.users = mergeById(mergedArchive.users, data);
        }
        if (key === 'posts_old') {
            mergedArchive.posts = mergeById(mergedArchive.posts, data);
        }

        res.json({
            success: true,
            data: mergedArchive
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;


