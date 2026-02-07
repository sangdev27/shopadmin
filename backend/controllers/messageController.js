// ============================================
// MESSAGE CONTROLLER
// File: backend/controllers/messageController.js
// ============================================

const messageService = require('../services/messageService');

class MessageController {
    // GET /api/messages/conversations
    async getConversations(req, res) {
        try {
            const data = await messageService.getConversations(req.user.id);
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // GET /api/messages/:userId
    async getMessages(req, res) {
        try {
            const data = await messageService.getMessages(
                req.user.id,
                req.params.userId,
                req.query
            );
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // POST /api/messages
    async sendMessage(req, res) {
        try {
            const data = await messageService.sendMessage(req.user.id, req.body);
            res.status(201).json({ success: true, message: 'Message sent', data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

module.exports = new MessageController();
