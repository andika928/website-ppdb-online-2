'use strict';
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { loadEnvFile } = require('node:process');
const envFile = path.join(__dirname, '.env');
if (!process.env.VERCEL && fs.existsSync(envFile)) loadEnvFile(envFile);

function config() {
  const database = process.env.DB_NAME || 'ppdb';
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('DB_NAME hanya boleh berisi huruf, angka, dan garis bawah.');
  return { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database,
    charset: 'utf8mb4', connectionLimit: process.env.VERCEL ? 5 : 10,
    maxIdle: process.env.VERCEL ? 2 : 10, idleTimeout: 5000,
    connectTimeout: 10000, multipleStatements: false,
    ...(process.env.DB_SSL === 'true' ? {ssl:{rejectUnauthorized:true,
      ...(process.env.DB_SSL_CA ? {ca:process.env.DB_SSL_CA.replace(/\\n/g,'\n')} : {})}} : {}) };
}

async function openDatabase(options = config()) {
  const pool = mysql.createPool(options);
  const context = new AsyncLocalStorage();
  let closing;
  const execute = async (sql, args = []) => (await (context.getStore() || pool).execute(sql, args))[0];
  const db = {
    prepare(sql) {
      return {
        get: async (...args) => (await execute(sql, args))[0],
        all: (...args) => execute(sql, args),
        run: async (...args) => { const result = await execute(sql, args); return { changes: result.affectedRows, lastInsertRowid: result.insertId }; }
      };
    },
    async transaction(fn) {
      if (context.getStore()) return fn();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await context.run(connection, fn);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally { connection.release(); }
    },
    async initialize() {
      const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
      for (const sql of schema.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(sql);
    },
    close: () => (closing ||= pool.end())
  };
  try {
    const [limits] = await execute('SELECT @@max_allowed_packet AS bytes');
    if (Number(limits.bytes) < 4194304) throw new Error('max_allowed_packet terlalu kecil. Set max_allowed_packet=16M pada bagian [mysqld] di my.ini XAMPP, lalu restart MySQL.');
  } catch (error) { await pool.end(); throw error; }
  return db;
}
module.exports = { openDatabase, config };
