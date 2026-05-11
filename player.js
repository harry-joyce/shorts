const params   = new URLSearchParams(window.location.search);
const lang     = params.get('lang') || 'english';
const type     = params.get('type') || '16x9';

const FORMAT_LABELS = {
  '16x9':       '16:9 Original',
  '9x16-crop':  '9:16 Centre Crop',
  '9x16-edited':'9:16 Edited',
};

const feedEl      = document.getElementById('feed');
const counterEl   = document.getElementById('video-counter');
const badgeEl     = document.getElementById('format-badge');
const muteBanner  = document.getElementById('mute-banner');

let soundEnabled  = false;
let currentVideo  = null;

// ── Sound ──────────────────────────────────────────────────
function enableSound() {
  if (soundEnabled) return;
  soundEnabled = true;
  document.querySelectorAll('.feed video').forEach(v => { v.muted = false; });
  muteBanner.classList.add('hidden');
}

muteBanner.addEventListener('click', enableSound);

// ── Back button ────────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', () => {
  history.length > 1 ? history.back() : (window.location.href = 'index.html');
});

// ── Manifest ───────────────────────────────────────────────
async function loadVideos() {
  const res = await fetch('manifest.json');
  if (!res.ok) throw new Error('manifest not found');
  const manifest = await res.json();
  return manifest[lang]?.[type] || [];
}

// ── Build player ───────────────────────────────────────────
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

  const total = videos.length;
  counterEl.textContent = `1 / ${total}`;

  const cssType = type.startsWith('9x16') ? 'type-9x16' : 'type-16x9';

  videos.forEach((src, i) => {
    const item = document.createElement('div');
    item.className = `video-item ${cssType}`;
    item.dataset.index = i;

    const video = document.createElement('video');
    video.src = src;
    video.loop = true;
    video.playsInline = true;
    video.muted = true;       // start muted; enabled on first interaction
    video.preload = i < 2 ? 'auto' : 'metadata';

    // Tap overlay — toggles play/pause (and enables sound on first tap)
    const tap = document.createElement('div');
    tap.className = 'tap-overlay';

    const pauseIcon = document.createElement('div');
    pauseIcon.className = 'pause-icon';
    pauseIcon.textContent = '⏸';

    let pauseTimer;
    tap.addEventListener('click', () => {
      if (!soundEnabled) {
        enableSound();
        // unmuting may need a fresh play call on some browsers
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

  // IntersectionObserver — autoplay video in view
  const items = feedEl.querySelectorAll('.video-item');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video  = entry.target.querySelector('video');
      const idx    = parseInt(entry.target.dataset.index, 10);

      if (entry.isIntersecting) {
        currentVideo = video;
        video.play().catch(() => {});
        counterEl.textContent = `${idx + 1} / ${total}`;

        // Preload the next video
        const nextItem = items[idx + 1];
        if (nextItem) nextItem.querySelector('video').preload = 'auto';
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, { threshold: 0.6 });

  items.forEach(item => observer.observe(item));
}

// ── Init ───────────────────────────────────────────────────
(async () => {
  try {
    const videos = await loadVideos();
    document.getElementById('loading')?.remove();
    buildPlayer(videos);
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
