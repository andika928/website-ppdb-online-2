'use strict';
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { config, openDatabase } = require('../database');
async function testDatabase() {
  const options = config();
  const name = 'ppdb_test_' + crypto.randomBytes(10).toString('hex');
  const admin = await mysql.createConnection({ ...options, database: undefined });
  try { await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`); }
  catch (e) { await admin.end(); throw e; }
  const db = await openDatabase({ ...options, database: name });
  return { db, async cleanup() {
    await db.close();
    // Only this invocation's randomly generated database can be removed.
    if (!/^ppdb_test_[a-f0-9]{20}$/.test(name)) throw new Error('Unsafe test database');
    try { await admin.query(`DROP DATABASE \`${name}\``); } finally { await admin.end(); }
  }};
}
module.exports = { testDatabase };
