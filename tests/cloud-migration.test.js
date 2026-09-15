'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {testDatabase}=require('./mysql-helper');
const {migrateDatabases}=require('../scripts/migrate-mysql-online');
const {cloudConfig}=require('../scripts/cloud-config');

test('MySQL to MySQL migration preserves data and hashes, excludes sessions and refuses a populated destination',async()=>{
  const source=await testDatabase(),target=await testDatabase(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ppdb-cloud-'));
  try{
    await source.db.initialize();
    await source.db.prepare('INSERT INTO admins(id,name,email,password,role,approved) VALUES(?,?,?,?,?,?)').run(12,'Admin 🌻','admin@example.test','salt:hash','superadmin',1);
    await source.db.prepare('INSERT INTO settings VALUES(1,?)').run('{"year":"2026/2027"}');
    await source.db.prepare('INSERT INTO applications(id,nisn,year,secret,data,created) VALUES(?,?,?,?,?,?)').run('OLD-1','0012345678','2026/2027','a'.repeat(64),'{"name":"Siswa é"}','2026-01-01');
    const bytes=Buffer.alloc(2097152,15);bytes.write('%PDF-1.4');
    await source.db.prepare('INSERT INTO documents VALUES(?,?,?,?,?)').run('doc-1','OLD-1','Rapor','application/pdf',bytes);
    await source.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('b'.repeat(64),12,'c'.repeat(48),Date.now()+3600000);
    const result=await migrateDatabases(source.db,target.db,temp);
    assert.equal(result.counts.admins,1);
    assert.ok(fs.existsSync(result.backupPath));
    assert.equal((await target.db.prepare('SELECT password FROM admins WHERE id=12').get()).password,'salt:hash');
    assert.deepEqual((await target.db.prepare('SELECT content FROM documents WHERE id=?').get('doc-1')).content,bytes);
    assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).n,0);
    await assert.rejects(migrateDatabases(source.db,target.db,temp),/tidak kosong/);
    assert.equal((await source.db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).n,1);
    await assert.rejects(source.db.transaction(async()=>{await source.db.prepare('DELETE FROM admins WHERE id=999').run();},{readOnly:true}),e=>e.code==='ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION');
  }finally{await source.cleanup();await target.cleanup();fs.rmSync(temp,{recursive:true,force:true});}
});

test('Cloud configuration rejects missing credentials, local destinations and disabled TLS',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ppdb-cloud-config-')),file=path.join(temp,'cloud.env');
  try{
    fs.writeFileSync(file,'DB_HOST=');assert.throws(()=>cloudConfig(file),/belum lengkap/);
    const fixture='DB_HOST=db.example.test\nDB_PORT=12345\nDB_NAME=defaultdb\nDB_USER=test\nDB_PASSWORD=test\nDB_SSL=true\n';
    fs.writeFileSync(file,fixture.replace('db.example.test','localhost'));assert.throws(()=>cloudConfig(file),/localhost/);
    fs.writeFileSync(file,fixture.replace('DB_SSL=true','DB_SSL=false'));assert.throws(()=>cloudConfig(file),/TLS/);
    fs.writeFileSync(file,fixture);assert.equal(cloudConfig(file).options.ssl.rejectUnauthorized,true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
