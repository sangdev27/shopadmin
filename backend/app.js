// ============================================
// EXPRESS APP (NO LISTEN)
// File: backend/app.js
// ============================================

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const logService = require('./services/logService');

const app = express();

const DEFAULT_ALLOWED = [
    'http://localhost:3000',
    'http://localhost:4173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4173',
    'https://shopadmin-vert.vercel.app'
];
const envAllowed = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const allowedOrigins = [...DEFAULT_ALLOWED, ...envAllowed];
const vercelRegex = /\.vercel\.app$/;
const renderRegex = /\.onrender\.com$/;

// ANSI colors for pretty logs (no extra deps)
const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};
const colorByStatus = (status) => {
    if (status >= 500) return COLORS.red;
    if (status >= 400) return COLORS.yellow;
    return COLORS.green;
};

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true); // server-to-server or curl
        if (
            allowedOrigins.includes(origin) ||
            vercelRegex.test(origin) ||
            renderRegex.test(origin)
        ) {
            return cb(null, true);
        }
        return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware (color + response time)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        const status = res.statusCode;
        const method = `${COLORS.cyan}${req.method.padEnd(6)}${COLORS.reset}`;
        const line = `${method} ${req.originalUrl} ${colorByStatus(status)}${status}${COLORS.reset} ${COLORS.dim}${ms}ms${COLORS.reset}`;
        console.log(line);
        logService.recordRequest({
            method: req.method,
            path: req.originalUrl,
            status,
            durationMs: ms,
            userId: req.user?.id || null,
            email: req.user?.email || null,
            ip: req.ip || req.headers['x-forwarded-for'] || ''
        });
    });
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
