// assets/js/views/about.js
// URTS/ロドス人事資料風の静的ページを描画

function showOnly(viewName)
{
 const app = document.getElementById("app");
 if (!app) return;
 const hero = app.querySelector(".hero");
 if (hero) hero.classList.toggle('is-hidden', viewName !== "home"); // Aboutはheroを隠す
 const views = app.querySelectorAll('[data-view]');
 views.forEach(v => v.classList.toggle('is-hidden', v.dataset.view !== viewName));
}

async function renderAbout()
{
	let view = document.querySelector('[data-view="about"]');
	if (!view)
	{
		view = document.createElement('section');
		view.className = 'view';
		view.dataset.view = 'about';
		document.getElementById('app')?.appendChild(view);
	}
	view.classList.remove('is-hidden');
	try {
		const res = await fetch('/assets/views/about.html', { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load about.html: ${res.status}`);
		const html = await res.text();
		view.innerHTML = html;
	} catch (err) {
		console.error(err);
		view.innerHTML = '<p>Failed to load content.</p>';
	}
}

export async function mount()
{
 showOnly('about');
 renderAbout();
}

export function unmount()
{
 console.log("Unmounting about view");
 const view = document.querySelector('[data-view="about"]');
 if (view) view.remove();

}

export default { mount, unmount };
