// assets/js/views/artwork.js
import { initImageLightbox, initIndexNav } from '#utils/page.js?v=20260619';

function ensureSection(){
	let view = document.querySelector('[data-view="artwork"]');
	if (!view){
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'artwork';
		document.getElementById('app')?.appendChild(view);
	}
	return view;
}

export async function mount(){
	const view = ensureSection();
	try{
		const res = await fetch('/assets/views/artwork.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load artwork.html: ${res.status}`);
		view.innerHTML = await res.text();
		const data = await fetchArtworkData();
		renderArtwork(view, data);
		initIndexNav(view);
		cleanupArtwork = initImageLightbox(view);
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load Artwork page.</p>';
	}
}

export function unmount(){
	cleanupArtwork?.();
	cleanupArtwork = null;
}
export default { mount, unmount };

let cleanupArtwork = null;

async function fetchArtworkData()
{
	const res = await fetch('/assets/data/artwork.json', { cache: 'no-store' });
	if (!res.ok) throw new Error(`Failed to load artwork.json: ${res.status}`);
	return await res.json();
}

function renderArtwork(view, data)
{
	const index = view.querySelector('.index-nav');
	const root = view.querySelector('[data-artwork-root]');
	if (!index || !root) return;
	root.innerHTML = '';
	(data.groups || []).forEach(group =>
	{
		const id = group.id || slugify(group.title);
		const link = document.createElement('a');
		link.className = 'btn';
		link.href = `#${id}`;
		link.textContent = group.title;
		index.appendChild(link);

		const section = document.createElement('section');
		section.id = id;
		section.className = 'strip';
		section.setAttribute('aria-labelledby', `${id}-title`);
		section.innerHTML = `<h3 class="strip__title" id="${id}-title">${escapeHtml(group.title)}</h3>`;
		if (group.layout === 'showcase')
		{
			section.appendChild(renderShowcase(group.items || [], data.cacheVersion));
		} else
		{
			const grid = document.createElement('div');
			grid.className = `artwork-grid${String(group.layout || '').includes('refs') ? ' artwork-grid--refs' : ''}`;
			grid.setAttribute('role', 'list');
			(group.items || []).forEach(item => grid.appendChild(renderArtworkCard(item, data.cacheVersion)));
			section.appendChild(grid);
		}
		root.appendChild(section);
	});
}

function renderShowcase(items, version)
{
	const showcase = document.createElement('div');
	showcase.className = 'artwork-showcase';
	const hero = items.find(item => item.hero) || items[0];
	const rest = items.filter(item => item !== hero);
	if (hero) showcase.appendChild(renderArtworkCard(hero, version, true));
	const grid = document.createElement('div');
	grid.className = 'artwork-grid';
	grid.setAttribute('role', 'list');
	rest.forEach(item => grid.appendChild(renderArtworkCard(item, version)));
	showcase.appendChild(grid);
	return showcase;
}

function renderArtworkCard(item, version, forceHero = false)
{
	const src = withVersion(item.src, version);
	const button = document.createElement('button');
	button.type = 'button';
	button.className = forceHero || item.hero ? 'artwork-hero' : `artwork-card${item.wide ? ' artwork-card--wide' : ''}`;
	button.setAttribute('role', 'listitem');
	button.dataset.full = src;
	button.dataset.title = item.title || 'Artwork';
	if (forceHero || item.hero) button.setAttribute('aria-label', `Open ${item.title || 'Artwork'}`);
	button.innerHTML = `
		<img src="${escapeAttr(src)}" alt="${escapeAttr(item.title || 'Artwork')}" loading="lazy" decoding="async">
		<span class="${forceHero || item.hero ? 'artwork-hero__label' : ''}">${escapeHtml(item.title || '')}</span>`;
	return button;
}

function withVersion(src, version)
{
	if (!src || !version) return src || '';
	return `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

function slugify(value)
{
	return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(str)
{
	return String(str || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function escapeAttr(str)
{
	return escapeHtml(str);
}
