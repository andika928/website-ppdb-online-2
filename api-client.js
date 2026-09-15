'use strict';
(function(root){
  class APIError extends Error {
    constructor(message,status=0,code='API_ERROR'){super(message);this.name='APIError';this.status=status;this.code=code;}
  }
  function fallback(status){
    if(status===400)return 'Data permintaan tidak dapat dibaca server. Muat ulang halaman dan periksa isian formulir.';
    if(status===405)return 'Server pada alamat ini tidak menerima formulir PPDB. Buka aplikasi melalui server PPDB, bukan Live Server.';
    if(status===415)return 'Server menolak format data permintaan. Muat ulang halaman untuk menggunakan formulir terbaru.';
    if(status===422)return 'Ada isian yang tidak valid. Periksa formulir sebelum mengirim kembali.';
    if(status===401)return 'Sesi admin berakhir atau belum login. Silakan masuk kembali.';
    if(status===403)return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
    if(status===404)return 'Layanan tidak ditemukan. Pastikan aplikasi dibuka melalui server PPDB yang benar.';
    if(status===413)return 'Berkas terlalu besar. Gunakan berkas maksimal 2 MB.';
    if(status===429)return 'Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.';
    if(status>=500)return 'Server sedang mengalami gangguan. Silakan coba kembali nanti.';
    return `Server menolak permintaan (HTTP ${status}). Periksa alamat halaman dan muat ulang aplikasi.`;
  }
  let backendCheck;
  async function probe(origin){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch(origin+'/api/health',{credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok)return false;
      const data=JSON.parse(await response.text());
      return data?.service==='st-yoseph-ppdb'&&data.version===1;
    }catch{return false;}finally{clearTimeout(timer);}
  }
  async function ensureBackend(){
    if(!root.location)return;
    if(!backendCheck)backendCheck=(async()=>{
      if(root.location.protocol!=='file:'&&await probe(root.location.origin))return;
      const local=['localhost','127.0.0.1','[::1]'].includes(root.location.hostname)||root.location.protocol==='file:';
      const canonical='http://127.0.0.1:3000';
      if(local&&root.location.origin!==canonical&&await probe(canonical)){
        const filename=root.location.pathname.split('/').pop();
        const routes={'admin.html':'/admin',admin:'/admin','ppdb.html':'/ppdb',ppdb:'/ppdb','publication.html':'/publikasi',publikasi:'/publikasi'};
        // Navigate before sending form data; never forward a password to a static server.
        root.location.replace(canonical+(routes[filename]||'/')+root.location.hash);
        throw new APIError('Mengalihkan ke server PPDB yang aktif. Silakan login kembali di halaman tujuan.',0,'BACKEND_REDIRECT');
      }
      throw new APIError(local?'Server PPDB belum terhubung. Jalankan node server.js, lalu buka http://127.0.0.1:3000/admin.':'Alamat ini belum terhubung ke backend PPDB. Pengelola perlu mengarahkan /api ke server aplikasi.',0,'BACKEND_UNAVAILABLE');
    })().catch(error=>{backendCheck=null;throw error;});
    return backendCheck;
  }
  async function request(url,options={}){
    await ensureBackend();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    let response;
    try{
      response=await fetch(url,{...options,headers:{Accept:'application/json',...options.headers},credentials:'same-origin',cache:'no-store',signal:controller.signal});
      const raw=await response.text();
      const text=raw.replace(/^\uFEFF/,'').trim();
      const contentType=response.headers.get('content-type')||'';
      let value;
      if(text && /\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType)){
        try{value=JSON.parse(text);}catch{/* Converted to a recoverable protocol error below. */}
      }
      if(!response.ok){
        const detail=value&&typeof value.error==='string'?value.error:fallback(response.status);
        const error=new APIError(detail,response.status,'HTTP_ERROR');
        error.endpoint=String(url).split('?')[0];
        throw error;
      }
      if(!text)throw new APIError('Server mengirim respons kosong. Muat ulang data untuk memeriksa apakah tindakan sudah tersimpan.',response.status,'EMPTY_RESPONSE');
      if(!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType))throw new APIError('Respons server bukan JSON. Pastikan Anda membuka aplikasi melalui server PPDB, bukan Live Server atau file HTML langsung.',response.status,'INVALID_CONTENT_TYPE');
      if(value===undefined||value===null||typeof value!=='object')throw new APIError('Respons server tidak lengkap atau tidak valid. Muat ulang data sebelum mengulangi tindakan.',response.status,'INVALID_JSON');
      return value;
    }catch(error){
      if(error instanceof APIError)throw error;
      if(controller.signal.aborted)throw new APIError('Server terlalu lama merespons. Periksa koneksi dan muat ulang data sebelum mencoba kembali.',response?.status||0,'TIMEOUT');
      throw new APIError('Tidak dapat membaca respons server. Periksa koneksi dan pastikan server PPDB sedang berjalan.',response?.status||0,'NETWORK_ERROR');
    }finally{clearTimeout(timeout);}
  }
  const client={request,APIError};
  if(typeof module!=='undefined'&&module.exports)module.exports=client;
  else root.PPDBClient=client;
})(globalThis);
