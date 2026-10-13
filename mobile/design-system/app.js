const root = document.documentElement;
const paletteControl = document.querySelector('#palette');
const modeControls = [...document.querySelectorAll('[data-mode-choice]')];
const toast = document.querySelector('.toast');
const dialog = document.querySelector('#trip-dialog');
const storageKey = 'tripsloom.design-system.appearance.v1';
const palettes = new Set(['coast', 'olive', 'terracotta', 'lavender']);
let toastTimer;

function saveAppearance() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      palette: root.dataset.palette,
      mode: root.dataset.mode,
    }));
  } catch {
    // The gallery also works when opened directly from the filesystem.
  }
}

function setAppearance(palette, mode) {
  root.dataset.palette = palettes.has(palette) ? palette : 'coast';
  root.dataset.mode = mode === 'dark' ? 'dark' : 'light';
  paletteControl.value = root.dataset.palette;
  modeControls.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.modeChoice === root.dataset.mode));
  });
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root).getPropertyValue('--bg').trim();
  saveAppearance();
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  setAppearance(saved.palette, saved.mode);
} catch {
  setAppearance('coast', 'light');
}

paletteControl.addEventListener('change', () => setAppearance(paletteControl.value, root.dataset.mode));
modeControls.forEach((button) => button.addEventListener('click', () => setAppearance(root.dataset.palette, button.dataset.modeChoice)));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

document.querySelectorAll('[data-open-editor]').forEach((button) => {
  button.addEventListener('click', () => dialog.showModal());
});

document.querySelectorAll('[data-demo-toast]').forEach((button) => {
  if (button.closest('#trip-dialog')) return;
  button.addEventListener('click', () => showToast(`${button.dataset.demoToast} · preview`));
});

dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'save') showToast('Trip form preview saved');
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close('cancel');
});

function selectOne(container, selected, selector) {
  container.querySelectorAll(selector).forEach((button) => {
    const active = button === selected;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

document.querySelectorAll('.chip-row, .segmented, .date-rail').forEach((container) => {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && container.contains(button)) selectOne(container, button, 'button');
  });
});

document.querySelectorAll('.floating-nav').forEach((nav) => {
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preview-tab]');
    if (!button || !nav.contains(button)) return;
    nav.querySelectorAll('[data-preview-tab]').forEach((item) => {
      item.classList.toggle('active', item === button);
      if (item === button) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    showToast(`${button.dataset.previewTab} · component preview`);
  });
});
