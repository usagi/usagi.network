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
    const hero = app.querySelector('.hero');
    if (hero)
     hero.classList.toggle('is-hidden', to !== 'home');
    const views = app.querySelectorAll('[data-view]');
    views.forEach(v => v.classList.toggle('is-hidden', v.dataset.view !== to));
 }
 await mountFn();
 document.querySelectorAll(".nav__link").forEach(a =>
 {
  if (a.dataset.route === to)
  {
   a.setAttribute("aria-current", "page");
  }
  else
  {
   a.removeAttribute("aria-current");
  }
 });
 currentMod = mod;
 // Fade-in (reveal)
 if (fade){
  // small timeout to allow layout
  requestAnimationFrame(() => fade.classList.remove('is-active'));
 }
}

export function start()
{
 addEventListener("hashchange", () => navigate());
 document.querySelectorAll(".nav__link").forEach(a =>
 {
  a.addEventListener("click", (e) =>
  {
   e.preventDefault();
   location.hash = `#/${a.dataset.route}`;
  });
 });
 navigate();
}
