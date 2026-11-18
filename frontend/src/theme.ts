// Erscheinungsbild: hell, dunkel oder wie das System (gespeichert im Browser)
export type Theme = 'light' | 'dark' | 'system';

const META_COLORS = { light: '#ECE9E4', dark: '#1C1B19' };

export function getTheme(): Theme {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('theme');
  } catch {
    stored = null;
  }
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function isDark(theme: Theme): boolean {
  if (theme === 'dark') {
    return true;
  } else if (theme === 'light') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    let color = META_COLORS.light;
    if (isDark(theme)) {
      color = META_COLORS.dark;
    }
    meta.setAttribute('content', color);
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // nur für diese Sitzung
  }
  applyTheme(theme);
}

/** Beim Start aufrufen; folgt Systemwechseln, solange "system" gewählt ist. */
export function initTheme(): void {
  applyTheme(getTheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') {
      applyTheme('system');
    }
  });
}
