// assets/js/views/beatsaber-terms.js
// Wire up Terms of Use overlay: docs button opens, accept enables downloads for that item
(function(){
  const view = document.querySelector('[data-view="beatsaber"]') || document;
  const terms = () => document.getElementById('terms');
  const termsItem = () => document.getElementById('terms-item');
  const termsBody = () => document.getElementById('terms-body');
  const btnAccept = () => document.getElementById('terms-accept');
  const btnCancel = () => document.getElementById('terms-cancel');

  // track acceptance per item in sessionStorage
  const KEY = 'usn:terms-accepted';
  function readState(){
    try{ return JSON.parse(sessionStorage.getItem(KEY) || '{}'); }catch{ return {}; }
  }
  function writeState(s){ try{ sessionStorage.setItem(KEY, JSON.stringify(s)); }catch{}
  }
  function isAccepted(id){ return !!readState()[id]; }
  function setAccepted(id){ const s = readState(); s[id] = true; writeState(s); }

  function updateDownloadButtons(){
    view.querySelectorAll('.js-dl[data-item]')?.forEach(btn => {
      const id = btn.getAttribute('data-item');
      if(!id) return;
      if(isAccepted(id)){
        btn.removeAttribute('aria-disabled');
      } else {
        btn.setAttribute('aria-disabled', 'true');
      }
    });
  }

  // Build resource paths based on folder layout
  function buildPaths(a){
    const cat = a.getAttribute('data-cat');
    const item = (a.getAttribute('data-item') || '').trim(); // e.g., vulpisfoglia
    const title = (a.getAttribute('data-title') || '').trim(); // e.g., Vulpisfoglia.saber
  const base = `/assets/beatsaber/${cat}/${item}/`;
  const baseRoots = [base];
    const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    const titleLc = title.toLowerCase();
    const itemCap = cap(item);
    // Build candidate basenames for markdown
    const mdNames = [];
    const nameBases = [];
    if(title){ nameBases.push(title, titleLc); }
    nameBases.push(`${item}.saber`, `${itemCap}.saber`, item, itemCap);
    const exts = ['term.md','term.MD','md','MD','markdown'];
    for(const b of nameBases){
      for(const e of exts){ mdNames.push(`${b}.${e}`); }
    }
    // de-dup basenames
    const seen = new Set();
    const uniqNames = mdNames.filter(n => (seen.has(n) ? false : (seen.add(n), true)));
    // zip name candidates
    const zipNames = [
      `${item}.zip`, `${itemCap}.zip`,
      `${item}.saber.zip`, `${itemCap}.saber.zip`,
      title ? `${title}.zip` : null,
      title ? `${titleLc}.zip` : null
    ].filter(Boolean);
    const zipCandidates = baseRoots.flatMap(br => zipNames.map(name => br + name));
    const mdCandidates = baseRoots.flatMap(br => uniqNames.map(name => br + name));
    return { zipCandidates, mdCandidates, baseRoots };
  }

  async function fetchMarkdown(url){
    try{
      const res = await fetch(url, { cache: 'no-store', headers: { 'Accept': 'text/markdown, text/plain;q=0.9, */*;q=0.1' } });
      if(!res.ok) return null;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const text = await res.text();
      // If server rewrites unknown files to index.html, avoid injecting it
      const looksHtml = /<(?:!doctype|html|head|body|nav|main)\b/i.test(text);
      if(looksHtml && !/markdown|plain/.test(ct)) return null;
      return text;
    }catch{ return null; }
  }

  function renderMarkdownToHtml(md){
    if(!md) return '<p>Terms file not found.</p>';
    const escapeHtml = (s) => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    const lines = md.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    let inCode = false; let codeLang = ''; let codeLines = [];
    // stack of open lists; each: { type: 'ul'|'ol', hasOpenLi: boolean }
    const stack = [];

    const inline = (s) => {
      s = escapeHtml(s);
      s = s.replace(/`([^`]+)`/g, (m, g1) => `<code>${g1}</code>`);
      s = s.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      s = s.replace(/\*(.*?)\*/g, '<i>$1</i>');
      return s.trim();
    };
    const flushPara = () => {
      if(para.length){ out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    };
    const closeToDepth = (target) => {
      while(stack.length > target){
        const top = stack[stack.length-1];
        if(top.hasOpenLi){ out.push('</li>'); top.hasOpenLi = false; }
        out.push(top.type === 'ol' ? '</ol>' : '</ul>');
        stack.pop();
      }
    };
    const ensureListAtDepth = (depth, type) => {
      // open lists until reaching desired depth
      while(stack.length < depth){
        out.push(type === 'ol' ? '<ol>' : '<ul>');
        stack.push({ type, hasOpenLi: false });
      }
      // if type differs at this depth, replace the list
      if(stack.length && stack[stack.length-1].type !== type){
        closeToDepth(stack.length-1);
        out.push(type === 'ol' ? '<ol>' : '<ul>');
        stack.push({ type, hasOpenLi: false });
      }
    };
    const startListItem = (content) => {
      const top = stack[stack.length-1];
      if(top.hasOpenLi){ out.push('</li>'); top.hasOpenLi = false; }
      out.push(`<li>${inline(content)}`);
      top.hasOpenLi = true;
    };
    const flushCode = () => {
      if(inCode){
        const code = escapeHtml(codeLines.join('\n'));
        const cls = codeLang ? ` class="language-${codeLang}"` : '';
        out.push(`<pre><code${cls}>${code}</code></pre>`);
        inCode = false; codeLang=''; codeLines=[];
      }
    };

    for(const raw of lines){
      const fence = raw.match(/^```(.*)$/);
      if(fence){
        if(!inCode){ flushPara(); inCode = true; codeLang = (fence[1]||'').trim(); }
        else { flushCode(); }
        continue;
      }
      if(inCode){ codeLines.push(raw); continue; }

      // Preserve leading spaces to determine nesting
      const mUl = raw.match(/^(\s*)([-*+])\s+(.*)$/);
      const mOl = raw.match(/^(\s*)(\d+)\.\s+(.*)$/);

      if(mUl || mOl){
        flushPara();
        const indent = (mUl ? mUl[1] : mOl[1]).replace(/\t/g, '    ').length;
        const depth = Math.floor(indent / 2) + 1; // 2 spaces per level
        const type = mUl ? 'ul' : 'ol';
        const content = (mUl ? mUl[3] : mOl[3]).trim();

        ensureListAtDepth(depth, type);
        startListItem(content);
        continue;
      }

      const line = raw.trim();
      if(!line){ flushPara(); continue; }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if(h){
        flushPara();
        // headings outside of lists for simplicity
        closeToDepth(0);
        const level = Math.min(6, h[1].length);
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
        continue;
      }

      if(stack.length){
        // paragraph inside current list item
        out.push(`<p>${inline(line)}</p>`);
      } else {
        para.push(line);
      }
    }
    flushCode(); flushPara(); closeToDepth(0);
    return out.join('\n');
  }

  async function openTermsForLink(a){
    const t = terms(); if(!t) return;
    const id = a.getAttribute('data-item');
    const title = a.getAttribute('data-title') || id;
    const label = termsItem(); if(label) label.textContent = title;
    // remember the raw id for acceptance
    t.dataset.item = id || '';
    // show modal immediately with loading state
    if(!document.querySelector('.modal-backdrop')){
      const bd = document.createElement('div');
      bd.className = 'modal-backdrop';
      // Prevent background interaction without forcing scrollbar hide
      bd.addEventListener('wheel', (e)=>e.preventDefault(), { passive:false });
      bd.addEventListener('touchmove', (e)=>e.preventDefault(), { passive:false });
      document.body.appendChild(bd);
    }
    // Lock scroll with scrollbar compensation to avoid layout shift
    try{
      const sw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.body.dataset._sbw = String(sw);
      if(sw) document.body.style.paddingRight = sw + 'px';
      document.body.style.overflow = 'hidden';
    }catch{}
    const body = termsBody();
  try {
      if(body){
        let mdBox = body.querySelector('.md');
        if(!mdBox){
          mdBox = document.createElement('div');
          mdBox.className = 'md';
          const controls = body.querySelector('.feature__actions');
          if(controls){ body.insertBefore(mdBox, controls); } else { body.appendChild(mdBox); }
        }
    // Hide fallback list while loading; will re-show only if fetch fails
    const fallback = body.querySelector('ol.list');
    if(fallback) fallback.hidden = true;
    mdBox.setAttribute('role', 'article');
    mdBox.innerHTML = '<p>Loading terms…</p>';
      }
    } catch {}
    t.hidden = false;

    // fetch and render markdown asynchronously
    try {
      const { mdCandidates } = buildPaths(a);
      let text = null;
      for(const url of mdCandidates){
        try{
          text = await fetchMarkdown(url);
          console.debug('[Terms] tried:', url, '=>', text ? 'OK' : 'MISS');
        }catch{}
        if(text) { break; }
      }
      if(body){
        const mdBox = body.querySelector('.md');
        const fallback = body.querySelector('ol.list');
        if(text && mdBox){
          mdBox.innerHTML = renderMarkdownToHtml(text);
          if(fallback) fallback.remove();
        } else {
          if(fallback) fallback.hidden = false;
          if(mdBox) mdBox.remove();
        }
      }
    } catch {}
  }

  // On initial load, resolve actual zip filenames and set download attribute to match source
  (async function resolveZipFilenames(){
    const anchors = Array.from(view.querySelectorAll('.js-dl[data-item][data-cat]'));
    await Promise.all(anchors.map(async (a) => {
      const cat = a.getAttribute('data-cat');
      const item = a.getAttribute('data-item');
      if(!cat || !item) return;
      // If author specified exact zip name, respect it
      const explicit = a.getAttribute('data-zip');
      if(explicit){
        const url = `/assets/beatsaber/${cat}/${item}/${explicit}`;
        try{
          const head = await fetch(url, { method:'HEAD', cache:'no-store' });
          if(head.ok){ a.setAttribute('href', url); a.setAttribute('download', explicit); return; }
        }catch{}
        // If HEAD fails, continue to generic candidates below
      }
      const { zipCandidates } = buildPaths(a);
      for(const url of zipCandidates){
        try{
          const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
          if(res.ok){
            a.setAttribute('href', url);
            try {
              const name = url.split('/').pop();
              if(name) a.setAttribute('download', name);
            }catch{}
            return; // found
          }
        }catch{}
      }
    }));
  })();
  function closeTerms(){
    const t = terms(); if(t) t.hidden = true;
    const bd = document.querySelector('.modal-backdrop'); if(bd) bd.remove();
    // Restore scroll state
    try{
      document.body.style.overflow = '';
      const sw = parseInt(document.body.dataset._sbw || '0', 10) || 0;
      if(sw) document.body.style.paddingRight = '';
      delete document.body.dataset._sbw;
    }catch{}
  }

  // Hook Docs buttons to open overlay
  view.addEventListener('click', (e) => {
    const a = e.target.closest?.('[data-role="docs"], .js-docs');
    if(!a) return;
    e.preventDefault();
    openTermsForLink(a);
  });

  // Accept / Cancel
  document.addEventListener('click', (e) => {
    if(e.target?.id === 'terms-accept'){
      const id = document.getElementById('terms')?.dataset?.item || '';
      if(id){ setAccepted(id); updateDownloadButtons(); }
      closeTerms();
    } else if(e.target?.id === 'terms-cancel' || e.target?.closest?.('.detail__close')){
      e.preventDefault();
      closeTerms();
    }
  });

  // Initialize button states on first load
  updateDownloadButtons();
  // href は beatsaber.js で初期設定済み。最終的な正しいファイル名は下の resolver で上書きします。
  // Block clicks on disabled downloads
  view.addEventListener('click', (e) => {
    const a = e.target.closest?.('.js-dl[aria-disabled="true"]');
    if(a){ e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
