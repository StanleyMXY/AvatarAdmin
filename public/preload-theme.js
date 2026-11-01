// Runs before the page is drawn (a classic script in <head>, from our own origin so that the
// content security policy of docs/deploy.md allows it). Without it, the page is the browser's white
// until the app has loaded, a flash in the dark themes. It reads the saved theme the way
// src/theme/modes.ts does and paints the page background of that theme; the app takes over after.
// The colours here are the page backgrounds (colorBgLayout) of src/theme/modes.ts: the test
// src/theme/preloadTheme.test.ts fails when they differ.
(() => {
  const themes = {
    dim: { background: '#15202B', scheme: 'dark' },
    deep: { background: '#0A171B', scheme: 'dark' },
    light: { background: '#FAFAFA', scheme: 'light' },
  };
  let mode = 'dim';
  try {
    const saved = localStorage.getItem('avatar-admin.theme-mode');
    if (saved === 'dim' || saved === 'deep' || saved === 'light') mode = saved;
  } catch {
    // storage is not available: the default theme
  }
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.style.colorScheme = themes[mode].scheme;
  root.style.backgroundColor = themes[mode].background;
})();
