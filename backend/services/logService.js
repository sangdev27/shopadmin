// ============================================
// In-memory log buffer for admin view
// ============================================

const MAX_LOGS = 500;
const buffer = [];

function push(entry) {
    buffer.push(entry);
    if (buffer.length > MAX_LOGS) {
        buffer.shift();
    }
}

function recordRequest({ method, path, status, durationMs, userId = null, email = null, ip = '' }) {
    push({
        type: 'request',
        ts: new Date().toISOString(),
        method,
        path,
        status,
        durationMs,
        userId,
        email,
        ip
    });
}

function recordLogin({ email, userId = null, success = true, ip = '' }) {
    push({
        type: 'login',
        ts: new Date().toISOString(),
        email,
        userId,
        success,
        ip
    });
}

function getLogs(limit = 200) {
    const n = Math.min(limit, buffer.length);
    return buffer.slice(buffer.length - n);
}

module.exports = {
    recordRequest,
    recordLogin,
    getLogs
};
