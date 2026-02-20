// ============================================
// NOTIFICATION SERVICE
// File: backend/services/notificationService.js
// ============================================

const db = require('../config/database');
const { sendTelegramNotification } = require('./telegramBackupService');

class NotificationService {
    async createNotification({ title, content = '', image_url = null, target_user_id = null, created_by = null }) {
        const [result] = await db.execute(
            `INSERT INTO notifications (title, content, image_url, target_user_id, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [title, content || null, image_url || null, target_user_id || null, created_by || null]
        );
        const targetText = target_user_id ? `User ID: ${target_user_id}` : 'Tất cả user';
        const imageText = image_url ? `Ảnh: ${image_url}` : '';
        const message = `🔔 THÔNG BÁO\n${title}\n${content || ''}\n${imageText}\n${targetText}`.trim();
        await sendTelegramNotification(message);
        return result.insertId;
    }
}

module.exports = new NotificationService();
