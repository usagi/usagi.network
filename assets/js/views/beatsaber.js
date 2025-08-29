// assets/js/views/beatsaber.js
function ensureSection(){
	let view = document.querySelector('[data-view="beatsaber"]');
	if (!view){
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'beatsaber';
		document.getElementById('app')?.appendChild(view);
	}
	return view;
}

export async function mount(){
	const view = ensureSection();
	try{
		const res = await fetch('/assets/views/beatsaber.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load beatsaber.html: ${res.status}`);
		view.innerHTML = await res.text();
		// Set default download hrefs; precise filename resolution is handled in beatsaber-terms.js
				view.querySelectorAll('.js-dl[data-item][data-cat]')?.forEach(a => {
			const cat = a.getAttribute('data-cat');
			const item = a.getAttribute('data-item');
					if(cat && item){
						const explicit = a.getAttribute('data-zip');
						const zip = explicit
							? `/assets/beatsaber/${cat}/${item}/${explicit}`
							: `/assets/beatsaber/${cat}/${item}/${item}.zip`;
						a.setAttribute('href', zip);
						if(explicit) a.setAttribute('download', explicit);
					}
		});
		// Try to set media backgrounds if an image is present (convention: <item>.jpg|png|webp)
		view.querySelectorAll('.feature__media[data-item][data-cat]')?.forEach(div => {
			const cat = div.getAttribute('data-cat');
			const item = div.getAttribute('data-item');
			const candidates = ['webp','jpg','png'].map(ext => `/assets/beatsaber/${cat}/${item}/${item}.${ext}`);
			// Optimistically assign the first candidate; static hosting will 404 gracefully if missing
			div.style.background = `#0b0c0f center/cover no-repeat url('${candidates[0]}')`;
		});

		// Build left-side sliding galleries (images/videos) for all feature media blocks
		initFeatureGalleries(view).catch(()=>{});

		// Enable in-view smooth scrolling for INDEX links without breaking SPA routing
		const idxLinks = view.querySelectorAll('.index-nav a[href^="#"]');
		idxLinks.forEach(link => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const href = link.getAttribute('href') || '';
				const id = href.replace(/^#/, '');
				if(!id) return;
				const target = view.querySelector(`#${CSS?.escape ? CSS.escape(id) : id}`);
				if(!target) return;
				const topbar = document.querySelector('.topbar');
				const offset = topbar ? (topbar.getBoundingClientRect().height + 10) : 70;
				const y = target.getBoundingClientRect().top + window.scrollY - offset;
				window.scrollTo({ top: y, behavior: 'smooth' });
			});
		});
		// Lazy-load terms logic
		import('./beatsaber-terms.js').catch(() => {});
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load Beat Saber page.</p>';
	}
}

let __galleryTimers = new Set();
export function unmount(){
	// Clear gallery timer if running
	if(__galleryTimers && __galleryTimers.size){
		for(const t of __galleryTimers){ try{ clearInterval(t); }catch{} }
		__galleryTimers.clear();
	}
	// Remove lightbox entirely to drop listeners
	const lb = document.getElementById('lightbox');
	if(lb){ lb.remove(); document.body.style.overflow = ''; }
}
export default { mount, unmount };

// --- Gallery helpers ---
async function pauseBgmIfPlaying(){
	try{
		const mod = await import('../utils/bgm.js');
		mod.pauseIfPlaying?.();
	}catch{}
}

async function initFeatureGalleries(root){
	const medias = root.querySelectorAll('.feature__media[data-item][data-cat]');
	if(!medias?.length) return;
	for (const media of medias){
		try{ await initOneGallery(media); }catch{}
	}
}

async function initOneGallery(media){

	// Create gallery container
	const gal = document.createElement('div');
	gal.className = 'gallery';
	gal.setAttribute('role','img');
	gal.setAttribute('aria-label','Showcase');
	const track = document.createElement('div');
	track.className = 'gallery__track';
	const dots = document.createElement('div');
	dots.className = 'gallery__dots';
	const shade = document.createElement('div');
	shade.className = 'gallery__shade';

	media.replaceChildren(gal);
	gal.appendChild(track);
	gal.appendChild(shade);
	gal.appendChild(dots);

		// Discover media for this feature
		const cat = media.getAttribute('data-cat');
		const item = media.getAttribute('data-item');
		const base = `/assets/beatsaber/${cat}/${item}/`;
		const imgBase = base + 'image/';
		const vidBase = base + 'media/';
		// Collect media from the single, correct base
		const imageUrls = await probeSequentialImages(imgBase, 24);
		const videoUrls = await probeSequentialVideos(vidBase, 6);
		const slides = [
			...imageUrls.map(src => ({ type: 'image', src })),
			...videoUrls.map(src => ({ type: 'video', src }))
		];
		// Optional: embed clips (Twitch, YouTube) via data-embed-url or data-embed-urls on the media element
		const embedSingle = media.getAttribute('data-embed-url');
		const embedListAttr = media.getAttribute('data-embed-urls');
		const embedList = [];
		if(embedSingle) embedList.push(embedSingle);
		if(embedListAttr){
			embedList.push(...embedListAttr.split(/[\s,]+/).filter(Boolean));
		}
		for(const u of unique(embedList)){
			slides.push({ type: 'embed', src: u });
		}
		if(slides.length === 0){
		// fallback: keep previous background if any
		media.style.minHeight = '220px';
		return;
	}

	// Build slides
		slides.forEach((slide, idx) => {
			const wrap = document.createElement('div');
			wrap.className = 'gallery__slide';
			if(slide.type === 'image'){
				const img = document.createElement('img');
				img.className = 'gallery__img';
				img.loading = 'lazy';
				img.decoding = 'async';
				img.src = slide.src;
				img.alt = `Vulpisfoglia image ${idx+1}`;
				img.addEventListener('click', () => openLightbox(slides, idx));
				wrap.appendChild(img);
			} else if (slide.type === 'video' || slide.type === 'audio' || slide.type === 'embed'){
				const thumb = document.createElement('button');
				thumb.type = 'button';
				thumb.className = 'gallery__video-thumb'; // reuse thumb style for video/audio
				thumb.setAttribute('aria-label', slide.type === 'audio' ? 'Play sound' : (slide.type === 'embed' ? 'Play clip' : 'Play video'));
				thumb.innerHTML = '<span class="gallery__play">▶</span>';
				thumb.addEventListener('click', () => openLightbox(slides, idx));
				wrap.appendChild(thumb);
			}
			track.appendChild(wrap);

			const dot = document.createElement('span');
			dot.className = 'gallery__dot' + (idx===0?' is-active':'');
			dot.addEventListener('click', () => goTo(idx));
			dots.appendChild(dot);
		});

	let cur = 0;
		let timer = null;
		const intervalMs = 4200; // auto-slide every ~4.2s

	function render(){
		track.style.transform = `translate3d(${-100*cur}%,0,0)`;
		[...dots.children].forEach((d,i)=> d.classList.toggle('is-active', i===cur));
	}
	function goTo(i){
		cur = (i+slides.length)%slides.length;
		render();
		restart();
	}
	function next(){ goTo(cur+1); }
	function restart(){
		if(timer) clearInterval(timer);
		timer = setInterval(next, intervalMs);
		__galleryTimers.add(timer);
	}
	render();
	restart();

	// Pause on hover for UX
	gal.addEventListener('mouseenter', ()=> timer && clearInterval(timer));
	gal.addEventListener('mouseleave', restart);
}

function unique(arr){
	const seen = new Set();
	const out = [];
	for(const x of arr){ if(!seen.has(x)){ seen.add(x); out.push(x); } }
	return out;
}

async function probeSequentialImages(base, maxCount){
	const results = [];
	const exts = ['jpg','png','webp','JPG','PNG','WEBP'];
	for(let i=0;i<maxCount;i++){
		let foundForIndex = null;
		for(const ext of exts){
			const url = `${base}${i}.${ext}`;
			const ok = await urlExists(url);
			if(ok){ foundForIndex = url; break; }
		}
		if(foundForIndex){
			results.push(foundForIndex);
		} else {
			console.debug('[gallery] no image found for index', i, 'at', base, 'stop probing');
			break; // stop at first gap
		}
	}
	return results;
}

async function urlExists(url){
	// Load actual image to avoid servers that return 200 for HEAD on missing files
	try{
		await loadImage(url, 3000);
		return true;
	}catch(err){
		return false;
	}
}

function loadImage(src, timeoutMs=3000){
	return new Promise((resolve, reject)=>{
		const img = new Image();
		let done = false;
		const to = setTimeout(()=>{ if(!done){ done=true; img.src=''; reject(new Error('timeout')); } }, timeoutMs);
		img.onload = ()=>{ if(!done){ done=true; clearTimeout(to); resolve(true); } };
		img.onerror = ()=>{ if(!done){ done=true; clearTimeout(to); reject(new Error('error')); } };
		img.decoding = 'async';
		img.loading = 'eager';
		img.src = src;
	});
}

async function probeSequentialVideos(base, maxCount){
	const results = [];
	const exts = ['mp4','webm','MP4','WEBM'];
	for(let i=0;i<maxCount;i++){
		let found = null;
		for(const ext of exts){
			const url = `${base}${i}.${ext}`;
			const ok = await videoExists(url);
			if(ok){ found = url; break; }
		}
		if(found){ results.push(found); }
		else break; // stop at first gap
	}
	return results;
}

async function probeSequentialSounds(base, maxCount){
	const results = [];
	const exts = ['ogg','OGG','mp3','MP3','wav','WAV']; // prefer ogg; accept common fallbacks
	for(let i=0;i<maxCount;i++){
		let found = null;
		for(const ext of exts){
			const url = `${base}${i}.${ext}`;
			const ok = await audioExists(url);
			if(ok){ found = url; break; }
		}
		if(found){ results.push(found); }
		else break; // stop at first gap
	}
	return results;
}

function audioExists(src, timeoutMs=3000){
	return new Promise((resolve)=>{
		const a = new Audio();
		let done = false;
		const to = setTimeout(()=>{ if(!done){ done=true; cleanup(); resolve(false); } }, timeoutMs);
		function cleanup(){ try{ a.pause(); a.src = ''; }catch(_){} clearTimeout(to); }
		a.preload = 'metadata';
		a.onloadedmetadata = ()=>{ if(!done){ done=true; cleanup(); resolve(true); } };
		a.onerror = ()=>{ if(!done){ done=true; cleanup(); resolve(false); } };
		a.src = src;
	});
}

function videoExists(src, timeoutMs=3000){
	return new Promise((resolve)=>{
		const v = document.createElement('video');
		let done = false;
		const to = setTimeout(()=>{ if(!done){ done=true; cleanup(); resolve(false); } }, timeoutMs);
		function cleanup(){
			v.removeAttribute('src');
			try{ v.load(); }catch(_){ }
			clearTimeout(to);
		}
		v.preload = 'metadata';
		v.onloadedmetadata = ()=>{ if(!done){ done=true; cleanup(); resolve(true); } };
		v.onerror = ()=>{ if(!done){ done=true; cleanup(); resolve(false); } };
		v.src = src;
	});
}

// Lightbox modal
function ensureLightboxRoot(){
	let lb = document.getElementById('lightbox');
	if(lb) return lb;
	lb = document.createElement('div');
	lb.id = 'lightbox';
	lb.className = 'lightbox';
	lb.innerHTML = `
		<div class="lightbox__backdrop" data-role="backdrop"></div>
		<div class="lightbox__panel">
			<div class="lightbox__stage">
				<button class="lightbox__nav lightbox__nav--prev" aria-label="Previous">◀</button>
				<img class="lightbox__img" alt="preview" />
				<button class="lightbox__nav lightbox__nav--next" aria-label="Next">▶</button>
				<button class="lightbox__close" aria-label="Close">×</button>
			</div>
		</div>`;
	document.body.appendChild(lb);
	return lb;
}

function openLightbox(slides, startIdx){
	const lb = ensureLightboxRoot();
	const img = lb.querySelector('.lightbox__img');
	const prev = lb.querySelector('.lightbox__nav--prev');
	const next = lb.querySelector('.lightbox__nav--next');
	const close = lb.querySelector('.lightbox__close');
	const backdrop = lb.querySelector('[data-role="backdrop"]');

	let idx = startIdx||0;
	function cleanupMedia(){
		const stage = lb.querySelector('.lightbox__stage');
		const v = stage.querySelector('video');
		if(v){ v.pause(); v.removeAttribute('src'); try{ v.load(); }catch(_){} v.remove(); }
		const a = stage.querySelector('audio');
		if(a){ a.pause(); a.removeAttribute('src'); try{ a.load(); }catch(_){} a.remove(); }
		const f = stage.querySelector('iframe');
		if(f){ f.src = 'about:blank'; f.remove(); }
		img.src = '';
		img.style.display = 'none';
	}
	function render(){
		cleanupMedia();
		const stage = lb.querySelector('.lightbox__stage');
		const cur = slides[idx];
		if(cur.type === 'image'){
			img.src = cur.src;
			img.style.display = '';
		} else if (cur.type === 'video'){
			const v = document.createElement('video');
			v.className = 'lightbox__video';
			v.controls = true;
			v.autoplay = true;
			v.muted = false; // allow audio playback
			v.playsInline = true;
			const src = document.createElement('source');
			src.src = cur.src;
			src.type = cur.src.endsWith('.webm') ? 'video/webm' : 'video/mp4';
			v.appendChild(src);
			stage.insertBefore(v, img); // keep image node for reuse
			// Pause global BGM if it's currently playing
			pauseBgmIfPlaying();
			v.addEventListener('play', () => pauseBgmIfPlaying(), { once: true });
			// Try to start; some browsers require user gesture but opening modal is user-initiated
			v.play?.().catch(()=>{});
			v.focus();
		} else if (cur.type === 'audio'){
			const a = document.createElement('audio');
			a.controls = true;
			a.autoplay = true;
			a.preload = 'auto';
			a.style.width = 'min(480px, 80vw)';
			const src = document.createElement('source');
			src.src = cur.src;
			src.type = cur.src.endsWith('.ogg') ? 'audio/ogg' : (cur.src.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav');
			a.appendChild(src);
			stage.insertBefore(a, img);
			pauseBgmIfPlaying();
			a.addEventListener('play', () => pauseBgmIfPlaying(), { once: true });
			a.play?.().catch(()=>{});
			a.focus();
		} else if (cur.type === 'embed'){
			const url = cur.src;
			const ifr = document.createElement('iframe');
			ifr.width = '100%';
			ifr.height = '100%';
			// Configure iframe permissions
			ifr.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
			ifr.allowFullscreen = true;
			ifr.style.border = '0';
			try{
				const host = location.hostname || 'localhost';
				let embedUrl = url;
				// Twitch clip
				const twMatch = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
				if(twMatch){
					const clip = twMatch[1];
					const parents = [host];
					if(host !== 'localhost') parents.push('localhost');
					if(host !== '127.0.0.1') parents.push('127.0.0.1');
					const parentQs = parents.map(p => `parent=${encodeURIComponent(p)}`).join('&');
					embedUrl = `https://clips.twitch.tv/embed?clip=${clip}&${parentQs}&autoplay=true&muted=false`;
				} else {
					// YouTube watch, short, or youtu.be
					let ytId = null;
					const m1 = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
					const m2 = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
					const m3 = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/);
					ytId = (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || null;
					if(ytId){
						embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&mute=0&playsinline=1`;
					}
				}
				ifr.src = embedUrl;
			}catch{
				ifr.src = url;
			}
			stage.insertBefore(ifr, img);
			pauseBgmIfPlaying();
		}
	}
	function go(delta){ idx = (idx + delta + slides.length) % slides.length; render(); }
	function onKey(e){
		if(!lb.classList.contains('is-open')) return;
		if(e.key === 'Escape') closeLb();
		if(e.key === 'ArrowLeft') go(-1);
		if(e.key === 'ArrowRight') go(1);
	}
	function closeLb(){
		// stop and cleanup any playing media
		cleanupMedia();
		lb.classList.remove('is-open');
		document.body.style.overflow = '';
		window.removeEventListener('keydown', onKey);
		if(backdrop) backdrop.onclick = null;
	}

	prev.onclick = () => go(-1);
	next.onclick = () => go(1);
	close.onclick = closeLb;
	backdrop.onclick = closeLb;
	window.addEventListener('keydown', onKey);

		render();
	lb.classList.add('is-open');
	document.body.style.overflow = 'hidden';
}
