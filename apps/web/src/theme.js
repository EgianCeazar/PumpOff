// Appearance (theme and accent colour), remembered per device.
// index.html applies the saved choice before the first paint; this module
// keeps it in sync afterwards.

export const THEMES = [
  { key: 'auto', label: 'Match device' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'contrast', label: 'High contrast' },
];

export const ACCENTS = [
  { key: 'tomato', label: 'Tomato' },
  { key: 'teal', label: 'Teal' },
  { key: 'blue', label: 'Blue' },
  { key: 'berry', label: 'Berry' },
];

// Must match the key in index.html.
const KEY = 'pumpoff.appearance.v1';
const DEFAULTS = { theme: 'auto', accent: 'tomato' };

const valid = (list, value, fallback) => (list.some(item => item.key === value) ? value : fallback);

export function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      theme: valid(THEMES, saved.theme, DEFAULTS.theme),
      accent: valid(ACCENTS, saved.accent, DEFAULTS.accent),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppearance(appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(appearance));
  } catch {
    // Private mode or storage blocked: the choice still applies until the page closes.
  }
}

const prefersDark = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

export function resolveTheme(theme) {
  return theme === 'auto' ? (prefersDark() ? 'dark' : 'light') : theme;
}

export function applyAppearance({ theme, accent }) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(theme);
  root.dataset.accent = accent;
  // Colours the phone's browser bar to match the page.
  const bar = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
}
