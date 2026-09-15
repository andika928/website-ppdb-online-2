'use strict';
const { openDatabase } = require('../database');
const { createApp } = require('../server');
let application;
function configured() {
  return Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)
    && !['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST);
}
async function getApp() {
  if (!application) application = (async () => {
    const db = await openDatabase();
    try { return await createApp(db); } catch (error) { await db.close(); throw error; }
  })().catch(error => { application = undefined; throw error; });
  return application;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  const url = new URL(req.url,'https://ppdb.invalid');
  const route = url.searchParams.get('__path');
  if (route !== null) {
    url.searchParams.delete('__path');
    req.url = '/api/' + route + url.search;
  }
  if (!configured()) {
    res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Retry-After':'300'});
    return res.end(JSON.stringify({error:'Layanan pendaftaran online belum diaktifkan. Silakan hubungi panitia sekolah.',code:'DATABASE_NOT_CONFIGURED'}));
  }
  try {
    const app = await getApp();
    // Call the existing Node request listener without binding a server port.
    await app.server.listeners('request')[0](req,res);
  } catch (error) {
    console.error('PPDB initialization failed:',error.code || 'DATABASE_CONNECTION_ERROR');
    if (!res.headersSent) res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});
    res.end(JSON.stringify({error:'Layanan sementara tidak tersedia. Silakan coba lagi nanti.'}));
  }
};
