'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build,files}=require('../scripts/build-vercel');
const handler=require('../api/index');
test('Vercel build publishes only allowlisted frontend files and school images',()=>{
  build();
  const root=path.join(__dirname,'..','public');
  for(const file of files)assert.ok(fs.existsSync(path.join(root,file)));
  for(const file of ['.env','server.js','database.js','data','package.json','scripts'])assert.equal(fs.existsSync(path.join(root,file)),false);
  assert.ok(fs.existsSync(path.join(root,'assets','school','logo.jpg')));
});
test('Vercel rejects database operations when hosted MySQL is missing and preserves API routing',async()=>{
  const previous=process.env.DB_HOST;
  delete process.env.DB_HOST;
  try{
    const req={url:'/api/index?__path=applications',method:'POST'};
    const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(body){this.body=JSON.parse(body);}};
    await handler(req,response);
    assert.equal(req.url,'/api/applications');
    assert.equal(response.status,503);
    assert.equal(response.body.code,'DATABASE_NOT_CONFIGURED');
    assert.equal(response.headers['Cache-Control'],'no-store');
    assert.equal(response.body.secret,undefined);
  }finally{if(previous===undefined)delete process.env.DB_HOST;else process.env.DB_HOST=previous;}
});
