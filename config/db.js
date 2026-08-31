// Uses Node's built-in node:sqlite module instead of the native better-sqlite3
// package. This avoids needing a C++ compiler / Visual Studio Build Tools on
// Windows - node:sqlite ships with Node.js itself (v22.5+, stable by v24) and
// needs no separate native build step.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'indhomes.db');

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Apply schema on every boot (idempotent - uses CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
