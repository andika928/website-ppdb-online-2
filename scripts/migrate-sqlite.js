'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');
const { openDatabase } = require('../database');
// Parent tables precede foreign-key dependants. Names are fixed, never user SQL.
const tables = ['admins','settings','applications','documents','audit','result_publications','school_profile','school_posts'];
async function migrate(sourcePath, db, backupDir = path.join(__dirname, '..', 'data', 'backups')) {
  if (!fs.existsSync(sourcePath) || path.extname(sourcePath) !== '.sqlite') throw new Error('Pilih file utama .sqlite yang ada, bukan -shm atau -wal.');
  await db.initialize();
  // Refuse even default seed rows: migration must precede the first app startup.
  for (const table of [...tables, 'sessions']) {
    if ((await db.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get()).n) throw new Error('Database tujuan tidak kosong. Gunakan database baru; data tidak ditimpa.');
  }
  fs.mkdirSync(backupDir, { recursive: true });
  const snapshot = path.join(backupDir, `ppdb-before-mysql-${Date.now()}-${require('node:crypto').randomBytes(4).toString('hex')}.sqlite`);
  const original = new DatabaseSync(sourcePath, { readOnly: true });
  try { await backup(original, snapshot); } finally { original.close(); }
  const source = new DatabaseSync(snapshot, { readOnly: true });
  const report = {};
  try {
    const present = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    for (const table of ['admins','settings','applications','documents','audit']) if (!present.has(table)) throw new Error('Sumber bukan database PPDB lengkap: tabel '+table+' tidak ditemukan.');
    await db.transaction(async () => {
      for (const table of tables) {
        report[table] = 0;
        if (!present.has(table)) continue;
        for (const row of source.prepare(`SELECT * FROM "${table}"`).iterate()) {
          const columns = Object.keys(row);
          if (columns.some(c => !/^[a-z_]+$/.test(c))) throw new Error('Nama kolom sumber tidak didukung.');
          const args = columns.map(c => row[c] instanceof Uint8Array ? Buffer.from(row[c]) : row[c]);
          await db.prepare(`INSERT INTO \`${table}\` (${columns.map(c=>'`'+c+'`').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...args);
          // Verify every field, including binary documents and secret hashes, before commit.
          const key = table === 'result_publications' ? 'year' : 'id';
          const saved = await db.prepare(`SELECT * FROM \`${table}\` WHERE \`${key}\`=?`).get(row[key]);
          for (const c of columns) {
            const same = row[c] instanceof Uint8Array ? Buffer.from(row[c]).equals(saved[c]) : row[c] === saved[c];
            if (!same) throw new Error('Verifikasi data gagal pada '+table+'.'+c);
          }
          report[table]++;
        }
        if ((await db.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get()).n !== report[table]) throw new Error('Jumlah baris berbeda: '+table);
      }
      if (!present.has('result_publications')) {
        const settings = source.prepare('SELECT data FROM settings WHERE id=1').get();
        if (settings) {
          const current = JSON.parse(settings.data);
          const years = new Set([current.year, ...source.prepare('SELECT DISTINCT year FROM applications').all().map(r => r.year)]);
          for (const year of years) await db.prepare('INSERT INTO result_publications VALUES(?,?)').run(year, current.published ? 1 : 0);
          report.result_publications = years.size;
        }
      }
    });
    return { snapshot, counts: report, sessions: 'Sesi lama tidak dipindah; login kembali.' };
  } finally { source.close(); }
}
async function main() {
  const db = await openDatabase();
  try { console.log(JSON.stringify(await migrate(path.resolve(process.argv[2] || path.join(__dirname,'..','data','ppdb.sqlite')), db), null, 2)); }
  finally { await db.close(); }
}
if (require.main === module) main().catch(e => { console.error('Migrasi gagal:', e.code || e.message); process.exitCode = 1; });
module.exports = { migrate };
