const params    = new URLSearchParams(window.location.search);
const lang      = params.get('lang') || 'english';
const type      = params.get('type') || '16x9';
const isCompare = type === 'compare';

const FORMAT_LABELS = {
  '16x9':       '16:9 Original',
  '9x16-crop':  '9:16 Centre Crop',
  '9x16-edited':'9:16 Edited',
  'compare':    'Compare',
};

const feedEl     = document.getElementById('feed');
const counterEl  = document.getElementById('video-counter');
const badgeEl    = document.getElementById('format-badge');
const muteBanner = document.getElementById('mute-banner');

let soundEnabled = false;
let currentVideo = null;

// ── Sound ──────────────────────────────────────────────────
function enableSound() {
  if (soundEnabled) return;
  soundEnabled = true;
  const selector = isCompare ? '.feed video[data-format="16x9"]' : '.feed video';
  document.querySelectorAll(selector).forEach(v => { v.muted = false; });
  muteBanner.classList.add('hidden');
}

muteBanner.addEventListener('click', enableSound);

// ── Back button ────────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', () => {
  history.length > 1 ? history.back() : (window.location.href = 'index.html');
});

// ── Manifest ───────────────────────────────────────────────
async function loadVideos() {
  const res = await fetch(`manifest.json?v=${Date.now()}`);
  if (!res.ok) throw new Error('manifest not found');
  const manifest = await res.json();
  if (isCompare) {
    return {
      '16x9':        manifest[lang]?.['16x9']        || [],
      '9x16-crop':   manifest[lang]?.['9x16-crop']   || [],
      '9x16-edited': manifest[lang]?.['9x16-edited'] || [],
    };
  }
  return manifest[lang]?.[type] || [];
}

// ── Build single-format player ─────────────────────────────
function buildPlayer(videos) {
  badgeEl.textContent = FORMAT_LABELS[type] || type;

  if (!videos.length) {
    feedEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
      <span>No videos found for this selection.</span>
      <span style="font-size:0.75rem;margin-top:0.25rem">Update manifest.json to add videos.</span>
    `;
    feedEl.appendChild(empty);
    counterEl.textContent = '0 / 0';
    return;
  }

  const total   = videos.length;
  const cssType = type.startsWith('9x16') ? 'type-9x16' : 'type-16x9';
  counterEl.textContent = `1 / ${total}`;

  videos.forEach((src, i) => {
    const item = document.createElement('div');
    item.className = `video-item ${cssType}`;
    item.dataset.index = i;

    const video = document.createElement('video');
    video.src = src;
    video.loop = true;
    video.playsInline = true;
    video.muted = true;
    video.preload = i < 2 ? 'auto' : 'metadata';

    const spinner = document.createElement('div');
    spinner.className = 'video-spinner';
    video.addEventListener('waiting', () => spinner.classList.add('active'));
    video.addEventListener('playing', () => spinner.classList.remove('active'));
    video.addEventListener('canplay', () => spinner.classList.remove('active'));

    // Tap overlay — toggles play/pause
    const tap = document.createElement('div');
    tap.className = 'tap-overlay';

    const pauseIcon = document.createElement('div');
    pauseIcon.className = 'pause-icon';
    pauseIcon.textContent = '⏸';

    let pauseTimer;
    tap.addEventListener('click', () => {
      if (!soundEnabled) {
        enableSound();
        if (!video.paused) {
          video.pause();
          video.play().catch(() => {});
        }
        return;
      }
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
        pauseIcon.classList.add('show');
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(() => pauseIcon.classList.remove('show'), 900);
      }
    });

    item.appendChild(video);
    item.appendChild(spinner);
    item.appendChild(tap);
    item.appendChild(pauseIcon);

    // Scroll hint on first card only
    if (i === 0 && total > 1) {
      const hint = document.createElement('div');
      hint.className = 'scroll-hint';
      hint.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <polyline points="6 9 12 15 18 9" transform="rotate(180,12,12)"/>
        </svg>
        <span>Scroll for next</span>
      `;
      item.appendChild(hint);
    }

    feedEl.appendChild(item);
  });

  // Sentinel — when scrolled past the last video, loop back to the first
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;flex-shrink:0;';
  feedEl.appendChild(sentinel);

  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      feedEl.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, { threshold: 1.0 }).observe(sentinel);

  // IntersectionObserver — autoplay video in view
  const items = feedEl.querySelectorAll('.video-item');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video   = entry.target.querySelector('video');
      const spinner = entry.target.querySelector('.video-spinner');
      const idx     = parseInt(entry.target.dataset.index, 10);

      if (entry.isIntersecting) {
        currentVideo = video;
        if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          spinner.classList.add('active');
        }
        video.play().catch(() => {});
        counterEl.textContent = `${idx + 1} / ${total}`;

        // Preload the next two videos
        for (let j = 1; j <= 2; j++) {
          const nextItem = items[idx + j];
          if (nextItem) {
            const nextVideo = nextItem.querySelector('video');
            if (nextVideo.preload !== 'auto') {
              nextVideo.preload = 'auto';
              nextVideo.load();
            }
          }
        }
      } else {
        video.pause();
        video.currentTime = 0;
        spinner.classList.remove('active');
      }
    });
  }, { threshold: 0.6 });

  items.forEach(item => observer.observe(item));
}

// ── Sync helper — resolves when video can play, or on error ─
function waitForReady(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      video.removeEventListener('canplay', done);
      video.removeEventListener('error', done);
      resolve();
    };
    video.addEventListener('canplay', done);
    video.addEventListener('error', done);
  });
}

// ── Build compare player ────────────────────────────────────
function buildComparePlayer(allVideos) {
  badgeEl.textContent = 'Compare';
  document.body.classList.add('mode-compare');

  // Add column labels below the chrome top bar
  const chromeEl = document.getElementById('player-chrome');
  const labelsEl = document.createElement('div');
  labelsEl.className = 'compare-labels';
  labelsEl.innerHTML = `
    <span>16:9 Original</span>
    <span>9:16 Crop</span>
    <span>9:16 Edited</span>
  `;
  chromeEl.appendChild(labelsEl);

  const FORMATS = ['16x9', '9x16-crop', '9x16-edited'];
  const total = Math.min(
    allVideos['16x9'].length,
    allVideos['9x16-crop'].length,
    allVideos['9x16-edited'].length
  );

  if (!total) {
    feedEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
      <span>No videos found for this selection.</span>
      <span style="font-size:0.75rem;margin-top:0.25rem">Update manifest.json to add videos.</span>
    `;
    feedEl.appendChild(empty);
    counterEl.textContent = '0 / 0';
    return;
  }

  feedEl.classList.add('feed--compare');
  counterEl.textContent = `1 / ${total}`;

  for (let i = 0; i < total; i++) {
    const row = document.createElement('div');
    row.className = 'compare-row';
    row.dataset.index = i;

    const rowVideos = [];

    FORMATS.forEach(fmt => {
      const col = document.createElement('div');
      col.className = 'compare-col';

      const video = document.createElement('video');
      video.src = allVideos[fmt][i];
      video.loop = true;
      video.playsInline = true;
      video.muted = true;
      video.preload = i < 2 ? 'auto' : 'metadata';
      video.dataset.format = fmt;

      const spinner = document.createElement('div');
      spinner.className = 'video-spinner';
      video.addEventListener('waiting', () => spinner.classList.add('active'));
      video.addEventListener('playing', () => spinner.classList.remove('active'));
      video.addEventListener('canplay', () => spinner.classList.remove('active'));

      col.appendChild(video);
      col.appendChild(spinner);
      row.appendChild(col);
      rowVideos.push({ video, fmt });
    });

    // Single tap overlay covering the whole row
    const tap = document.createElement('div');
    tap.className = 'tap-overlay';

    const pauseIcon = document.createElement('div');
    pauseIcon.className = 'pause-icon';
    pauseIcon.textContent = '⏸';

    let pauseTimer;
    tap.addEventListener('click', () => {
      if (!soundEnabled) {
        enableSound();
        // Restart 16x9 video to ensure audio stream starts cleanly
        const v16 = rowVideos.find(r => r.fmt === '16x9')?.video;
        if (v16 && !v16.paused) {
          v16.pause();
          v16.play().catch(() => {});
        }
        return;
      }
      const anyPlaying = rowVideos.some(({ video }) => !video.paused);
      if (anyPlaying) {
        rowVideos.forEach(({ video }) => video.pause());
        pauseIcon.classList.add('show');
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(() => pauseIcon.classList.remove('show'), 900);
      } else {
        rowVideos.forEach(({ video }) => video.play().catch(() => {}));
      }
    });

    row.appendChild(tap);
    row.appendChild(pauseIcon);

    if (i === 0 && total > 1) {
      const hint = document.createElement('div');
      hint.className = 'scroll-hint';
      hint.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <polyline points="6 9 12 15 18 9" transform="rotate(180,12,12)"/>
        </svg>
        <span>Scroll for next</span>
      `;
      row.appendChild(hint);
    }

    feedEl.appendChild(row);
  }

  // Sentinel — loop back on end
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;flex-shrink:0;';
  feedEl.appendChild(sentinel);

  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      feedEl.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, { threshold: 1.0 }).observe(sentinel);

  // IntersectionObserver — wait for all 3 to be ready, then start together
  const rows = feedEl.querySelectorAll('.compare-row');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const row    = entry.target;
      const videos = Array.from(row.querySelectorAll('video'));
      const idx    = parseInt(row.dataset.index, 10);

      if (entry.isIntersecting) {
        row.dataset.visible = '1';
        currentVideo = videos.find(v => v.dataset.format === '16x9') || videos[0];
        counterEl.textContent = `${idx + 1} / ${total}`;

        // Kick off loading for any video not yet buffered
        videos.forEach(v => {
          if (v.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
            v.preload = 'auto';
            v.load();
          }
        });

        // Show spinners while waiting for the slowest video
        Array.from(row.querySelectorAll('.compare-col')).forEach(col => {
          const v = col.querySelector('video');
          const s = col.querySelector('.video-spinner');
          if (v.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) s?.classList.add('active');
        });

        // Start all three only once every video is ready to play
        Promise.all(videos.map(waitForReady)).then(() => {
          if (!row.dataset.visible) return; // scrolled away while waiting
          videos.forEach(v => v.play().catch(() => {}));
        });

        // Preload next two rows
        for (let j = 1; j <= 2; j++) {
          const nextRow = rows[idx + j];
          if (nextRow) {
            Array.from(nextRow.querySelectorAll('video')).forEach(v => {
              if (v.preload !== 'auto') {
                v.preload = 'auto';
                v.load();
              }
            });
          }
        }
      } else {
        delete row.dataset.visible;
        videos.forEach(v => {
          v.pause();
          v.currentTime = 0;
        });
      }
    });
  }, { threshold: 0.6 });

  rows.forEach(row => observer.observe(row));
}

// ── Init ───────────────────────────────────────────────────
(async () => {
  try {
    const data = await loadVideos();
    document.getElementById('loading')?.remove();
    if (isCompare) {
      buildComparePlayer(data);
    } else {
      buildPlayer(data);
    }
  } catch (err) {
    const loadEl = document.getElementById('loading');
    if (loadEl) {
      loadEl.innerHTML = `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <span>Could not load videos</span>
      `;
    }
  }
})();
