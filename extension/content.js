(() => {
  'use strict';

  const BASE     = 'https://harry-joyce.github.io/shorts';
  const PLAYER   = `${BASE}/player.html`;
  const MANIFEST = `${BASE}/manifest.json`;

  const SERIES = {
    dlf:  'Daniel: A Lifetime of Faith',
    gnj:  'Good News From Jehovah',
    jcm:  'Jesus—The Greatest Man',
    wcgv: 'Whiteboard Animation',
  };

  function deriveTitle(path) {
    const name   = path.split('/').pop().replace('.mp4', '');
    const prefix = name.split('_')[0].toLowerCase();
    return SERIES[prefix] || name.replace(/_/g, ' ');
  }

  function fmtDur(s) {
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  // ── Detect whether the article has been rendered by JW.org's JS ──
  // The article starts as <article><div class="loadingIndicator"/></article>.
  // It's "ready" once it contains real links — JW.org's rendered sections
  // always have clickable anchors.
  function articleIsReady(article) {
    return article.querySelectorAll('a[href]').length > 2;
  }

  // ── Wait for article content with polling ────────────────────────
  // Simpler and more reliable than MutationObserver for JS-rendered pages.
  function waitForArticle(callback) {
    let ticks = 0;
    const MAX  = 60; // 30 s at 500 ms

    const id = setInterval(() => {
      ticks++;
      const article = document.getElementById('article');

      if (!article) {
        if (ticks === 1) console.log('[JW Shorts] waiting for #article element…');
        if (ticks > MAX) { clearInterval(id); console.log('[JW Shorts] gave up — no #article'); }
        return;
      }

      if (articleIsReady(article)) {
        clearInterval(id);
        console.log(`[JW Shorts] article ready after ~${ticks * 500} ms`);
        callback(article);
      } else {
        if (ticks === 1) console.log('[JW Shorts] article exists but not yet populated — polling…');
      }
    }, 500);
  }

  // ── Find where to inject ─────────────────────────────────────────
  // Try to place the section right after JW.org's own "Video Shorts" block.
  // Falls back to appending at the end of the article.
  function findAnchor(article) {
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === 'Video Shorts') {
        // Walk up until we find an element that has a next sibling
        let el = node.parentElement;
        while (el && el !== article) {
          if (el.nextElementSibling) return el;
          el = el.parentElement;
        }
        // No sibling found — return the highest non-article ancestor
        // so we can append after the whole Shorts block
        el = node.parentElement;
        while (el.parentElement && el.parentElement !== article) el = el.parentElement;
        return el;
      }
    }
    return null; // not found — will append to article
  }

  // ── Build the injected section ───────────────────────────────────
  function buildSection(clips) {
    const section   = document.createElement('div');
    section.id      = 'jwshorts-section';

    const hdr       = document.createElement('div');
    hdr.className   = 'jwshorts-hdr';
    hdr.innerHTML   = `
      <span class="jwshorts-title">Video Shorts</span>
      <a class="jwshorts-see-all" href="${PLAYER}?lang=english&type=9x16-edited">
        See All
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M6 3l5 5-5 5"/>
        </svg>
      </a>
    `;

    const row       = document.createElement('div');
    row.className   = 'jwshorts-row';

    clips.forEach((src, idx) => {
      const a         = document.createElement('a');
      a.className     = 'jwshorts-card';
      a.href          = `${PLAYER}?lang=english&type=9x16-edited&start=${idx}`;

      const thumb     = document.createElement('div');
      thumb.className = 'jwshorts-thumb';

      const vid         = document.createElement('video');
      vid.src           = `${BASE}/${src}`;
      vid.muted         = true;
      vid.playsInline   = true;
      vid.loop          = true;
      vid.preload       = 'metadata';

      const dur         = document.createElement('div');
      dur.className     = 'jwshorts-dur';
      dur.innerHTML     = `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> —`;
      vid.addEventListener('loadedmetadata', () => {
        dur.innerHTML   = `<svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> ${fmtDur(vid.duration)}`;
      });

      const play        = document.createElement('div');
      play.className    = 'jwshorts-play';
      play.innerHTML    = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;

      a.addEventListener('mouseenter', () => vid.play().catch(() => {}));
      a.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });

      thumb.append(vid, dur, play);

      const label       = document.createElement('div');
      label.className   = 'jwshorts-label';
      label.textContent = deriveTitle(src);

      a.append(thumb, label);
      row.appendChild(a);
    });

    section.append(hdr, row);
    return section;
  }

  // ── Theme detection ──────────────────────────────────────────────
  // Read the page's actual background luminance rather than relying on
  // prefers-color-scheme, so the section matches the site's own setting.
  function pageTheme() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m  = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const luma = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
      return luma < 128 ? 'dark' : 'light';
    }
    return 'light';
  }

  function applyTheme(section) {
    section.dataset.theme = pageTheme();
  }

  // ── Main inject ──────────────────────────────────────────────────
  async function inject(article) {
    if (document.getElementById('jwshorts-section')) {
      console.log('[JW Shorts] already injected, skipping');
      return;
    }

    console.log('[JW Shorts] fetching manifest…');
    let clips;
    try {
      const res  = await fetch(MANIFEST);
      const data = await res.json();
      clips      = data?.english?.['9x16-edited'] || [];
      console.log(`[JW Shorts] got ${clips.length} clips`);
    } catch (err) {
      console.error('[JW Shorts] manifest fetch failed:', err);
      return;
    }

    if (!clips.length) { console.log('[JW Shorts] no clips, aborting'); return; }

    const section = buildSection(clips);
    applyTheme(section);

    // Re-check theme if the site toggles dark/light after inject
    new MutationObserver(() => applyTheme(section))
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });

    const anchor  = findAnchor(article);

    if (anchor) {
      console.log('[JW Shorts] injecting after "Video Shorts" block');
      anchor.insertAdjacentElement('afterend', section);
    } else {
      console.log('[JW Shorts] "Video Shorts" block not found — appending to article');
      article.appendChild(section);
    }

    console.log('[JW Shorts] done ✓');
  }

  // ── Entry point ──────────────────────────────────────────────────
  console.log('[JW Shorts] content script running on', location.pathname);
  waitForArticle(article => inject(article));

  // Re-inject when JW.org's hash-router returns to the main videos view
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (!hash || hash === 'en/home') {
      console.log('[JW Shorts] back to home view — re-injecting');
      const old = document.getElementById('jwshorts-section');
      if (old) old.remove();
      waitForArticle(article => inject(article));
    }
  });

})();
