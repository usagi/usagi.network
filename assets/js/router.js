// assets/js/router.js
const routes = new Map([
 ["home", () => import("./views/home.js")],
 ["stream", () => import("./views/stream.js")],
 ["music", () => import("./views/music.js")],
 ["beatsaber", () => import("./views/beatsaber.js")],
 ["software", () => import("./views/software.js")],
 ["artwork", () => import("./views/artwork.js")],
 ["about", () => import("./views/about.js")],
]);

function parse()
{
 const seg = location.hash.replace(/^#\/?/, "") || "home";
 return seg.toLowerCase();
}

let currentMod = null;

export async function navigate(to = parse())
{
 const fade = document.getElementById('page-fade');
 // Start fade-out (cover)
 if (fade){
  fade.classList.add('is-active');
  await new Promise(r => setTimeout(r, 220));
 }
 try {
  const loader = routes.get(to) || routes.get("home");
  const mod = await loader();                 // ルート別に遅延 import
  // 各ビューは `export async function mount()` を推奨。
  // 互換: default export に関数 or { mount } を持つ場合も許容。
  const mountFn = mod.mount
   || (typeof mod.default === "function" ? mod.default : mod.default?.mount);
  if (typeof mountFn !== "function")
  {
   throw new TypeError(`View '${to}' has no mount() export`);
  }
  // 先に前のビューを unmount（あれば）
  const unmountFn = currentMod?.unmount || currentMod?.default?.unmount;
  if (typeof unmountFn === "function")
  {
   try { await unmountFn(); } catch { /* noop */ }
  }
  // SPAビュー表示の切替（data-view属性を利用）
  const app = document.getElementById("app");
  if (app)
  {
   console.log(`Navigating to ${to}`);
   const hero = app.querySelector('.hero[data-view="home"]');
   const homeStrips = app.querySelectorAll('.strip[data-view="home"]');
   const views = app.querySelectorAll('.view[data-view]');
   views.forEach(v => v.classList.toggle('is-hidden', v.dataset.view !== to));
   if (hero) hero.classList.toggle('is-hidden', to !== 'home');
   homeStrips.forEach(s => s.classList.toggle('is-hidden', to !== 'home'));
  }
  // Update active nav immediately so UI reflects intent even if mount fails
  setActiveNav(to);
  await mountFn();
  currentMod = mod;
 } catch (err) {
  console.warn('Navigation error:', err);
  // Homeへの遷移で失敗したら最低限表示は確保
  if (to === 'home'){
   const app = document.getElementById('app');
   const hero = app?.querySelector('.hero[data-view="home"]');
   const homeStrips = app?.querySelectorAll('.strip[data-view="home"]') || [];
   hero?.classList.remove('is-hidden');
   homeStrips.forEach(s => s.classList.remove('is-hidden'));
  }
  // Keep nav state consistent even on error
  setActiveNav(to);
 } finally {
  // Fade-in (reveal)
  if (fade){
   requestAnimationFrame(() => fade.classList.remove('is-active'));
  }
 }
}

function setActiveNav(to){
 document.querySelectorAll('.nav__link').forEach(a => {
  if ((a.dataset.route || '').toLowerCase() === (to || '').toLowerCase()){
   a.setAttribute('aria-current', 'page');
  } else {
   a.removeAttribute('aria-current');
  }
 });
}

export function start()
{
 addEventListener("hashchange", () => navigate());
 document.querySelectorAll(".nav__link").forEach(a =>
 {
  a.addEventListener("click", (e) =>
  {
    e.preventDefault();
    const target = (a.dataset.route || "").toLowerCase();
    const current = (location.hash.replace(/^#\/?/, "") || "home").toLowerCase();
    if (target === current)
    {
     // Already on this view: scroll to top smoothly
     try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
     catch { window.scrollTo(0, 0); }
     return;
    }
    location.hash = `#/${target}`;
  });
 });
 // Defer first navigation slightly to allow importmap and CSS to settle
 queueMicrotask(() => navigate());
 // Safety: ensure the page fade is cleared and home sections are shown on first load
 setTimeout(() => {
  try{
   const fade = document.getElementById('page-fade');
   fade?.classList.remove('is-active');
   const to = (location.hash.replace(/^#\/?/, "") || "home").toLowerCase();
   if (to === 'home'){
    const app = document.getElementById('app');
    const hero = app?.querySelector('.hero[data-view="home"]');
    const homeStrips = app?.querySelectorAll('.strip[data-view="home"]') || [];
    hero?.classList.remove('is-hidden');
    homeStrips.forEach(s => s.classList.remove('is-hidden'));
   }
  }catch{}
 }, 600);
}
