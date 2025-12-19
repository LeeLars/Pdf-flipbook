// Iframe height adjustment voor parent pagina
// Voeg deze code toe aan de pagina waar je de iframe embedt

// Luister naar berichten van de iframe
window.addEventListener('message', function(event) {
  // Controleer of het bericht van onze iframe komt
  // Je kunt event.origin controleren voor extra veiligheid

  if (event.data && event.data.type === 'iframeHeight') {
    const iframe = document.querySelector('iframe'); // Of gebruik een specifieke selector
    if (iframe) {
      iframe.style.height = event.data.height + 'px';
      // Optioneel: kleine buffer toevoegen voor padding
      iframe.style.height = (event.data.height + 20) + 'px';
    }
  }
});

// Voorbeeld HTML voor je iframe:
// <iframe src="https://web-production-e48a7.up.railway.app/embed/jouw-client-slug"
//         width="100%"
//         height="600"
//         frameborder="0"
//         scrolling="no">
// </iframe>

// Belangrijk: zet scrolling="no" op de iframe om dubbele scroll te voorkomen
