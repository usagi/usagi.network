// assets/js/views/home.js
import { fetchLatestActivity } from '#api/aggregate-latest.js';

export async function mount(){
	console.log('Home page mounted');
	const grid = document.getElementById('latest-grid');
	if (!grid) return;
	grid.innerHTML = '';
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
}
export default { mount, unmount };
