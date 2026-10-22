/* Read the shared preference before Docusaurus initializes its colour mode. */
(() => {
  try {
    const value = document.cookie.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('stoa-theme='))?.slice('stoa-theme='.length);
    if (value !== 'light' && value !== 'dark') return;
    document.documentElement.setAttribute('data-theme', value);
    // Docusaurus continues to own its local preference and switch behaviour.
    try { window.localStorage.setItem('theme', value); } catch {}
  } catch { /* Keep the normal Docusaurus fallback. */ }
})();
