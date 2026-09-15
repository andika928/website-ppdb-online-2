'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { testDatabase } = require('./mysql-helper');
const { migrate } = require('../scripts/migrate-sqlite');

test('MySQL transactions rollback independently across concurrent requests', async () => {
  const fixture = await testDatabase(), db = fixture.db;
  try {
    await db.initialize();
    let inserted;
    const signal = new Promise(resolve => { inserted = resolve; });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const rollback = assert.rejects(db.transaction(async () => {
      await db.prepare('INSERT INTO audit(actor,action,created) VALUES(?,?,?)').run('rollback','must disappear','now');
      inserted(); await gate; throw new Error('rollback fixture');
    }), /rollback fixture/);
    await signal;
    try {
      await db.transaction(async () => {
        await db.prepare('INSERT INTO audit(actor,action,created) VALUES(?,?,?)').run('commit','must remain','now');
      });
    } finally { release(); }
    await rollback;
    assert.deepEqual((await db.prepare('SELECT actor FROM audit').all()).map(r=>r.actor), ['commit']);
  } finally { await fixture.cleanup(); }
});

test('SQLite migration preserves WAL data, hashes, IDs, Unicode and 2 MB documents; refuses repeat', async () => {
  const fixture = await testDatabase();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'ppdb-migrate-'));
  const file = path.join(temp,'ppdb.sqlite');
  const source = new DatabaseSync(file);
  try {
    source.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE admins(id INTEGER PRIMARY KEY,name TEXT,email TEXT,password TEXT,role TEXT,approved INTEGER);
      CREATE TABLE settings(id INTEGER PRIMARY KEY,data TEXT);
      CREATE TABLE applications(id TEXT PRIMARY KEY,nisn TEXT,year TEXT,secret TEXT,data TEXT,status TEXT,note TEXT,created TEXT);
      CREATE TABLE documents(id TEXT PRIMARY KEY,application_id TEXT,kind TEXT,mime TEXT,content BLOB);
      CREATE TABLE audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,created TEXT);`);
    source.prepare('INSERT INTO admins VALUES(?,?,?,?,?,?)').run(17,'Panitia é 🌻','admin@example.test','salt:hash','superadmin',1);
    source.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({year:'2026/2027',published:true}));
    source.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?)').run('PPDB-OLD','0012345678','2026/2027','a'.repeat(64),'{"name":"Siswa 🌻"}','Lulus','','2026-09-01T00:00:00.000Z');
    const document = Buffer.alloc(2097152,42);document.write('%PDF-1.4');
    source.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run('document-old','PPDB-OLD','Rapor','application/pdf',document);
    const report = await migrate(file,fixture.db,path.join(temp,'backups'));
    assert.equal(report.counts.admins,1);assert.equal(report.counts.documents,1);
    assert.ok(fs.existsSync(report.snapshot));
    const row=await fixture.db.prepare('SELECT * FROM documents WHERE id=?').get('document-old');
    assert.deepEqual(row.content,document);
    assert.equal((await fixture.db.prepare('SELECT * FROM admins WHERE id=17').get()).password,'salt:hash');
    assert.equal((await fixture.db.prepare('SELECT published FROM result_publications WHERE year=?').get('2026/2027')).published,1);
    const added=await fixture.db.prepare('INSERT INTO admins(name,email,password) VALUES(?,?,?)').run('Next','next@example.test','hash');
    assert.ok(added.lastInsertRowid>17);
    await assert.rejects(migrate(file,fixture.db,path.join(temp,'backups')),/tidak kosong/);
    assert.equal(source.prepare('SELECT COUNT(*) AS n FROM admins').get().n,1);
  } finally { source.close(); await fixture.cleanup(); fs.rmSync(temp,{recursive:true,force:true}); }
});

test('Failed migration rolls back imported rows without changing the SQLite source',async()=>{
  const fixture=await testDatabase(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ppdb-migrate-fail-'));
  const file=path.join(temp,'ppdb.sqlite'),source=new DatabaseSync(file);
  try{
    source.exec(`CREATE TABLE admins(id INTEGER PRIMARY KEY,name TEXT,email TEXT,password TEXT,role TEXT,approved INTEGER);
      CREATE TABLE settings(id INTEGER PRIMARY KEY,data TEXT);
      CREATE TABLE applications(id TEXT PRIMARY KEY,nisn TEXT,year TEXT,secret TEXT,data TEXT,status TEXT,note TEXT,created TEXT);
      CREATE TABLE documents(id TEXT PRIMARY KEY,application_id TEXT,kind TEXT,mime TEXT,content BLOB);
      CREATE TABLE audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,created TEXT);`);
    source.prepare('INSERT INTO admins VALUES(1,?,?,?,?,?)').run('Admin','one@example.test','hash','superadmin',1);
    source.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run('orphan','missing','Rapor','application/pdf',Buffer.from('%PDF-'));
    await assert.rejects(migrate(file,fixture.db,path.join(temp,'backups')),e=>e.code==='ER_NO_REFERENCED_ROW_2');
    assert.equal((await fixture.db.prepare('SELECT COUNT(*) AS n FROM admins').get()).n,0);
    assert.equal(source.prepare('SELECT COUNT(*) AS n FROM admins').get().n,1);
  }finally{source.close();await fixture.cleanup();fs.rmSync(temp,{recursive:true,force:true});}
});
