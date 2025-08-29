// Adjust main content top padding based on fixed header height
function setAppTopPadding(){
	try{
		const bar = document.querySelector('.topbar');
		const app = document.getElementById('app');
		if(!bar || !app) return;
		const h = Math.round(bar.getBoundingClientRect().height) + 16; // header height + default gap
		app.style.setProperty('--app-pt', `${h}px`);
	}catch{}
}

function initLayoutTweaks(){
	setAppTopPadding();
	window.addEventListener('resize', setAppTopPadding);
}

if (document.readyState === 'loading'){
	window.addEventListener('DOMContentLoaded', initLayoutTweaks, { once: true });
} else {
	initLayoutTweaks();
}
