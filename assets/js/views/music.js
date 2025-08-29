// assets/js/views/music.js
function ensureSection() {
	let view = document.querySelector('[data-view="music"]');
	if (!view) {
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'music';
		document.getElementById('app')?.appendChild(view);
	}
	return view;
}

export async function mount() {
	const view = ensureSection();
	// If we've already booted once in this session, keep the existing widget to avoid reloading
	if (view.dataset.ready === '1') return;

	// Try sessionStorage cache (TTL: 60s)
	try {
		const raw = sessionStorage.getItem('view:music');
		if (raw) {
			const cached = JSON.parse(raw);
			if (cached && cached.ts && (Date.now() - cached.ts) < 60_000 && typeof cached.tpl === 'string') {
				view.innerHTML = cached.tpl;
				await initPlayer(() => { view.dataset.ready = '1'; });
				return;
			}
		}
	} catch {}
	// Clean container and add overlay first so it survives innerHTML
	view.innerHTML = '';
	const overlay = document.createElement('div');
	overlay.className = 'loading-overlay';
	overlay.innerHTML = `
		<div class="loading-overlay__panel">
			<span class="loading-overlay__badge">URTS</span>
			<div class="loading-overlay__title">LOADING</div>
			<div class="loading-overlay__bar" aria-hidden="true"></div>
		</div>`;
	view.appendChild(overlay);

	const content = document.createElement('div');
	content.className = 'view__content';

	try {
		const res = await fetch('/assets/views/music.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load music.html: ${res.status}`);
		content.innerHTML = await res.text();
		view.appendChild(content);
		// Position overlay over the sc-player area
		try {
			const player = content.querySelector('.sc-player');
			if (player) {
				const r = player.getBoundingClientRect();
				const sx = window.scrollX || document.documentElement.scrollLeft || 0;
				const sy = window.scrollY || document.documentElement.scrollTop || 0;
				Object.assign(overlay.style, {
					position: 'fixed',
					left: `${r.left + sx}px`,
					top: `${r.top + sy}px`,
					width: `${r.width}px`,
					height: `${r.height}px`,
				});
			}
		} catch {}
		await initPlayer(() => {
			overlay.remove();
			view.dataset.ready = '1';
			// Cache template for fast remount within TTL
			try { sessionStorage.setItem('view:music', JSON.stringify({ ts: Date.now(), tpl: view.innerHTML })); } catch {}
		});
	} catch (err) {
		console.error(err);
		content.innerHTML = '<p>Failed to load music content.</p>';
		view.appendChild(content);
		overlay.remove();
	}
}

export function unmount() {
	// no-op; content replaced on next mount
}

export default { mount, unmount };

// --- Player Logic ---
async function loadWidgetAPI() {
	if (window.SC && window.SC.Widget) return;
	await new Promise((resolve, reject) => {
		const s = document.createElement('script');
		s.src = 'https://w.soundcloud.com/player/api.js';
		s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
	});
}

function formatTime(ms) {
	const sec = Math.floor(ms / 1000);
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

async function initPlayer(onReady) {
	await loadWidgetAPI();
	const iframe = document.getElementById('sc-widget');
	if (!iframe) { if (typeof onReady === 'function') onReady(); return; }
	const widget = window.SC.Widget(iframe);
	// Link to global BGM controller
	const bgm = await import('#utils/bgm.js');
	bgm.attachWidget(widget);

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

	function renderList() {
		if (!listEl) return;
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

	function updateNowPlaying(info) {
		if (titleEl) titleEl.textContent = info.title || 'Untitled';
		if (artistEl) artistEl.textContent = info.user?.username || 'USAGI.NETWORK';
		const art = info.artwork_url || info.user?.avatar_url;
		const art300 = art ? art.replace('-large', '-t300x300') : '';
		if (art300 && artEl) artEl.style.backgroundImage = `url(${art300})`;
		else if (artEl) artEl.style.backgroundImage = '';
		const d = (info.description || '').trim();
		if (descEl) {
			if (d) {
				descEl.innerHTML = linkify(d);
				descEl.style.display = '';
			} else {
				descEl.style.display = 'none';
			}
		}
		// Update mini controller metadata
		bgm.setMeta({ title: info.title || 'Untitled', artist: 'USAGI.NETWORK', artUrl: art300 });
	}

	widget.bind(window.SC.Widget.Events.READY, () => {
		if (useExternalList) {
			currentIndex = 0;
			renderList();
			loadByIndex(0);
			if (typeof onReady === 'function') onReady();
		} else {
			widget.getSounds((list) => {
				tracks = Array.isArray(list) ? list : [];
				currentIndex = 0;
				renderList();
				widget.getCurrentSound((s) => { if (s) updateNowPlaying(s); });
				widget.getDuration((d) => { if (tDuration) tDuration.textContent = formatTime(d); });
				if (typeof onReady === 'function') onReady();
			});
		}
	});

	widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e) => {
		const pct = e.relativePosition * 100;
		if (barFill) barFill.style.inset = `0 ${100 - pct}% 0 0`;
		if (tElapsed) tElapsed.textContent = formatTime(e.currentPosition);
	});

	widget.bind(window.SC.Widget.Events.PLAY, () => { if (playBtn) playBtn.textContent = '⏸'; syncActive(); });
	widget.bind(window.SC.Widget.Events.PAUSE, () => { if (playBtn) playBtn.textContent = '▶'; });
	widget.bind(window.SC.Widget.Events.FINISH, () => { /* auto next handled by widget */ });
	widget.bind(window.SC.Widget.Events.SEEK, (e) => {
		const pct = (e.currentPosition / e.duration) * 100;
		if (barFill) barFill.style.inset = `0 ${100 - pct}% 0 0`;
	});
	widget.bind(window.SC.Widget.Events.PLAY, () => {
		widget.getCurrentSoundIndex((i) => { currentIndex = i ?? 0; syncActive(); });
		widget.getCurrentSound((s) => updateNowPlaying(s || {}));
		widget.getDuration((d) => { if (tDuration) tDuration.textContent = formatTime(d); });
	});

	function syncActive(){
		if (!listEl) return;
		listEl.querySelectorAll('.scp__track').forEach((el, i) => {
			el.classList.toggle('is-active', i === currentIndex);
		});
	}

	if (playBtn) playBtn.addEventListener('click', () => {
		widget.isPaused((paused) => { paused ? widget.play() : widget.pause(); });
	});
	if (prevBtn) prevBtn.addEventListener('click', () => {
		if (useExternalList) {
			if (tracks.length === 0) return;
			currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
			loadByIndex(currentIndex);
		} else {
			widget.prev();
		}
	});
	if (nextBtn) nextBtn.addEventListener('click', () => {
		if (useExternalList) {
			if (tracks.length === 0) return;
			currentIndex = (currentIndex + 1) % tracks.length;
			loadByIndex(currentIndex);
		} else {
			widget.next();
		}
	});

	function seekFromEvent(clientX){
		const rect = bar.getBoundingClientRect();
		const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		widget.getDuration((d) => { widget.seekTo(Math.floor(d * ratio)); });
	}
	if (bar){
		bar.addEventListener('click', (e) => seekFromEvent(e.clientX));
		bar.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
				const delta = e.key === 'ArrowRight' ? 5_000 : -5_000;
				widget.getPosition((p) => { widget.seekTo(Math.max(0, p + delta)); });
				e.preventDefault();
			}
		});
	}

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
