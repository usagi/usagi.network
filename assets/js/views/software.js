// assets/js/views/software.js
import { getLatestGitHubVersion } from '#api/github.js?v=20260528';
import { initIndexNav } from '#utils/page.js?v=20260528';

function ensureSection(){
	let view = document.querySelector('[data-view="software"]');
	if (!view){
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'software';
		document.getElementById('app')?.appendChild(view);
	}
	return view;
}

export async function mount(){
	const view = ensureSection();
	try{
		const res = await fetch('/assets/views/software.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load software.html: ${res.status}`);
		view.innerHTML = await res.text();
		const data = await fetchSoftwareData();
		renderSoftware(view, data);
		initIndexNav(view);
		updateReleaseBadges(view).catch(() => { });
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load Software page.</p>';
	}
}

export function unmount(){ /* no-op */ }
export default { mount, unmount };

async function fetchSoftwareData()
{
	const res = await fetch('/assets/data/software.json', { cache: 'no-store' });
	if (!res.ok) throw new Error(`Failed to load software.json: ${res.status}`);
	return await res.json();
}

function renderSoftware(view, data)
{
	const index = view.querySelector('.index-nav');
	const root = view.querySelector('[data-software-root]');
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
		const list = document.createElement('div');
		list.className = 'features';
		list.setAttribute('role', 'list');
		(group.items || []).forEach(item => list.appendChild(renderSoftwareCard(item)));
		section.appendChild(list);
		root.appendChild(section);
	});
}

function renderSoftwareCard(item)
{
	const repoUrl = `https://github.com/${item.repo}`;
	const article = document.createElement('article');
	article.className = 'feature software-feature';
	article.dataset.githubRepo = item.repo || '';
	article.setAttribute('role', 'listitem');
	const specs = (item.specs || []).map(spec => `<span>${escapeHtml(spec)}</span>`).join('');
	article.innerHTML = `
		<div class="feature__media software-media">
			<img class="software-media__shot" src="${escapeAttr(item.media?.screenshot || '')}" alt="${escapeAttr(item.title)} screenshot" loading="lazy" decoding="async">
			<img class="software-media__icon" src="${escapeAttr(item.media?.icon || '')}" alt="" loading="lazy" decoding="async">
		</div>
		<div class="feature__body">
			<div class="feature__meta">
				<span class="tag">${escapeHtml(item.tag || '')}</span>
				<span class="sub">${escapeHtml(item.fallbackVersion || '')}</span>
			</div>
			<h3 class="feature__title">${escapeHtml(item.title)}</h3>
			<p class="feature__desc">${escapeHtml(item.description || '')}</p>
			<div class="software-specs" aria-label="${escapeAttr(item.title)} features">${specs}</div>
			<div class="feature__actions">
				<a class="btn" href="${escapeAttr(repoUrl)}" target="_blank" rel="noopener">Repository</a>
				<a class="btn btn--ghost" href="${escapeAttr(repoUrl)}/releases" target="_blank" rel="noopener" data-role="releases">Releases</a>
			</div>
		</div>`;
	return article;
}

async function updateReleaseBadges(root)
{
	const cards = [...root.querySelectorAll('.software-feature[data-github-repo]')];
	if (!cards.length) return;
	await Promise.all(cards.map(async (card) =>
	{
		const repo = card.getAttribute('data-github-repo');
		if (!repo) return;
		const latest = await getLatestGitHubVersion(repo);
		const sub = card.querySelector('.feature__meta .sub');
		const releases = card.querySelector('[data-role="releases"]');
		if (latest?.version && sub) sub.textContent = `v${latest.version}`;
		if (latest?.url && releases) releases.href = latest.url;
	}));
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
