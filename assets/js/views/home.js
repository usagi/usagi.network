// assets/js/views/home.js
import { fetchLatestActivity } from '#api/aggregate-latest.js';
import { SOURCES } from '#api/config.js';

export async function mount(){
	console.log('Home page mounted');
	const grid = document.getElementById('latest-grid');
	if (!grid) return;
	grid.innerHTML = '';
	// Try to render subtle live embed if streaming now
	setupHeroLive().catch(() => {});
	// Start subtle ambient background + Life animation
	startHeroAmbient().catch(() => {});
	startHeroLife().catch(() => {});
	try{
		const items = await fetchLatestActivity();
		if (items.length === 0){
			appendNotice(grid);
			return;
		}
		items.forEach((it) => grid.appendChild(renderLatestCard(it)));
	} catch (e){
		console.warn('Latest load failed', e);
		appendNotice(grid);
	}
}

function renderLatestCard(it){
	const a = document.createElement('article');
	const cutClass = it.kind === 'clip' ? 'card--clip' : it.kind === 'vod' ? 'card--vod' : 'card--map';
	a.className = `card ${cutClass}`;
	const tag = it.kind === 'clip' ? 'Clip' : it.kind === 'vod' ? 'VOD' : (it.provider === 'youtube' ? 'YouTube' : 'Archive');
	a.innerHTML = `
		<div class="card__cut"></div>
		${it.thumbnail ? `<img class="card__thumb" src="${it.thumbnail}" alt="">` : ''}
		<div class="card__body">
			<span class="card__tag">${tag}</span>
			<h3 class="card__title">${escapeHtml(it.title)}</h3>
			<div class="card__date">${it.date || ''}</div>
		</div>
	`;
	return a;
}

function appendNotice(grid){
	const card = document.createElement('article');
	card.className = 'card card--map';
	card.innerHTML = `
		<div class="card__cut"></div>
		<div class="card__body">
			<span class="card__tag">お知らせ</span>
			<h3 class="card__title">USAGI.NETWORK 公式ウェブサイトの再建が進行中です。自動更新コンテンツは準備中。</h3>
			<div class="card__date">${new Date().toISOString().slice(0,10)}</div>
		</div>
	`;
	grid.appendChild(card);
}

function escapeHtml(str){
	return String(str)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
export function unmount()
{
 // 必要ならイベント解除・DOM掃除
 try { __lifeStop?.(); __lifeStop = null; } catch {}
 try { __ambientStop?.(); __ambientStop = null; } catch {}
}
export default { mount, unmount };

// --- Hero live widget (Twitch Embed JS API, event-driven ONLINE/OFFLINE) ---
async function setupHeroLive(){
	const el = document.getElementById('hero-live');
	if(!el) return;
	const channel = SOURCES.twitch?.channel || 'usaginetwork';
	// Load Twitch embed JS if needed
	if(!(window.Twitch && window.Twitch.Player)){
		await new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = 'https://player.twitch.tv/js/embed/v1.js';
			s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
		}).catch(() => {});
	}
	if(!(window.Twitch && window.Twitch.Player)) return;
	// Ensure container is empty and hidden initially
	el.classList.remove('is-active');
	el.setAttribute('aria-hidden', 'true');
	el.innerHTML = '';
	const host = location.hostname || 'localhost';
	const parents = [host];
	if(host !== 'localhost') parents.push('localhost');
	if(host !== '127.0.0.1') parents.push('127.0.0.1');
	// Instantiate player into the existing container element by id
	const player = new window.Twitch.Player('hero-live', {
		channel,
		width: '100%',
		height: '100%',
		parent: parents,
		autoplay: true,
		muted: true,
		theme: 'dark',
	});
	// When stream goes online: show panel and pause site BGM
	player.addEventListener(window.Twitch.Player.ONLINE, () => {
		el.classList.add('is-active');
		el.removeAttribute('aria-hidden');
		import('#utils/bgm.js').then(m => m.pauseIfPlaying?.()).catch(()=>{});
	});
	// When stream goes offline: hide panel
	player.addEventListener(window.Twitch.Player.OFFLINE, () => {
		el.classList.remove('is-active');
		el.setAttribute('aria-hidden', 'true');
	});
}

	// --- Hero Game of Life (subtle, glowing) ---
	let __lifeStop = null;
	async function startHeroLife(){
		try{
			const cvs = document.getElementById('hero-life');
			if(!cvs) return;
			const hero = cvs.closest('.hero');
			const ctx = cvs.getContext('2d', { alpha: true });
			if(!ctx || !hero) return;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const prefersReduce = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
			function resize(){
				const r = hero.getBoundingClientRect();
				cvs.width = Math.floor(r.width * dpr);
				cvs.height = Math.floor(r.height * dpr);
				cvs.style.width = r.width + 'px';
				cvs.style.height = r.height + 'px';
			}

			// --- Hero Ambient (flowing metaball-like blobs) ---
			let __ambientStop = null;
			async function startHeroAmbient(){
				try{
					const cvs = document.getElementById('hero-ambient');
					if(!cvs) return;
					const hero = cvs.closest('.hero');
					const ctx = cvs.getContext('2d', { alpha: true });
					if(!ctx || !hero) return;
					const dpr = Math.min(2, window.devicePixelRatio || 1);
					const prefersReduce = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
					function resize(){
						const r = hero.getBoundingClientRect();
						cvs.width = Math.floor(r.width * dpr);
						cvs.height = Math.floor(r.height * dpr);
						cvs.style.width = r.width + 'px';
						cvs.style.height = r.height + 'px';
					}
					resize();
					let rafId = 0;
					const blobCount = prefersReduce ? 5 : 9;
					const blobs = [];
					for(let i=0;i<blobCount;i++){
						blobs.push({
							x: Math.random()*cvs.width,
							y: Math.random()*cvs.height,
							r: (Math.random()*120 + 120) * dpr,
							vx: (Math.random()*0.5 - 0.25)*dpr,
							vy: (Math.random()*0.4 - 0.2)*dpr,
							hue: 190 + Math.random()*30,
						});
					}
					function step(){
						for(const b of blobs){
							b.x += b.vx; b.y += b.vy;
							if(b.x < -b.r) { b.x = cvs.width + b.r*0.5; }
							if(b.x > cvs.width + b.r) { b.x = -b.r*0.5; }
							if(b.y < -b.r) { b.y = cvs.height + b.r*0.5; }
							if(b.y > cvs.height + b.r) { b.y = -b.r*0.5; }
						}
					}
					function draw(t){
						ctx.clearRect(0,0,cvs.width,cvs.height);
						if(!prefersReduce){ ctx.filter = 'blur(24px)'; }
						ctx.globalCompositeOperation = 'lighter';
						for(const b of blobs){
							const a = 0.06 + 0.04*Math.sin((t/4000) + b.x*0.0008 + b.y*0.0006);
							const c1 = `hsla(${b.hue}, 90%, 52%, ${a})`;
							const c2 = `hsla(${b.hue+20}, 80%, 46%, ${a*0.9})`;
							const g = ctx.createRadialGradient(b.x, b.y, b.r*0.1, b.x, b.y, b.r);
							g.addColorStop(0, c1);
							g.addColorStop(1, c2);
							ctx.fillStyle = g;
							ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
						}
						ctx.filter = 'none';
						ctx.globalCompositeOperation = 'source-over';
					}
					let last=0, acc=0; const intv = prefersReduce ? 60 : 30; // ~fps tick for step
					function tick(ts){ if(!last) last=ts; const dt=ts-last; last=ts; acc+=dt; if(acc>intv){ step(); acc=0; } draw(ts); rafId = requestAnimationFrame(tick); }
					rafId = requestAnimationFrame(tick);
					const onResize = () => { cancelAnimationFrame(rafId); resize(); rafId = requestAnimationFrame(tick); };
					window.addEventListener('resize', onResize);
					__ambientStop = () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); ctx.clearRect(0,0,cvs.width,cvs.height); };
				}catch{}
			}
			resize();
			let rafId = 0;
			const cellSize = prefersReduce ? 10 : 8; // px at CSS pixel
			const w = () => Math.floor(cvs.width / (cellSize * dpr));
			const h = () => Math.floor(cvs.height / (cellSize * dpr));
			let grid = new Uint8Array(w()*h());
			function seed(){
				for(let i=0;i<grid.length;i++) grid[i] = Math.random() < 0.18 ? 1 : 0;
			}
			function idx(x,y){ return y*w()+x; }
			function step(){
				const nw = w(), nh = h();
				const next = new Uint8Array(nw*nh);
				for(let y=0;y<nh;y++){
					for(let x=0;x<nw;x++){
						let n=0;
						for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(dx||dy){
							const xx=(x+dx+nw)%nw, yy=(y+dy+nh)%nh; n += grid[idx(xx,yy)];
						}
						const alive = grid[idx(x,y)]===1;
						next[idx(x,y)] = (alive && (n===2||n===3)) || (!alive && n===3) ? 1 : 0;
					}
				}
				grid = next;
			}
			// Offscreen accumulation for trails
			const accum = document.createElement('canvas');
			const actx = accum.getContext('2d', { alpha: true });
			function sizeAccum(){ accum.width = cvs.width; accum.height = cvs.height; }
			sizeAccum();

			// Simple pseudo-noise (sum of sines)
			function snoise(x,y,t){
				return (
					Math.sin(x*0.9 + t*0.0008) +
					Math.sin(y*1.1 + t*0.0011) +
					Math.sin((x+y)*0.5 + t*0.0006)
				)/3; // -1..1
			}
			// Gradient mapper (cyan→amber range)
			function colorAt(u){ // u: 0..1
				const hue = 190 + 30*u + 20*Math.sin(u*6.283);
				const sat = 85;
				const light = 50 + 10*u;
				return `hsla(${hue}, ${sat}%, ${light}%, 0.9)`;
			}
			// Tiny bokeh particles
			const particles = []; const pCount = prefersReduce ? 0 : 24;
			for(let i=0;i<pCount;i++){
				particles.push({
					x: Math.random()*cvs.width,
					y: Math.random()*cvs.height,
					r: (Math.random()*8+6)*dpr,
					vx: (Math.random()*0.4-0.2)*dpr,
					vy: (Math.random()*0.3-0.15)*dpr,
					a: Math.random()*0.15 + 0.06,
				});
			}

			function draw(t){
				const nw=w(), nh=h();
				const cs = cellSize * dpr;
				const wave = (Math.sin(t/1800)+1)/2; // 0..1
				// fade the accumulation slightly
				actx.globalCompositeOperation = 'source-over';
				actx.fillStyle = prefersReduce ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)';
				actx.fillRect(0,0,accum.width,accum.height);
				// draw alive cells to accumulation with gradient + noise modulation
				for(let y=0;y<nh;y++){
					for(let x=0;x<nw;x++){
						if(grid[idx(x,y)]){
							const nx = x/nw * 12, ny = y/nh * 12;
							const n = (snoise(nx,ny,t)+1)/2; // 0..1
							const u = Math.min(1, Math.max(0, 0.2 + 0.6*wave + 0.4*n));
							actx.fillStyle = colorAt(u);
							actx.fillRect(Math.floor(x*cs), Math.floor(y*cs), Math.ceil(cs-1), Math.ceil(cs-1));
						}
					}
				}
				// Blit accumulation with slight blur to main canvas
				ctx.clearRect(0,0,cvs.width,cvs.height);
				if(!prefersReduce){ ctx.filter = 'blur(1.2px)'; }
				ctx.drawImage(accum, 0, 0);
				ctx.filter = 'none';
				// Caustic diagonal sweeps
				if(!prefersReduce){
					ctx.save();
					ctx.globalCompositeOperation = 'screen';
					ctx.translate(cvs.width*0.3, cvs.height*0.2);
					ctx.rotate(-Math.PI/9);
					const grad = ctx.createLinearGradient(0, -80, 0, 80);
					grad.addColorStop(0, 'rgba(247,211,84,0)');
					grad.addColorStop(0.5, 'rgba(247,211,84,0.06)');
					grad.addColorStop(1, 'rgba(247,211,84,0)');
					ctx.fillStyle = grad; ctx.fillRect(-cvs.width, -2, cvs.width*2, 4);
					ctx.restore();
				}
				// Bokeh particles
				if(particles.length){
					ctx.save();
					ctx.globalCompositeOperation = 'screen';
					for(const p of particles){
						p.x += p.vx; p.y += p.vy;
						if(p.x < -20) p.x = cvs.width+20; if(p.x > cvs.width+20) p.x = -20;
						if(p.y < -20) p.y = cvs.height+20; if(p.y > cvs.height+20) p.y = -20;
						const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
						rg.addColorStop(0, `rgba(0,229,255,${p.a})`);
						rg.addColorStop(1, 'rgba(0,229,255,0)');
						ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
					}
					ctx.restore();
				}
				// Vignette
				ctx.save();
				const vg = ctx.createRadialGradient(cvs.width*0.5, cvs.height*0.55, Math.min(cvs.width,cvs.height)*0.2, cvs.width*0.5, cvs.height*0.55, Math.hypot(cvs.width,cvs.height)*0.6);
				vg.addColorStop(0, 'rgba(0,0,0,0)');
				vg.addColorStop(1, 'rgba(0,0,0,0.18)');
				ctx.fillStyle = vg; ctx.fillRect(0,0,cvs.width,cvs.height);
				ctx.restore();
			}
			let last=0, acc=0;
			function tick(ts){
				if(!last) last=ts; const dt=ts-last; last=ts; acc+=dt;
				if(acc>(prefersReduce? 180 : 100)){ step(); acc=0; }
				draw(ts);
				rafId = requestAnimationFrame(tick);
			}
			seed();
			rafId = requestAnimationFrame(tick);
			const onResize = () => { cancelAnimationFrame(rafId); resize(); sizeAccum(); grid = new Uint8Array(w()*h()); seed(); rafId = requestAnimationFrame(tick); };
			window.addEventListener('resize', onResize);
			__lifeStop = () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); ctx.clearRect(0,0,cvs.width,cvs.height); };
		}catch{}
	}
