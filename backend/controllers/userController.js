// ============================================
// USER CONTROLLER
// File: backend/controllers/userController.js
// ============================================

const userService = require('../services/userService');

class UserController {
    // GET /api/users/search
    async searchUsers(req, res) {
        try {
            const result = await userService.searchUsers(req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // GET /api/users/:id
    async getProfile(req, res) {
        try {
            const user = await userService.getProfile(req.params.id);
            res.json({ success: true, data: user });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    }
}

module.exports = new UserController();
