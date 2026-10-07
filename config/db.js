// IND Homes Database Connector
// Supports Supabase (PostgreSQL) via DATABASE_URL / SUPABASE_DATABASE_URL
// with automatic fallback to local SQLite for offline/development.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const connectionUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

let db;

if (connectionUrl) {
  console.log('Connecting to Supabase (PostgreSQL)...');
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: connectionUrl,
    ssl: connectionUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  // Apply Supabase schema on startup
  const supabaseSchemaPath = path.join(__dirname, '..', 'supabase_schema.sql');
  if (fs.existsSync(supabaseSchemaPath)) {
    const schema = fs.readFileSync(supabaseSchemaPath, 'utf8');
    pool.query(schema).then(() => {
      console.log('Supabase schema verified successfully.');
    }).catch((err) => {
      console.warn('Supabase schema setup warning:', err.message);
    });
  }

  function toPgSql(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  function flattenArgs(args) {
    if (args.length === 1 && Array.isArray(args[0])) {
      return args[0];
    }
    return args;
  }

  db = {
    isPostgres: true,
    pool,
    async exec(sql) {
      return await pool.query(sql);
    },
    prepare(sql) {
      const pgSql = toPgSql(sql);
      return {
        async get(...args) {
          const params = flattenArgs(args);
          const res = await pool.query(pgSql, params);
          return res.rows[0] || null;
        },
        async all(...args) {
          const params = flattenArgs(args);
          const res = await pool.query(pgSql, params);
          return res.rows;
        },
        async run(...args) {
          const params = flattenArgs(args);
          let query = pgSql;
          const isInsert = /^\s*INSERT\s+INTO/i.test(query);
          if (isInsert && !/RETURNING\s+/i.test(query)) {
            query += ' RETURNING id';
          }
          const res = await pool.query(query, params);
          return {
            lastInsertRowid: res.rows[0]?.id || null,
            changes: res.rowCount || 0
          };
        }
      };
    }
  };
} else {
  // SQLite Local Fallback
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = path.join(__dirname, '..', 'data', 'indhomes.db');
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  sqlite.exec(schema);

  db = {
    isPostgres: false,
    sqlite,
    async exec(sql) {
      return sqlite.exec(sql);
    },
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        async get(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          return stmt.get(...params) || null;
        },
        async all(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          return stmt.all(...params);
        },
        async run(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          const res = stmt.run(...params);
          return {
            lastInsertRowid: res.lastInsertRowid,
            changes: res.changes
          };
        }
      };
    }
  };
}

module.exports = db;

