// assets/js/router.js
const routes = new Map([
 ["home", () => import("./views/home.js?v=20260619")],
 ["stream", () => import("./views/stream.js?v=20260619")],
 ["music", () => import("./views/music.js?v=20260619")],
 ["beatsaber", () => import("./views/beatsaber.js?v=20260619")],
 ["software", () => import("./views/software.js?v=20260619")],
 ["artwork", () => import("./views/artwork.js?v=20260619")],
 ["about", () => import("./views/about.js?v=20260619")],
]);

function parse()
{
 const seg = location.hash.replace(/^#\/?/, "") || "home";
 return seg.toLowerCase();
}

let currentMod = null;
let currentRoute = null;

function escapeSelectorId(id)
{
 return CSS?.escape ? CSS.escape(id) : id;
}

function scrollToAnchorInCurrentView(id)
{
 if (!id) return false;
 const candidates = [
  currentRoute ? document.querySelector(`[data-view="${currentRoute}"]`) : null,
  document.querySelector('.view[data-view]:not(.is-hidden)'),
 ];
 for (const root of candidates)
 {
  const target = root?.querySelector(`#${escapeSelectorId(id)}`);
  if (!target) continue;
  const topbar = document.querySelector('.topbar');
  const offset = topbar ? (topbar.getBoundingClientRect().height + 10) : 70;
  const y = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
  return true;
 }
 return false;
}

export async function navigate(to = parse())
{
 if (!routes.has(to))
 {
  if (scrollToAnchorInCurrentView(to)) return;
  to = "home";
 }
 const fade = document.getElementById('page-fade');
 // Start fade-out (cover)
 if (fade){
  fade.classList.add('is-active');
  await new Promise(r => setTimeout(r, 220));
 }
 try {
  const loader = routes.get(to);
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
  const app = document.getElementById("app");
  if (app) console.log(`Navigating to ${to}`);
  // Update active nav immediately so UI reflects intent even if mount fails
  setActiveNav(to);
  await mountFn();
  // SPAビュー表示の切替（data-view属性を利用）。mount後に切り替え、空ビューの露出を避ける。
  if (app)
  {
   const hero = app.querySelector('.hero[data-view="home"]');
   const homeStrips = app.querySelectorAll('.strip[data-view="home"]');
   const views = app.querySelectorAll('.view[data-view]');
   views.forEach(v => v.classList.toggle('is-hidden', v.dataset.view !== to));
   if (hero) hero.classList.toggle('is-hidden', to !== 'home');
   homeStrips.forEach(s => s.classList.toggle('is-hidden', to !== 'home'));
  }
  currentMod = mod;
  currentRoute = routes.has(to) ? to : "home";
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
 addEventListener("hashchange", () =>
 {
  const raw = location.hash.replace(/^#/, "");
  const bareAnchor = raw && !raw.startsWith("/") && !routes.has(raw.toLowerCase());
  if (bareAnchor && scrollToAnchorInCurrentView(raw.toLowerCase())) return;
  navigate();
 });
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
