// assets/js/views/stream.js
function ensureSection(){
	let view = document.querySelector('[data-view="stream"]');
	if (!view){
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'stream';
		document.getElementById('app')?.appendChild(view);
	}
	return view;
}

export async function mount(){
	const view = ensureSection();
	view.innerHTML = '';
	// Optional: show page-local loading if needed
	try{
		const res = await fetch('/assets/views/stream.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load stream.html: ${res.status}`);
		view.innerHTML = await res.text();
		await initializeStream();
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load stream page.</p>';
	}
}

export function unmount(){ /* no-op */ }
export default { mount, unmount };

// --- Stream logic ---
async function initializeStream(){
	// 1) Optionally detect live status and show embedded player + chat
	setupLiveEmbeds();

	// 2) Fetch and render Twitch clips
	const clips = await loadTwitchClips();
	renderCards(clips, document.getElementById('grid-clips'));

	// 3) Fetch and render recent VODs (Twitch)
	const vods = await loadTwitchVods();
	renderCards(vods, document.getElementById('grid-vods'));

	// 4) Fetch and render YouTube archives (older)
	const yt = await loadYouTubeArchives();
	renderCards(yt, document.getElementById('grid-yt'));
}

function renderCards(items, grid){
	if (!grid) return;
	grid.innerHTML = '';
	(items || []).forEach((it) => {
		const a = document.createElement('article');
		const kind = it.kind || 'vod';
		const cutClass = kind === 'clip' ? 'card--clip' : kind === 'vod' ? 'card--vod' : kind === 'track' ? 'card--track' : 'card--map';
		a.className = `card ${cutClass}`;
		const thumb = it.thumbnail || it.thumbnail_url || '';
		a.innerHTML = `
			<div class="card__cut"></div>
			${thumb ? `<img class="card__thumb" src="${thumb}" alt="">` : ''}
			<div class="card__body">
				<span class="card__tag">${it.tag || (kind === 'clip' ? 'Clip' : kind === 'vod' ? 'VOD' : 'Archive')}</span>
				<h3 class="card__title">${it.title || 'Untitled'}</h3>
				<div class="card__date">${it.date || ''}</div>
			</div>
		`;
		a.addEventListener('click', () => openDetailEmbed(it));
		grid.appendChild(a);
	});
}

function openDetailEmbed(item){
	const panel = document.getElementById('detail');
	const body = document.getElementById('detail-body');
	if (!panel || !body) return;
	const closeBtn = panel.querySelector('.detail__close');
	body.innerHTML = '';
	const wrap = document.createElement('div');
	wrap.className = 'embed';
	if (item.provider === 'twitch'){
		if (item.kind === 'clip'){
			wrap.innerHTML = `<iframe src="https://clips.twitch.tv/embed?clip=${encodeURIComponent(item.id)}&parent=${location.hostname}&autoplay=true" height="360" width="640" allowfullscreen></iframe>`;
		} else {
			// vod
			wrap.innerHTML = `<iframe src="https://player.twitch.tv/?video=${encodeURIComponent(item.id)}&parent=${location.hostname}&autoplay=true" height="360" width="640" allowfullscreen></iframe>`;
		}
	} else if (item.provider === 'youtube'){
		wrap.innerHTML = `<iframe width="640" height="360" src="https://www.youtube.com/embed/${encodeURIComponent(item.id)}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
	}
	body.appendChild(wrap);
	panel.hidden = false;
	closeBtn?.addEventListener('click', () => { panel.hidden = true; body.innerHTML=''; }, { once: true });
}

function setupLiveEmbeds(){
	const liveWrap = document.getElementById('live-wrap');
	const player = document.getElementById('twitch-iframe');
	const chat = document.getElementById('twitch-chat');
	if (!liveWrap || !player || !chat) return;
	// Minimal client-only toggle: keep hidden by default. If you later wire a live API, switch to visible.
	liveWrap.classList.add('is-hidden');
	// Example (disabled):
	// liveWrap.classList.remove('is-hidden');
	// player.src = `https://player.twitch.tv/?channel=usaginetwork&parent=${location.hostname}`;
	// chat.classList.remove('is-hidden');
	// chat.src = `https://www.twitch.tv/embed/usaginetwork/chat?parent=${location.hostname}`;
}

// --- Data loaders (client-only). Prefer static JSON assets, try dynamic scraping where safe, fallback to placeholders. ---
import { SOURCES } from '#api/config.js';
async function loadJSON(path){
	try {
		const res = await fetch(path, { cache: 'no-store' });
		if (!res.ok) return null;
		const data = await res.json();
		const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
		return items;
	} catch { return null; }
}

function normalize(items = [], provider, kind){
	const out = items.map((it) => ({
		id: it.id || it.video_id || it.clip_id || it.yt_id || '',
		provider: it.provider || provider,
		kind: it.kind || kind,
		title: it.title || '',
		date: it.date || it.published_at || it.created_at || '',
		thumbnail: it.thumbnail || it.thumbnail_url || it.preview_image_url || it.thumb || '',
		tag: it.tag || undefined,
	})).filter(x => x.id);
	// sort desc by date if parsable
	out.sort((a,b) => (new Date(b.date||0)).getTime() - (new Date(a.date||0)).getTime());
	return out;
}

async function loadTwitchClips(){
	const items = await loadJSON('/assets/data/stream/twitch-clips.json');
	if (items) return normalize(items, 'twitch', 'clip');
	// Fallback
	return normalize([
		{ id: 'EnergeticAmazingPineappleHassaanChop', title:'神回ハイライト', date:'2025-08-10', thumbnail:'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.jpg', tag:'Clip' },
	], 'twitch', 'clip');
}

async function loadTwitchVods(){
	const items = await loadJSON('/assets/data/stream/twitch-vods.json');
	if (items) return normalize(items, 'twitch', 'vod');
	// Fallback
	return normalize([
		{ id: '2134567890', title:'開発配信: SPA整備とUI仕上げ', date:'2025-08-27', thumbnail:'https://static-cdn.jtvnw.net/ttv-static/404_preview-640x360.jpg', tag:'VOD' },
	], 'twitch', 'vod');
}

async function loadYouTubeArchives(){
	// 1) Try static JSON if present
	const staticItems = await loadJSON('/assets/data/stream/youtube-archives.json');
	if (staticItems) return normalize(staticItems, 'youtube', 'archive');

	// 2) Try dynamic client-only fetch from YouTube handle page (no API key). Many modern browsers block cross-origin HTML fetches unless CORS is allowed; YouTube does not send CORS headers, so this often fails. We'll attempt via no-cors for opaque hints, then fall back.
	try {
		const handle = SOURCES.youtube?.handle || 'usagi.network';
		const url = `https://www.youtube.com/@${encodeURIComponent(handle)}/videos`;
		const res = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
		// In no-cors, res.ok is false and body is opaque; we can't parse HTML. So we cannot rely on this in browsers.
		// Given CORS limitations, we pivot to oEmbed (which supports CORS) per-video only if we know some IDs.
	} catch {}

	// 3) Last resort fallback: show a single known video as placeholder
	return normalize([
		{ id: 'dQw4w9WgXcQ', title:'旧アーカイブ：○○企画', date:'2023-05-02', thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', tag:'Archive' },
	], 'youtube', 'archive');
}
