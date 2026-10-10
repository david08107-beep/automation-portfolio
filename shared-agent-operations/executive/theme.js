(() => {
  'use strict';

  const storageKey = 'orbit-ui-theme';
  const choices = new Set(['light', 'dark', 'system']);
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function savedChoice() {
    try {
      const value = localStorage.getItem(storageKey);
      return choices.has(value) ? value : 'system';
    } catch {
      return 'system';
    }
  }

  function resolvedChoice(choice) {
    return choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
  }

  function updateBrowserChrome(choice) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolvedChoice(choice) === 'dark' ? '#0b1220' : '#f4f6f9';
  }

  function applyChoice(choice, persist = false) {
    const safeChoice = choices.has(choice) ? choice : 'system';
    root.dataset.theme = safeChoice;
    root.dataset.resolvedTheme = resolvedChoice(safeChoice);
    updateBrowserChrome(safeChoice);
    document.querySelectorAll('[data-theme-value]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeValue === safeChoice));
    });
    if (persist) {
      try { localStorage.setItem(storageKey, safeChoice); } catch { /* Appearance still works for this page. */ }
    }
  }

  const initialChoice = savedChoice();
  applyChoice(initialChoice);

  document.addEventListener('DOMContentLoaded', () => {
    applyChoice(root.dataset.theme || initialChoice);
    document.querySelectorAll('[data-theme-value]').forEach(button => {
      button.addEventListener('click', () => applyChoice(button.dataset.themeValue, true));
    });
  });

  const syncSystemChoice = () => {
    if (root.dataset.theme === 'system') applyChoice('system');
  };
  if (typeof media.addEventListener === 'function') media.addEventListener('change', syncSystemChoice);
  else if (typeof media.addListener === 'function') media.addListener(syncSystemChoice);
})();
