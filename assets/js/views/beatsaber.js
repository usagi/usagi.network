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
	} catch (err){
		console.error(err);
		view.innerHTML = '<p>Failed to load Beat Saber page.</p>';
	}
}

export function unmount(){ /* no-op */ }
export default { mount, unmount };
