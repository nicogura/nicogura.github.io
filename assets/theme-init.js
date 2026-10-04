/* Runs before CSS to keep the saved theme consistent from the first paint. */
(() => {
  let theme;
  try { theme = localStorage.getItem('nicogura-theme'); } catch (_) { /* Private storage may be unavailable. */ }
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
