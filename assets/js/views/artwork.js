// assets/js/views/artwork.js
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
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load Artwork page.</p>';
	}
}

export function unmount(){ /* no-op */ }
export default { mount, unmount };
