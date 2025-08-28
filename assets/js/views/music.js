// assets/js/views/music.js
function ensureSection()
{
	let view = document.querySelector('[data-view="music"]');
	if (!view)
	{
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'music';
		document.getElementById('app')?.appendChild(view);
	}
	return view;
}

export async function mount()
{
	const view = ensureSection();
	try {
		const res = await fetch('/assets/views/music.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load music.html: ${res.status}`);
		const html = await res.text();
		view.innerHTML = html;
	await initPlayer();
	} catch (err) {
		console.error(err);
		view.innerHTML = '<p>Failed to load music content.</p>';
	}
}

export function unmount() {
	// no-op; content replaced on next mount
}

export default { mount, unmount };

// --- Player Logic ---
async function loadWidgetAPI()
{
	if (window.SC && window.SC.Widget) return;
	await new Promise((resolve, reject) => {
		const s = document.createElement('script');
		s.src = 'https://w.soundcloud.com/player/api.js';
		s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
	});
}

function formatTime(ms)
{
	const sec = Math.floor(ms / 1000);
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

async function initPlayer()
{
	await loadWidgetAPI();
	const iframe = document.getElementById('sc-widget');
	if (!iframe) return;
	const widget = window.SC.Widget(iframe);

	const artEl = document.querySelector('.scp__art');
	const titleEl = document.querySelector('.scp__title');
	const artistEl = document.querySelector('.scp__artist');
		const descEl = document.getElementById('sc-desc');
	const listEl = document.getElementById('sc-track-list');
	const playBtn = document.querySelector('.scp__play');
	const prevBtn = document.querySelector('.scp__prev');
	const nextBtn = document.querySelector('.scp__next');
	const bar = document.querySelector('.scp__bar');
	const barFill = document.querySelector('.scp__bar-fill');
	const tElapsed = document.querySelector('.scp__elapsed');
	const tDuration = document.querySelector('.scp__duration');

		let tracks = [];
		let currentIndex = 0;
		let useExternalList = false;

		// Try loading prebuilt JSON list first
		try {
			const r = await fetch('/assets/data/soundcloud-tracks.json', { cache: 'no-store' });
			if (r.ok) {
				const data = await r.json();
				tracks = Array.isArray(data) ? data : Array.isArray(data?.tracks) ? data.tracks : [];
				if (tracks.length) useExternalList = true;
			}
		} catch {}

		function renderList()
	{
		listEl.innerHTML = '';
		tracks.forEach((t, i) => {
			const li = document.createElement('li');
			li.className = 'scp__track' + (i === currentIndex ? ' is-active' : '');
				const pub = t.created_at ? new Date(t.created_at) : null;
				const ymd = pub ? `${pub.getFullYear()}-${String(pub.getMonth()+1).padStart(2,'0')}-${String(pub.getDate()).padStart(2,'0')}` : '';
				const link = t.permalink_url || t.permalink || '#';
				li.innerHTML = `
					<div class="scp__idx">${i + 1}</div>
					<div class="scp__tmeta">
						<div class="scp__t-title">${t.title || 'Unknown Title'}</div>
						<div class="scp__t-artist">${t.user?.username || 'Dr.USAGI'} <span class="scp__t-date">${ymd}</span> · <a class="scp__t-link" href="${link}" target="_blank" rel="noopener">SoundCloud ↗</a></div>
					</div>
					<div class="scp__dur">${t.duration ? formatTime(t.duration) : '-'}</div>
				`;
					if (useExternalList) {
						li.addEventListener('click', () => loadByIndex(i));
					} else {
						li.addEventListener('click', () => { widget.skip(i); });
					}
			listEl.appendChild(li);
		});
	}

		// Safe helpers for rich description
		function escapeHtml(str){
			return String(str).replace(/[&<>"']/g, (ch) => ({
				'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
			})[ch]);
		}
		function linkify(text){
			const urlRe = /(https?:\/\/[^\s]+)/g; // capture URLs
			const parts = String(text).split(urlRe);
			let html = '';
			for (let i = 0; i < parts.length; i++){
				const part = parts[i];
				if (i % 2 === 1){
					const safe = escapeHtml(part);
					html += `<a href="${safe}" target="_blank" rel="noopener">${safe}</a>`;
				} else {
					html += escapeHtml(part);
				}
			}
			return html;
		}

		function updateNowPlaying(info)
	{
		titleEl.textContent = info.title || 'Untitled';
		artistEl.textContent = info.user?.username || 'Dr.USAGI';
		const art = info.artwork_url || info.user?.avatar_url;
		if (art) artEl.style.backgroundImage = `url(${art.replace('-large', '-t300x300')})`;
		else artEl.style.backgroundImage = '';
			const d = (info.description || '').trim();
			if (descEl) {
				if (d) {
					// Preserve newlines via CSS (white-space: pre-wrap) and linkify URLs safely
					descEl.innerHTML = linkify(d);
					descEl.style.display = '';
				} else {
					descEl.style.display = 'none';
				}
			}
	}

	widget.bind(window.SC.Widget.Events.READY, () => {
			if (useExternalList) {
				currentIndex = 0;
				renderList();
				loadByIndex(0);
			} else {
				widget.getSounds((list) => {
					// When using a profile URL, getSounds returns the stream list.
					tracks = Array.isArray(list) ? list : [];
					currentIndex = 0;
					renderList();
					widget.getCurrentSound((s) => { if (s) updateNowPlaying(s); });
					widget.getDuration((d) => { tDuration.textContent = formatTime(d); });
				});
			}
	});

	widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e) => {
		const pct = e.relativePosition * 100;
		barFill.style.inset = `0 ${100 - pct}% 0 0`;
		tElapsed.textContent = formatTime(e.currentPosition);
	});

	widget.bind(window.SC.Widget.Events.PLAY, () => { playBtn.textContent = '⏸'; syncActive(); });
	widget.bind(window.SC.Widget.Events.PAUSE, () => { playBtn.textContent = '▶'; });
	widget.bind(window.SC.Widget.Events.FINISH, () => { /* let widget handle next */ });
	widget.bind(window.SC.Widget.Events.SEEK, (e) => {
		const pct = (e.currentPosition / e.duration) * 100;
		barFill.style.inset = `0 ${100 - pct}% 0 0`;
	});
	widget.bind(window.SC.Widget.Events.PLAY, () => {
		widget.getCurrentSoundIndex((i) => { currentIndex = i ?? 0; syncActive(); });
		widget.getCurrentSound((s) => updateNowPlaying(s || {}));
		widget.getDuration((d) => { tDuration.textContent = formatTime(d); });
	});

	function syncActive(){
		listEl.querySelectorAll('.scp__track').forEach((el, i) => {
			el.classList.toggle('is-active', i === currentIndex);
		});
	}

		playBtn.addEventListener('click', async () => {
		widget.isPaused((paused) => { paused ? widget.play() : widget.pause(); });
	});
		prevBtn.addEventListener('click', () => {
			if (useExternalList) {
				if (tracks.length === 0) return;
				currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
				loadByIndex(currentIndex);
			} else {
				widget.prev();
			}
		});
		nextBtn.addEventListener('click', () => {
			if (useExternalList) {
				if (tracks.length === 0) return;
				currentIndex = (currentIndex + 1) % tracks.length;
				loadByIndex(currentIndex);
			} else {
				widget.next();
			}
		});

	// Seek by clicking the progress bar
	function seekFromEvent(clientX){
		const rect = bar.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		widget.getDuration((d) => { widget.seekTo(Math.floor(d * ratio)); });
	}
	bar.addEventListener('click', (e) => seekFromEvent(e.clientX));
	bar.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
			const delta = e.key === 'ArrowRight' ? 5_000 : -5_000;
			widget.getPosition((p) => { widget.seekTo(Math.max(0, p + delta)); });
			e.preventDefault();
		}
	});

		function loadByIndex(i){
			const t = tracks[i];
			if (!t) return;
			const url = t.permalink_url || t.permalink || t.uri;
			if (!url) return;
			currentIndex = i;
			widget.load(url, {
				auto_play: true,
				visual: false,
				show_user: false,
				show_teaser: false,
				show_comments: false,
				show_reposts: false,
				buying: false,
				sharing: false,
				download: false,
			});
		}
}
