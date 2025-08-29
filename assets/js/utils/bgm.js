// assets/js/utils/bgm.js
// Simple global BGM controller for SoundCloud widget

const listeners = new Set();
let widget = null;
let state = {
  ready: false,
  playing: false,
  title: '',
  artist: 'USAGI.NETWORK',
  artUrl: '',
};

function emit(){
  listeners.forEach(fn => { try { fn({ ...state }); } catch {} });
}

export function subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); }
export function getState(){ return { ...state }; }

export function setMeta(meta){
  const t = meta?.title ?? state.title;
  const a = meta?.artist ?? state.artist;
  const art = meta?.artUrl ?? state.artUrl;
  state = { ...state, title: String(t), artist: String(a), artUrl: String(art || '') };
  emit();
}

export function attachWidget(w){
  widget = w;
  state.ready = true;
  // Bind minimal events to reflect play/pause
  try {
    const EV = window.SC?.Widget?.Events || {};
    w.bind?.(EV.PLAY, () => { state.playing = true; emit(); });
    w.bind?.(EV.PAUSE, () => { state.playing = false; emit(); });
    w.bind?.(EV.FINISH, () => { state.playing = false; emit(); });
  } catch {}
  emit();
}

export function play(){ try { widget?.play?.(); } catch {} }
export function pause(){ try { widget?.pause?.(); } catch {} }
export function toggle(){
  if (!widget) return;
  try { widget.isPaused((p) => { p ? widget.play() : widget.pause(); }); } catch {}
}
export function stop(){ pause(); }
export function pauseIfPlaying(){ if (state.playing) pause(); }

export default {
  subscribe, getState, setMeta,
  attachWidget, play, pause, toggle, stop, pauseIfPlaying,
};
