/**
 * Parent-page auto-resize helper for the flipbook iframe.
 * Plaats dit script op de pagina waar je de iframe insluit.
 *
 * Voorbeeld:
 * <iframe
 *   id="flipbook"
 *   src="https://web-production-e48a7.up.railway.app/vrije-tijd"
 *   style="width:100%; border:0; overflow:hidden;"
 *   scrolling="no"
 *   loading="lazy"
 * ></iframe>
 * <script src="/iframe-parent-script.js"></script>
 */

(function () {
  const iframe = document.getElementById('flipbook');
  if (!iframe) return;

  const ORIGIN = 'https://web-production-e48a7.up.railway.app'; // pas aan indien je een custom domein gebruikt

  const applyHeight = (height) => {
    if (typeof height === 'number' && height > 0) {
      iframe.style.height = `${height}px`;
    }
  };

  // fallback start-hoogte terwijl we wachten op postMessage
  applyHeight(700);

  window.addEventListener('message', (event) => {
    // veiligheid: alleen luisteren naar ons domein
    if (event.origin !== ORIGIN) return;
    if (event.data?.type === 'FLIPBOOK_HEIGHT') {
      applyHeight(event.data.height);
    }
  });
})();
