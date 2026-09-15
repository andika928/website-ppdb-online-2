'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { X509Certificate } = require('node:crypto');
function cloudConfig(file = path.join(__dirname,'..','data','cloud-mysql.env')) {
  const env = parseEnv(fs.readFileSync(file,'utf8'));
  for (const key of ['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD']) {
    if (!env[key]?.trim()) throw new Error('Konfigurasi online belum lengkap: '+key);
  }
  if (!/^[a-zA-Z0-9_]+$/.test(env.DB_NAME)) throw new Error('Nama database online tidak valid.');
  if (['localhost','127.0.0.1','::1'].includes(env.DB_HOST)) throw new Error('Tujuan harus MySQL online, bukan localhost.');
  const port = Number(env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port database tidak valid.');
  if (env.DB_SSL !== 'true') throw new Error('Koneksi online wajib memakai TLS: DB_SSL=true.');
  const ca = env.DB_SSL_CA_FILE ? fs.readFileSync(path.resolve(path.dirname(file),env.DB_SSL_CA_FILE),'utf8') : env.DB_SSL_CA?.replace(/\\n/g,'\n');
  if (ca) new X509Certificate(ca);
  return {
    options: {host:env.DB_HOST,port,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME,
      charset:'utf8mb4',connectionLimit:5,multipleStatements:false,connectTimeout:15000,
      ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}},
    variables: {DB_HOST:env.DB_HOST,DB_PORT:String(port),DB_NAME:env.DB_NAME,DB_USER:env.DB_USER,
      DB_PASSWORD:env.DB_PASSWORD,DB_SSL:'true',DB_SSL_CA:ca||'',NODE_ENV:'production',
      APP_ORIGIN:'https://website-ppdb-ruddy.vercel.app'}
  };
}
module.exports = { cloudConfig };
