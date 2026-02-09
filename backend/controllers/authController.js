// ============================================
// AUTH CONTROLLER
// File: backend/controllers/authController.js
// ============================================

const authService = require('../services/authService');

class AuthController {
    // POST /api/auth/register
    async register(req, res) {
        try {
            const { email, password, full_name, gender } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters'
                });
            }

            const result = await authService.register(email, password, full_name, gender);

            res.cookie('token', result.token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: result
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // POST /api/auth/login
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const result = await authService.login(email, password);

            res.cookie('token', result.token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.json({
                success: true,
                message: 'Login successful',
                data: result
            });

        } catch (error) {
            res.status(401).json({
                success: false,
                message: error.message
            });
        }
    }

    // GET /api/auth/me
    async getCurrentUser(req, res) {
        try {
            const user = await authService.getCurrentUser(req.user.id);

            res.json({
                success: true,
                data: user
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // PUT /api/auth/update-profile
    async updateProfile(req, res) {
        try {
            const user = await authService.updateProfile(req.user.id, req.body);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: user
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // PUT /api/auth/change-password
    async changePassword(req, res) {
        try {
            const { old_password, new_password } = req.body;

            if (!old_password || !new_password) {
                return res.status(400).json({
                    success: false,
                    message: 'Old password and new password are required'
                });
            }

            if (new_password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 6 characters'
                });
            }

            await authService.changePassword(req.user.id, old_password, new_password);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // POST /api/auth/logout
    async logout(req, res) {
        res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
        res.json({
            success: true,
            message: 'Logout successful'
        });
    }
}

module.exports = new AuthController();
