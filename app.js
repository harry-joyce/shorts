const langSelect = document.getElementById('language-select');
const formatSection = document.getElementById('format-section');
const cards = document.querySelectorAll('.format-card');

const COMPARE_MIN_WIDTH = 900;

function showFormats() {
  formatSection.classList.add('visible');
  cards.forEach(c => {
    c.disabled = c.dataset.type === 'compare' && window.innerWidth < COMPARE_MIN_WIDTH;
  });
}

function hideFormats() {
  formatSection.classList.remove('visible');
  cards.forEach(c => { c.disabled = true; });
}

langSelect.addEventListener('change', () => {
  langSelect.value ? showFormats() : hideFormats();
});

// Restore state if browser navigated back (form value preserved)
if (langSelect.value) showFormats();

cards.forEach(card => {
  card.addEventListener('click', () => {
    const lang = langSelect.value;
    const type = card.dataset.type;
    if (lang && type) {
      window.location.href = `player.html?lang=${encodeURIComponent(lang)}&type=${encodeURIComponent(type)}`;
    }
  });
});
