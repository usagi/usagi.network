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
	try{
		const res = await fetch('/assets/views/stream.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load stream.html: ${res.status}`);
		view.innerHTML = await res.text();
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load stream page.</p>';
	}
}

export function unmount(){ /* no-op */ }
export default { mount, unmount };
