// assets/js/utils/bgm-ui.js
import * as bgm from './bgm.js';

function ensureMini(){
  let el = document.getElementById('bgm-mini');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'bgm-mini';
  el.className = 'bgm-mini is-hidden';
  el.innerHTML = `
    <div class="bgm-mini__art" aria-hidden="true"></div>
    <button class="bgm-mini__btn" aria-label="Play/Pause" title="Play/Pause">▶</button>
    <span class="bgm-mini__meta" aria-live="polite">BGM: —</span>
  `;
  document.body.appendChild(el);
  return el;
}

function positionMini(el){
  try {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const gap = 12; // visual breathing room
    el.style.top = `${Math.max(0, Math.round(rect.bottom + gap))}px`;
  } catch {}
}

function update(el, st){
  const playBtn = el.querySelector('.bgm-mini__btn');
  const meta = el.querySelector('.bgm-mini__meta');
  const art = el.querySelector('.bgm-mini__art');
  playBtn.textContent = st.playing ? '⏸' : '▶';
  playBtn.disabled = !st.ready;
  meta.textContent = st.title ? `BGM: ${st.title}` : 'BGM: —';
  if (art) {
    if (st.artUrl) art.style.backgroundImage = `url(${st.artUrl})`;
    else art.style.removeProperty('background-image');
  }
  el.classList.toggle('is-hidden', !st.ready);
}

function init(){
  const el = ensureMini();
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains('bgm-mini__btn')) bgm.toggle();
  });
  positionMini(el);
  window.addEventListener('resize', () => positionMini(el));
  // If the topbar height changes dynamically later, a small post-layout adjust
  setTimeout(() => positionMini(el), 0);
  update(el, bgm.getState());
  bgm.subscribe((st) => update(el, st));
}

if (document.readyState === 'loading'){
  window.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
