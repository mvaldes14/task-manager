const THEME_MODES = new Set(['system', 'light', 'dark'])

export function getStoredThemeMode() {
  const mode = localStorage.getItem('td-theme-mode')
  if (THEME_MODES.has(mode)) return mode

  // Preserve existing users' explicit theme when introducing Auto mode.
  const legacyTheme = localStorage.getItem('td-theme')
  return legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : 'dark'
}

export function resolveThemeMode(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode === 'light' ? 'light' : 'dark'
}
