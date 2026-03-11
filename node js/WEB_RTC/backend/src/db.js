/**
 * Database initialization and access layer using sql.js (pure-JS SQLite).
 * Creates tables for users, rooms, participants, and messages.
 * 
 * sql.js is async for init but we expose a sync-like API wrapper for simplicity.
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'meetclone.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

/**
 * Initialize the database – must be called before any queries.
 * Returns the db wrapper object.
 */
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB file if it exists
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      displayName TEXT NOT NULL DEFAULT '',
      avatarColor TEXT NOT NULL DEFAULT '#4A90D9',
      avatarUrl   TEXT DEFAULT NULL,
      createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'Untitled Room',
      createdBy   TEXT NOT NULL,
      isActive    INTEGER NOT NULL DEFAULT 1,
      createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId    TEXT NOT NULL,
      userId    TEXT NOT NULL,
      joinedAt  TEXT NOT NULL DEFAULT (datetime('now')),
      leftAt    TEXT DEFAULT NULL,
      FOREIGN KEY (roomId) REFERENCES rooms(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId    TEXT NOT NULL,
      userId    TEXT NOT NULL,
      content   TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (roomId) REFERENCES rooms(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(roomId);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(roomId);`);

  // Save to disk periodically
  saveDB();

  console.log('[DB] SQLite database initialized');
  return getDBWrapper();
}

/**
 * Persist DB to disk.
 */
function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 10 seconds
setInterval(() => saveDB(), 10000);

/**
 * DB wrapper with prepare-like API compatible with our routes.
 */
function getDBWrapper() {
  return {
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          saveDB();
        },
        get(...params) {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
      };
    },
  };
}

module.exports = { initDB, getDB: () => getDBWrapper(), saveDB };
