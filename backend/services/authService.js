// ============================================
// AUTHENTICATION SERVICE
// File: backend/services/authService.js
// ============================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
    // Đăng ký user mới
    async register(email, password, fullName, gender) {
        try {
            // Kiểm tra email đã tồn tại
            const [existing] = await db.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existing.length > 0) {
                throw new Error('Email already exists');
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            // Tạo user mới
            const safeGender = ['male', 'female', 'other'].includes(gender) ? gender : 'male';

            const [result] = await db.execute(
                'INSERT INTO users (email, password_hash, full_name, gender) VALUES (?, ?, ?, ?)',
                [email, passwordHash, fullName, safeGender]
            );

            const userId = result.insertId;

            // Generate JWT token
            const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            // Get user info
            const [users] = await db.execute(
                'SELECT id, email, full_name, avatar, gender, bio, contact_info, role, balance, created_at FROM users WHERE id = ?',
                [userId]
            );

            return {
                token,
                user: users[0]
            };

        } catch (error) {
            throw error;
        }
    }

    // Đăng nhập
    async login(email, password) {
        try {
            // Tìm user
            const [users] = await db.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                throw new Error('Invalid email or password');
            }

            const user = users[0];

            // Kiểm tra status
            if (user.status === 'banned') {
                throw new Error('Account has been banned');
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.password_hash);

            if (!isValid) {
                throw new Error('Invalid email or password');
            }

            // Update last login
            await db.execute(
                "UPDATE users SET last_login = datetime('now') WHERE id = ?",
                [user.id]
            );

            // Generate token
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            // Return user without password
            delete user.password_hash;

            return {
                token,
                user
            };

        } catch (error) {
            throw error;
        }
    }

    // Lấy thông tin user hiện tại
    async getCurrentUser(userId) {
        try {
            const [users] = await db.execute(
                'SELECT id, email, full_name, avatar, gender, bio, contact_info, phone, role, balance, status, created_at, last_login FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            return users[0];

        } catch (error) {
            throw error;
        }
    }

    // Cập nhật profile
    async updateProfile(userId, data) {
        try {
            const updates = [];
            const values = [];

            if (data.full_name !== undefined) {
                updates.push('full_name = ?');
                values.push(data.full_name);
            }

            if (data.phone !== undefined) {
                updates.push('phone = ?');
                values.push(data.phone);
            }

            if (data.avatar !== undefined) {
                updates.push('avatar = ?');
                values.push(data.avatar);
            }

            if (data.gender !== undefined) {
                updates.push('gender = ?');
                values.push(data.gender);
            }

            if (data.bio !== undefined) {
                updates.push('bio = ?');
                values.push(data.bio);
            }

            if (data.contact_info !== undefined) {
                updates.push('contact_info = ?');
                values.push(data.contact_info);
            }

            if (updates.length === 0) {
                throw new Error('No data to update');
            }

            values.push(userId);

            await db.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            return await this.getCurrentUser(userId);

        } catch (error) {
            throw error;
        }
    }

    // Đổi mật khẩu
    async changePassword(userId, oldPassword, newPassword) {
        try {
            // Lấy user
            const [users] = await db.execute(
                'SELECT password_hash FROM users WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            // Verify old password
            const isValid = await bcrypt.compare(oldPassword, users[0].password_hash);

            if (!isValid) {
                throw new Error('Old password is incorrect');
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

            // Update password
            await db.execute(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [newPasswordHash, userId]
            );

            return true;

        } catch (error) {
            throw error;
        }
    }
}

module.exports = new AuthService();
