const {test}=require('node:test');
const assert=require('node:assert/strict');
const {request}=require('../api-client');
test('JSON client handles empty, malformed, HTML, interrupted and HTTP responses',async t=>{
 const original=global.fetch;t.after(()=>{global.fetch=original;});
 const cases=[
  {body:'',status:200,type:'application/json',code:'EMPTY_RESPONSE'},
  {body:'   ',status:200,type:'application/json',code:'EMPTY_RESPONSE'},
  {body:null,status:204,type:'application/json',code:'EMPTY_RESPONSE'},
  {body:'{"name":',status:200,type:'application/json',code:'INVALID_JSON'},
  {body:'null',status:200,type:'application/json',code:'INVALID_JSON'},
  {body:'"ok"',status:200,type:'application/json',code:'INVALID_JSON'},
  {body:'<html>Static server</html>',status:200,type:'text/html',code:'INVALID_CONTENT_TYPE'},
  {body:'',status:401,type:'application/json',code:'HTTP_ERROR'},
  {body:'<h1>Bad gateway</h1>',status:502,type:'text/html',code:'HTTP_ERROR'},
  {body:'{',status:403,type:'application/json',code:'HTTP_ERROR'}
 ];
 for(const item of cases){global.fetch=async()=>new Response(item.body,{status:item.status,headers:{'Content-Type':item.type}});await assert.rejects(()=>request('/api/test'),e=>e.code===item.code&&e.status===item.status&&!e.message.includes('Unexpected'));}
 global.fetch=async()=>new Response('{"error":"NISN sudah terdaftar."}',{status:409,headers:{'Content-Type':'application/json'}});
 await assert.rejects(()=>request('/api/test'),e=>e.status===409&&e.message==='NISN sudah terdaftar.');
 for(const payload of ['{}','[]','{"ok":true}']){global.fetch=async()=>new Response(payload,{headers:{'Content-Type':'application/json; charset=utf-8'}});assert.deepEqual(await request('/api/test'),JSON.parse(payload));}
 let calls=0;global.fetch=async()=>{calls++;throw new TypeError('Failed to fetch');};
 await assert.rejects(()=>request('/api/test',{method:'POST'}),e=>e.code==='NETWORK_ERROR');assert.equal(calls,1,'Mutations must not be retried automatically');
 global.fetch=async()=>({status:200,ok:true,text:async()=>{throw new TypeError('terminated');}});
 await assert.rejects(()=>request('/api/test'),e=>e.code==='NETWORK_ERROR');
});

test('Wrong local server redirects before credentials are submitted',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');const calls=[];let redirected;
 const context=vm.createContext({AbortController,setTimeout,clearTimeout,location:{protocol:'http:',origin:'http://127.0.0.1:5500',hostname:'127.0.0.1',pathname:'/admin.html',hash:'',replace:url=>{redirected=url;}},fetch:async(url,options)=>{calls.push({url,options});return url.startsWith('http://127.0.0.1:3000')?new Response('{"service":"st-yoseph-ppdb","version":1}',{headers:{'Content-Type':'application/json'}}):new Response('',{status:405});}});
 vm.runInContext(fs.readFileSync(require.resolve('../api-client'),'utf8'),context);
 await assert.rejects(()=>context.PPDBClient.request('/api/admin/login',{method:'POST',body:'sensitive-test-data'}),e=>e.code==='BACKEND_REDIRECT');
 assert.equal(redirected,'http://127.0.0.1:3000/admin');assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.options.body));
});
test('Valid backend is checked once and receives original request',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');const calls=[];
 const context=vm.createContext({AbortController,setTimeout,clearTimeout,location:{protocol:'http:',origin:'http://127.0.0.1:3000',hostname:'127.0.0.1',pathname:'/admin',hash:''},fetch:async(url,options)=>{calls.push({url,options});return new Response(url.endsWith('/api/health')?'{"service":"st-yoseph-ppdb","version":1}':'{"ok":true}',{headers:{'Content-Type':'application/json'}});}});
 vm.runInContext(fs.readFileSync(require.resolve('../api-client'),'utf8'),context);
 await context.PPDBClient.request('/api/admin/login',{method:'POST',body:'test'});await context.PPDBClient.request('/api/settings');
 assert.equal(calls.filter(c=>c.url.endsWith('/api/health')).length,1);assert.equal(calls[1].options.body,'test');
});
