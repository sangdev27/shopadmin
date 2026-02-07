// ============================================
// BASIC ROUTES PLACEHOLDERS
// Các file này sẽ được mở rộng theo nhu cầu
// ============================================

// File: backend/routes/users.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/search', userController.searchUsers.bind(userController));
router.get('/:id', userController.getProfile.bind(userController));

module.exports = router;
