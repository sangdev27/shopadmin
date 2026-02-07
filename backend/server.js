// ============================================
// SERVER ENTRY POINT
// File: backend/server.js
// ============================================

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = require('./app');
const db = require('./config/database');
const { initTelegramBot } = require('./services/telegramBackupService');

// Serve static files (local dev)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// SERVE INDEX.HTML FOR ALL ROUTES (SPA)
// ============================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ============================================
// CREATE DEFAULT ADMIN ACCOUNT
// ============================================
async function createDefaultAdmin() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'nguyenhongsang0207@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

        // Check if admin exists
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE email = ?',
            [adminEmail]
        );

        if (existing.length === 0) {
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            
            await db.execute(
                'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
                [adminEmail, passwordHash, 'System Admin', 'admin']
            );

            console.log('✅ Default admin account created');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Password: ${adminPassword}`);
        } else {
            console.log('ℹ️  Admin account already exists');
        }
    } catch (error) {
        console.error('❌ Error creating admin account:', error.message);
    }
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('🚀 SOURCE MARKET SERVER');
    console.log('═══════════════════════════════════════════');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🌐 API: http://localhost:${PORT}/api`);
    console.log('═══════════════════════════════════════════');
    console.log('');

    // Create admin account
    await createDefaultAdmin();
    initTelegramBot();
});
