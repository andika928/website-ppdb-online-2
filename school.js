'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'});
const link = post => '/publikasi?id=' + post.id;
function card(post) {
  return `<article class="news-card"><a href="${link(post)}"><img src="${esc(post.image)}" alt="${esc(post.title)}" loading="lazy"></a><div class="body"><div class="meta"><span class="tag">${esc(post.type.toUpperCase())}</span><time>${date(post.created)}</time></div><h3><a href="${link(post)}">${esc(post.title)}</a></h3><p>${esc(post.summary)}</p><a class="text-link" href="${link(post)}">Baca selengkapnya →</a></div></article>`;
}
function profile(data) {
  document.querySelectorAll('[data-school]').forEach(el => { if (data[el.dataset.school]) el.textContent=data[el.dataset.school]; });
  if ($('#hero-image')) $('#hero-image').src=data.heroImage;
  if (window.schoolHero) window.schoolHero.updateProfile(data);
  for (const key of ['email','phone']) {
    const el=$('#school-'+key);
    if(el && data[key]) { el.hidden=false; el.textContent=data[key]; el.href=(key==='email'?'mailto:':'tel:')+data[key].replace(key==='phone'?/[ ()-]/g:/$^/g,''); }
  }
}
const toggle=$('.menu-button');
if(toggle) {
  toggle.onclick=()=>{const open=$('#navigation').classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open));};
  $('#navigation').querySelectorAll('a').forEach(a=>a.onclick=()=>{$('#navigation').classList.remove('open');toggle.setAttribute('aria-expanded','false');});
  document.addEventListener('keydown', e=>{if(e.key==='Escape'){$('#navigation').classList.remove('open');toggle.setAttribute('aria-expanded','false');}});
}
if($('#year')) $('#year').textContent=new Date().getFullYear();
async function get(url){return PPDBClient.request(url);}
async function initialize(){
  try {
    const {profile: school,posts}=await get('/api/school'); profile(school);
    if($('#news-grid')) {
      $('#news-grid').innerHTML=posts.filter(p=>p.type==='Berita').slice(0,3).map(card).join('') || '<p class="empty">Belum ada berita yang diterbitkan. Nantikan kabar terbaru dari sekolah.</p>';
      const events=posts.filter(p=>p.type==='Agenda').sort((a,b)=>a.event_date.localeCompare(b.event_date));
      const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Makassar'});
      $('#agenda-list').innerHTML=events.filter(p=>p.event_date>=today).slice(0,3).map(p=>{const d=new Date(p.event_date+'T00:00:00+08:00');return `<a class="event" href="${link(p)}"><div class="event-date"><strong>${d.toLocaleDateString('id-ID',{day:'2-digit',timeZone:'Asia/Makassar'})}</strong>${d.toLocaleDateString('id-ID',{month:'short',timeZone:'Asia/Makassar'})}</div><div><h4>${esc(p.title)}</h4><p>${esc(p.summary)}</p></div></a>`;}).join('') || '<p class="empty">Belum ada agenda mendatang.</p>';
      $('#announcement-list').innerHTML=posts.filter(p=>p.type==='Pengumuman').slice(0,3).map(p=>`<a class="event" href="${link(p)}"><div><span class="tag">${date(p.created)}</span><h4>${esc(p.title)}</h4><p>${esc(p.summary)}</p></div><span aria-hidden="true">↗</span></a>`).join('') || '<p class="empty">Belum ada pengumuman terbaru. Informasi PPDB tersedia di portal pendaftaran.</p>';
    }
    if($('#publication-list')) {
      const params=new URLSearchParams(location.search),id=params.get('id'),type=params.get('type');
      if(id) {
        const {post}=await get('/api/school/posts/'+encodeURIComponent(id));
        document.title=post.title+' | '+school.name;
        $('#publication-title').textContent=post.type;
        $('#publication-list').className='container section publication-content';
        $('#publication-list').innerHTML=`<a class="text-link" href="/publikasi?type=${encodeURIComponent(post.type)}">← Semua ${esc(post.type.toLowerCase())}</a><h1>${esc(post.title)}</h1><p class="article-meta">${date(post.created)}${post.type==='Agenda'?' · Tanggal kegiatan: '+date(post.event_date+'T00:00:00+08:00'):''}</p><img class="article-photo" src="${esc(post.image)}" alt="${esc(post.title)}"><p class="summary">${esc(post.summary)}</p><div class="article-body">${esc(post.content)}</div>`;
      } else {
        const selected=['Berita','Agenda','Pengumuman'].includes(type)?type:'';
        $('#publication-title').textContent=selected||'Publikasi Sekolah';
        document.title=(selected||'Publikasi')+' | '+school.name;
        $('#publication-list').innerHTML=posts.filter(p=>!selected||p.type===selected).map(card).join('')||'<p class="empty">Belum ada publikasi dalam kategori ini.</p>';
      }
    }
  } catch(e) {
    const target=$('#content-error')||$('#publication-list');
    if(target){target.hidden=false;target.textContent=e.message;}
    for(const id of ['news-grid','agenda-list','announcement-list']) if($('#'+id)) $('#'+id).innerHTML='<p class="empty">Informasi tidak tersedia untuk sementara.</p>';
  }
}
initialize();
if($('#admission-status')) get('/api/settings').then(s=>{const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Makassar'});const open=s.open&&(!s.start||today>=s.start)&&(!s.end||today<=s.end);$('#admission-status').textContent=open?'Pendaftaran sedang dibuka':'Lihat jadwal pendaftaran';$('#admission-year').textContent='Tahun ajaran '+s.year;}).catch(()=>{});
const photoDialog=$('#photo-dialog');
if(photoDialog){
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});document.querySelectorAll('[data-category]').forEach(x=>x.hidden=b.dataset.filter!=='all'&&x.dataset.category!==b.dataset.filter);});
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{const img=b.querySelector('img');photoDialog.querySelector('img').src=img.src;photoDialog.querySelector('img').alt=img.alt;photoDialog.querySelector('p').textContent=img.alt;photoDialog.showModal();});
  $('#close-photo').onclick=()=>photoDialog.close();
}

// Hero interactions are scoped to the homepage; publication navigation stays unchanged.
if (document.body.classList.contains('immersive-home')) {
  const hero = $('#beranda');
  const header = $('.site-header');
  const heroImage = $('#hero-image');
  const panel = $('#hero-panel');
  const title = $('#hero-title');
  const description = $('#hero-description');
  const cta = $('#hero-cta');
  const tabs = [...document.querySelectorAll('[data-hero]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 'school', version = 0, scrollFrame = 0;
  let outgoingImage = null, contentAnimation = null;
  const slides = {
    school: {title:title.textContent, text:description.textContent, image:heroImage.getAttribute('src'), alt:heroImage.alt, action:'Daftar siswa baru', href:'/ppdb'},
    learning: {title:'Belajar. Berkarya. Bertumbuh.', text:'Ruang untuk menemukan potensi, membangun persahabatan, dan belajar melalui pengalaman bersama.', image:'/assets/school/olahraga.jpg', alt:'Kegiatan olahraga bersama siswa St. Yoseph', action:'Kehidupan sekolah', href:'#kegiatan'},
    achievement: {title:'Semangat berprestasi.', text:'Setiap usaha berarti. Setiap keberanian mencoba menjadi langkah untuk tumbuh dan meraih potensi terbaik.', image:'/assets/school/prestasi.jpg', alt:'Siswa St. Yoseph membawa piala dan piagam bersama pendamping', action:'Jelajahi galeri', href:'#galeri'},
    admission: {title:'Masa depan dimulai di sini.', text:'Mulai perjalanan belajarmu bersama St. Yoseph. Daftar online, lengkapi berkas, dan pantau hasil seleksi.', image:'/assets/school/siswa.jpg', alt:'Siswa St. Yoseph berkumpul di halaman sekolah', action:'Pendaftaran online', href:'/ppdb'}
  };
  async function selectSlide(key, animate=true) {
    const ticket = ++version;
    const slide = slides[key];
    const preload = new Image(); preload.src=slide.image;
    try { await preload.decode(); } catch { return; }
    if (ticket !== version) return;
    selected=key;
    const motion=animate&&!reducedMotion.matches;
    outgoingImage?.remove(); outgoingImage=null;
    if (motion && heroImage.getAttribute('src')!==slide.image) {
      outgoingImage=heroImage.cloneNode();
      outgoingImage.removeAttribute('id');
      outgoingImage.alt=''; outgoingImage.setAttribute('aria-hidden','true');
      heroImage.after(outgoingImage);
      const old=outgoingImage;
      old.animate([{opacity:1},{opacity:0}],{duration:850,easing:'ease-in-out',fill:'forwards'}).finished.then(()=>old.remove()).catch(()=>old.remove());
    }
    heroImage.src=slide.image; heroImage.alt=slide.alt;
    title.textContent=slide.title; description.textContent=slide.text;
    cta.href=slide.href; cta.replaceChildren(document.createTextNode(slide.action+' '));
    const arrow=document.createElement('span');arrow.textContent='→';arrow.setAttribute('aria-hidden','true');cta.append(arrow);
    tabs.forEach(button=>{const active=button.dataset.hero===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    panel.setAttribute('aria-labelledby','hero-tab-'+key);
    contentAnimation?.cancel();
    if(motion) contentAnimation=panel.animate([{opacity:.15,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'ease-in-out'});
  }
  tabs.forEach((button,index)=>{
    button.onclick=()=>selectSlide(button.dataset.hero);
    button.onkeydown=event=>{
      let next;
      if(event.key==='ArrowRight') next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home') next=0;
      if(event.key==='End') next=tabs.length-1;
      if(next===undefined) return;
      event.preventDefault();tabs[next].focus();selectSlide(tabs[next].dataset.hero);
    };
  });
  window.schoolHero={updateProfile(data){
    slides.school={...slides.school,title:data.heroTitle,text:data.heroText,image:data.heroImage};
    selectSlide(selected,false);
  }};
  function updateScroll(){
    scrollFrame=0;
    header.classList.toggle('scrolled',window.scrollY>40);
    if(reducedMotion.matches){heroImage.style.transform='';return;}
    const progress=Math.max(0,Math.min(window.scrollY/hero.offsetHeight,1));
    heroImage.style.transform=`translate3d(0,${progress*4}%,0)`;
  }
  function scheduleScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);}
  window.addEventListener('scroll',scheduleScroll,{passive:true});
  window.addEventListener('resize',scheduleScroll,{passive:true});
  window.addEventListener('pageshow',scheduleScroll);
  reducedMotion.addEventListener('change',()=>{contentAnimation?.cancel();outgoingImage?.remove();updateScroll();});
  updateScroll();
}
