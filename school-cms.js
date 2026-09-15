'use strict';

// School content is stored separately from admissions and managed by superadmins.
module.exports = async function createSchoolCMS(db, { session, body, fail, str, audit, transaction }) {
  const images = ['/assets/school/siswa.jpg', '/assets/school/gedung.jpg', '/assets/school/olahraga.jpg', '/assets/school/prestasi.jpg'];
  const defaults = {
    name: 'St. Yoseph Luwuk', level: 'SMP KATOLIK',
    heroTitle: 'Tempat bertumbuh. Ruang untuk berprestasi.',
    heroText: 'Menemukan potensi, membangun karakter, dan melangkah menuju masa depan bersama SMP Katolik St. Yoseph Luwuk.',
    welcomeTitle: 'Selamat datang di St. Yoseph Luwuk',
    welcomeText: 'Sekolah adalah awal dari banyak cerita. Di St. Yoseph Luwuk, kegiatan belajar menjadi kesempatan untuk bertumbuh dalam iman, membangun karakter, dan mengembangkan potensi diri.\n\nKami merupakan bagian dari keluarga pendidikan Katolik di Luwuk, di bawah Yayasan Pendidikan Katolik Keuskupan Manado.',
    address: 'Luwuk, Sulawesi Tengah', email: '', phone: '', heroImage: images[0]
  };
  (await db.prepare('INSERT INTO school_profile VALUES(1,?) ON DUPLICATE KEY UPDATE id=id').run(JSON.stringify(defaults)));
  const profile = async () => ({ ...defaults, ...JSON.parse((await db.prepare('SELECT data FROM school_profile WHERE id=1').get()).data) });
  const publicPost = row => ({ ...row, published: Boolean(row.published) });

  return async function route(req, res, p, method, json) {
    if (p === '/api/school' && method === 'GET') {
      json({ profile: await profile(), posts: (await db.prepare('SELECT * FROM school_posts WHERE published=1 ORDER BY created DESC,id DESC LIMIT 100').all()).map(publicPost) });
      return true;
    }
    if (p.startsWith('/api/school/posts/') && method === 'GET') {
      const id = Number(p.split('/').pop());
      const post = Number.isSafeInteger(id) && (await db.prepare('SELECT * FROM school_posts WHERE id=? AND published=1').get(id));
      if (!post) fail('Publikasi tidak ditemukan.', 404);
      json({ post: publicPost(post), profile: await profile() });
      return true;
    }
    if (!p.startsWith('/api/admin/school')) return false;
    const user = await session(req, method !== 'GET', true);
    if (p === '/api/admin/school' && method === 'GET') {
      json({ profile: await profile(), posts: (await db.prepare('SELECT * FROM school_posts ORDER BY created DESC,id DESC').all()).map(publicPost), images });
      return true;
    }
    if (p === '/api/admin/school/profile' && method === 'POST') {
      const input = await body(req), next = {};
      for (const [key, min, max] of [['name',2,100],['level',2,50],['heroTitle',5,120],['heroText',10,400],['welcomeTitle',5,150],['welcomeText',20,5000],['address',3,500]]) next[key] = str(input,key,min,max);
      next.email = typeof input.email === 'string' ? input.email.trim() : '';
      next.phone = typeof input.phone === 'string' ? input.phone.trim() : '';
      if (next.email && !/^[^\s@]{1,80}@[^\s@]{1,80}\.[^\s@]{2,20}$/.test(next.email)) fail('Email sekolah tidak valid.');
      if (next.phone && !/^\+?[\d ()-]{8,25}$/.test(next.phone)) fail('Telepon sekolah tidak valid.');
      if (!images.includes(input.heroImage)) fail('Pilih foto sekolah yang tersedia.');
      next.heroImage = input.heroImage;
      await transaction(async () => {
        (await db.prepare('UPDATE school_profile SET data=? WHERE id=1').run(JSON.stringify(next)));
        await audit(user.email,'Memperbarui profil dan beranda sekolah');
      });
      json(next); return true;
    }
    if (p === '/api/admin/school/posts' && method === 'POST') {
      const input = await body(req);
      if (!['Berita','Agenda','Pengumuman'].includes(input.type)) fail('Jenis publikasi tidak valid.');
      const title=str(input,'title',5,160), summary=str(input,'summary',10,350), content=str(input,'content',20,15000);
      if (!images.includes(input.image)) fail('Pilih foto sekolah yang tersedia.');
      const eventDate = input.event_date || '';
      if (input.type === 'Agenda' && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !Number.isFinite(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0,10)!==eventDate)) fail('Tanggal agenda tidak valid.');
      const published=input.published===true?1:0, now=new Date().toISOString();
      let id=input.id;
      await transaction(async () => {
        if (id !== undefined) {
          if (!Number.isSafeInteger(id) || !(await db.prepare('SELECT id FROM school_posts WHERE id=?').get(id))) fail('Publikasi tidak ditemukan.',404);
          (await db.prepare('UPDATE school_posts SET type=?,title=?,summary=?,content=?,image=?,event_date=?,published=?,updated=? WHERE id=?').run(input.type,title,summary,content,input.image,input.type==='Agenda'?eventDate:'',published,now,id));
        } else {
          id=Number((await db.prepare('INSERT INTO school_posts(type,title,summary,content,image,event_date,published,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run(input.type,title,summary,content,input.image,input.type==='Agenda'?eventDate:'',published,now,now)).lastInsertRowid);
        }
        await audit(user.email,`${published?'Menerbitkan':'Menyimpan draf'} ${input.type}: ${title}`);
      });
      json({id}, input.id===undefined?201:200); return true;
    }
    fail('Endpoint tidak ditemukan.',404);
  };
};
