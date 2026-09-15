'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { openDatabase, config } = require('../database');
const { cloudConfig } = require('./cloud-config');
const tables = ['admins','settings','applications','documents','audit','result_publications','school_profile','school_posts'];

async function migrateDatabases(source, target, backupDir = path.join(__dirname,'..','data','backups')) {
  // READ ONLY snapshot on one connection protects related rows during extraction.
  const snapshot = await source.transaction(async () => {
    const rows = {};
    for (const table of tables) rows[table] = await source.prepare(`SELECT * FROM \`${table}\``).all();
    return {format:'ppdb-mysql-backup-v1',created:new Date().toISOString(),tables:rows};
  }, {readOnly:true});
  fs.mkdirSync(backupDir,{recursive:true});
  const backupPath = path.join(backupDir,`ppdb-before-cloud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(backupPath,JSON.stringify(snapshot),{flag:'wx',mode:0o600});
  await target.initialize();
  const counts = {};
  await target.transaction(async () => {
    for (const table of [...tables,'sessions']) {
      if (Number((await target.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get()).n)) throw new Error('Database tujuan tidak kosong; migrasi dibatalkan tanpa menimpa data.');
    }
    for (const table of tables) {
      for (const row of snapshot.tables[table]) {
        const columns = Object.keys(row);
        if (columns.some(c=>!/^[a-z_]+$/.test(c))) throw new Error('Kolom sumber tidak didukung.');
        const key = table==='result_publications'?'year':'id';
        await target.prepare(`INSERT INTO \`${table}\` (${columns.map(c=>'`'+c+'`').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(c=>row[c]));
        const saved = await target.prepare(`SELECT * FROM \`${table}\` WHERE \`${key}\`=?`).get(row[key]);
        // Checks BLOB bytes, leading-zero NISN, Unicode, IDs and hash strings.
        try { for (const column of columns) assert.deepEqual(saved[column],row[column]); }
        catch { throw new Error('Verifikasi nilai gagal pada tabel '+table+'; transaksi dibatalkan.'); }
      }
      counts[table] = snapshot.tables[table].length;
      if (Number((await target.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).get()).n)!==counts[table]) throw new Error('Jumlah baris berbeda pada '+table);
    }
  });
  return {backupPath,counts,sessions:'Sesi lama tidak dipindahkan. Login ulang diperlukan.'};
}
async function main() {
  const local = config(), online = cloudConfig(process.argv[2]).options;
  if(local.host===online.host && Number(local.port)===online.port && local.database===online.database) throw new Error('Sumber dan tujuan sama.');
  const source=await openDatabase(local);
  let target;
  try {
    target=await openDatabase(online);
    console.log(JSON.stringify(await migrateDatabases(source,target),null,2));
  } finally {await source.close();if(target)await target.close();}
}
if(require.main===module)main().catch(e=>{console.error('Migrasi online gagal:',e.code||e.message);process.exitCode=1;});
module.exports={migrateDatabases};
