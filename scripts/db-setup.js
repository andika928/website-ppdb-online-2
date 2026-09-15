'use strict';
const mysql = require('mysql2/promise');
const { config, openDatabase } = require('../database');
async function setup() {
  const options = config();
  const connection = await mysql.createConnection({ ...options, database: undefined });
  try { await connection.query(`CREATE DATABASE IF NOT EXISTS \`${options.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`); }
  finally { await connection.end(); }
  const db = await openDatabase();
  try { await db.initialize(); console.log('Database dan tabel MySQL siap. Migrasikan SQLite sebelum menjalankan server jika ada data lama.'); }
  finally { await db.close(); }
}
if (require.main === module) setup().catch(e => { console.error('Setup gagal:', e.code || e.message); process.exitCode = 1; });
module.exports = { setup };
