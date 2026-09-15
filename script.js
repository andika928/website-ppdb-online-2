'use strict';
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu() {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Buka menu navigasi');
}
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); toggle.focus(); }
});
document.addEventListener('click', event => { if (!event.target.closest('.nav-wrap')) closeMenu(); });
matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
const links = [...nav.querySelectorAll('a')];
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(link => {
      const active = link.hash === '#' + entry.target.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
const filters = document.querySelectorAll('[data-filter]');
filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(item => {
    item.classList.toggle('selected', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.hidden = button.dataset.filter !== 'all' && item.dataset.category !== button.dataset.filter;
  });
}));
const dialog = document.querySelector('#photo-dialog');
document.querySelectorAll('.gallery-item').forEach(button => button.addEventListener('click', () => {
  const source = button.querySelector('img');
  const image = dialog.querySelector('img');
  image.src = source.src;
  image.alt = source.alt;
  dialog.querySelector('p').textContent = source.alt;
  dialog.showModal();
}));
dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
document.querySelector('#year').textContent = new Date().getFullYear();

// Navbar remains readable while its background fades in and out on scroll.
const header = document.querySelector('header');
let headerFrame = 0;
function updateHeader() {
  header.classList.toggle('scrolled', window.scrollY > 36);
  headerFrame = 0;
}
window.addEventListener('scroll', () => {
  if (!headerFrame) headerFrame = requestAnimationFrame(updateHeader);
}, { passive: true });
window.addEventListener('pageshow', updateHeader);
updateHeader();

// Content is visible by default, including when the CDN is unavailable.
// matchMedia automatically reverts animation styles if reduced motion changes.
if (window.gsap) {
  const motion = gsap.matchMedia();
  motion.add('(prefers-reduced-motion: no-preference)', () => {
    const hero = document.querySelector('.hero');
    const photo = document.querySelector('.hero-photo');
    const intro = gsap.timeline({ defaults: { ease: 'power2.inOut', duration: 1 } });
    intro
      .from(photo, { scale: 1.12, duration: 2.2 }, 0)
      .from('.nav-wrap', { opacity: 0, y: -18, clearProps: 'opacity,transform' }, 0.08)
      .from('.hero-content > .eyebrow', { opacity: 0, y: 20, clearProps: 'opacity,transform' }, 0.15)
      .from('.hero-line > span', { yPercent: 115, stagger: 0.14, duration: 1.2, clearProps: 'transform' }, 0.25)
      .from('.hero-content > p:not(.eyebrow)', { opacity: 0, y: 24, clearProps: 'opacity,transform' }, 0.65)
      .from('.hero .actions', { opacity: 0, y: 20, clearProps: 'opacity,transform' }, 0.85)
      .from('.hero-bottom', { opacity: 0, y: 12, clearProps: 'opacity,transform' }, 1.05);

    // A small scroll-following offset adds depth without a continuous render loop.
    const movePhoto = gsap.quickTo(photo, 'y', { duration: 0.85, ease: 'power2.inOut' });
    function parallax() {
      const offset = Math.min(Math.max(-hero.getBoundingClientRect().top, 0), hero.offsetHeight);
      movePhoto(offset * 0.1);
    }
    window.addEventListener('scroll', parallax, { passive: true });
    parallax();
    return () => window.removeEventListener('scroll', parallax);
  });
}
