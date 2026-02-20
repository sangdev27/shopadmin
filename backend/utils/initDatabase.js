// ============================================
// DATABASE INITIALIZER
// Reads database.sql and bootstrap schema when missing
// ============================================

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

function splitStatements(sql) {
    const statements = [];
    const buffer = [];

    sql.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('--')) return;
        buffer.push(line);
        if (trimmed.endsWith(';')) {
            statements.push(buffer.join('\n'));
            buffer.length = 0;
        }
    });

    return statements
        .map(s => s.trim())
        .filter(Boolean);
}

async function ensureDatabase() {
    // If the users table exists we assume the schema is already created.
    const [tables] = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    );
    if (tables.length > 0) {
        return { created: false };
    }

    const schemaPath = path.join(__dirname, '../../database.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = splitStatements(sql);

    let executed = 0;
    for (const statement of statements) {
        // Prevent duplicate seed rows when this runs more than once.
        const safeStmt = statement.replace(/^INSERT\s+INTO\s+/i, 'INSERT OR IGNORE INTO ');
        await db.execute(safeStmt);
        executed += 1;
    }

    return { created: true, statements: executed };
}

async function ensureUserFrameColumn() {
    const [columns] = await db.execute("PRAGMA table_info('users')");
    const hasFrame = columns.some(col => col.name === 'frame_url');
    if (!hasFrame) {
        await db.execute("ALTER TABLE users ADD COLUMN frame_url TEXT");
    }
    const hasCover = columns.some(col => col.name === 'cover_image');
    if (!hasCover) {
        await db.execute("ALTER TABLE users ADD COLUMN cover_image TEXT");
    }
}

module.exports = { ensureDatabase, ensureUserFrameColumn };
