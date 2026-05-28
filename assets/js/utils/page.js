export function initIndexNav(root)
{
 const links = root.querySelectorAll('.index-nav a[href^="#"]');
 links.forEach(link =>
 {
  link.addEventListener('click', (e) =>
  {
   e.preventDefault();
   const id = (link.getAttribute('href') || '').replace(/^#/, '');
   if (!id) return;
   const target = root.querySelector(`#${escapeSelectorId(id)}`);
   if (!target) return;
   const topbar = document.querySelector('.topbar');
   const offset = topbar ? (topbar.getBoundingClientRect().height + 10) : 70;
   const y = target.getBoundingClientRect().top + window.scrollY - offset;
   window.scrollTo({ top: y, behavior: 'smooth' });
  });
 });
}

export function initImageLightbox(root, options = {})
{
 const viewer = root.querySelector(options.viewerSelector || '#artwork-viewer');
 const image = viewer?.querySelector(options.imageSelector || '.artwork-viewer__img');
 const title = viewer?.querySelector(options.titleSelector || '.artwork-viewer__title');
 const closeTargets = viewer?.querySelectorAll(options.closeSelector || '.artwork-viewer__close, .artwork-viewer__backdrop') || [];
 const itemSelector = options.itemSelector || '[data-full]';
 const items = [...root.querySelectorAll(itemSelector)];
 let index = 0;

 const show = (nextIndex) =>
 {
  if (!viewer || !image || !title || !items.length) return;
  index = (nextIndex + items.length) % items.length;
  const item = items[index];
  image.src = item.getAttribute('data-full') || '';
  image.alt = item.getAttribute('data-title') || 'Artwork';
  title.textContent = item.getAttribute('data-title') || '';
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
 };
 const close = () =>
 {
  if (!viewer) return;
  viewer.hidden = true;
  if (image) image.src = '';
  document.body.style.overflow = '';
 };
 const onKey = (e) =>
 {
  if (!viewer || viewer.hidden) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') show(index - 1);
  if (e.key === 'ArrowRight') show(index + 1);
 };

 closeTargets.forEach(el => el.addEventListener('click', close));
 items.forEach((item, itemIndex) => item.addEventListener('click', () => show(itemIndex)));
 window.addEventListener('keydown', onKey);
 return () =>
 {
  window.removeEventListener('keydown', onKey);
  close();
 };
}

function escapeSelectorId(id)
{
 return CSS?.escape ? CSS.escape(id) : id;
}
