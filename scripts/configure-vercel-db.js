'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { openDatabase } = require('../database');
const { cloudConfig } = require('./cloud-config');
async function main() {
  const root=path.resolve(__dirname,'..');
  const target=cloudConfig(process.argv[2]);
  const project=JSON.parse(fs.readFileSync(path.join(root,'.vercel','project.json'),'utf8'));
  if(project.projectName!=='website-ppdb')throw new Error('Proyek Vercel tidak sesuai.');
  const db=await openDatabase(target.options);
  try {
    const admin=await db.prepare("SELECT COUNT(*) AS n FROM admins WHERE role='superadmin' AND approved=1").get();
    if(!Number(admin.n))throw new Error('Database online belum memiliki superadmin aktif; selesaikan migrasi dahulu.');
    if(!await db.prepare('SELECT data FROM settings WHERE id=1').get())throw new Error('Pengaturan database online belum tersedia.');
  } finally {await db.close();}
  const npm=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
  if(!fs.existsSync(npm))throw new Error('npm CLI tidak ditemukan di lokasi Node.js.');
  for(const [key,value]of Object.entries(target.variables)) {
    // Secrets go through stdin, never argv or console output.
    const result=spawnSync(process.execPath,[npm,'exec','--yes','--package=vercel@59.17.0','--','vercel','env','add',key,'production','--force','--yes','--sensitive','--project',project.projectId,'--scope',project.orgId],{
      cwd:root,input:value,encoding:'utf8',windowsHide:true,timeout:120000,
      env:{...process.env,VERCEL_TELEMETRY_DISABLED:'1'}
    });
    if(result.status!==0)throw new Error('Pemasangan variabel '+key+' gagal; periksa login/hak akses Vercel. Nilai tidak ditampilkan.');
    console.log(key+': tersimpan sebagai secret produksi.');
  }
  console.log('Konfigurasi tersimpan. Redeploy produksi untuk mengaktifkannya.');
}
if(require.main===module)main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
