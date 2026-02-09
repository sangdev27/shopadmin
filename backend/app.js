// ============================================
// EXPRESS APP (NO LISTEN)
// File: backend/app.js
// ============================================

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: ['https://shopadmin-vert.vercel.app', 'http://localhost:3000'],
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ============================================
// API ROUTES
// ============================================
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/products.routes');
const categoryRoutes = require('./routes/categories.routes');
const userRoutes = require('./routes/users.routes');
const walletRoutes = require('./routes/wallet.routes');
const postRoutes = require('./routes/posts.routes');
const messageRoutes = require('./routes/messages.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/uploads.routes');
const settingsRoutes = require('./routes/settings.routes');
const supportRoutes = require('./routes/support.routes');
const communityRoutes = require('./routes/community.routes');
const notificationRoutes = require('./routes/notifications.routes');
const integrationRoutes = require('./routes/integration.routes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/integration', integrationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

module.exports = app;
