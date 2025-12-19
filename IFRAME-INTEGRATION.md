# Iframe Integratie Handleiding

De PDF Flipbook viewer past automatisch de iframe hoogte aan op basis van de hoeveelheid content (aantal magazines).

## Automatische Hoogte Aanpassing

De applicatie meet automatisch de content hoogte en communiceert dit naar de parent window via `postMessage`. Dit gebeurt:

- Bij het laden van de pagina
- Wanneer magazines worden geladen
- Wanneer de content verandert (magazines toegevoegd/verwijderd)
- Bij window resize events

## Implementatie in je Website

### Stap 1: Voeg de iframe toe

```html
<iframe 
  id="magazine-iframe"
  src="https://jouw-domain.com/jouw-client-slug"
  title="Magazine Flipbook"
  scrolling="no"
  style="width: 100%; border: none; min-height: 600px;"
></iframe>
```

### Stap 2: Voeg de JavaScript listener toe

```javascript
window.addEventListener('message', function(event) {
  // Verificatie (optioneel maar aanbevolen in productie)
  // if (event.origin !== 'https://jouw-domain.com') return;
  
  if (event.data && event.data.type === 'resize-iframe') {
    const iframe = document.getElementById('magazine-iframe');
    const newHeight = event.data.height;
    
    // Pas de iframe hoogte aan
    iframe.style.height = (newHeight + 20) + 'px';
  }
}, false);
```

## Volledig Voorbeeld

Zie `iframe-example.html` voor een complete werkende implementatie.

## WordPress Integratie

Voor WordPress kun je deze code in een HTML widget of custom page template plaatsen:

```html
<div id="flipbook-container">
  <iframe 
    id="magazine-iframe"
    src="https://jouw-domain.com/jouw-client-slug"
    title="Magazine Flipbook"
    scrolling="no"
    style="width: 100%; border: none; min-height: 600px; transition: height 0.3s ease;"
  ></iframe>
</div>

<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'resize-iframe') {
      const iframe = document.getElementById('magazine-iframe');
      if (iframe) {
        iframe.style.height = (event.data.height + 20) + 'px';
      }
    }
  }, false);
})();
</script>
```

## Beveiligingstips

1. **Origin Verificatie**: In productie, verifieer de `event.origin` om alleen berichten van je eigen domein te accepteren:
   ```javascript
   if (event.origin !== 'https://jouw-domain.com') return;
   ```

2. **Message Type Check**: Controleer altijd het message type voordat je actie onderneemt:
   ```javascript
   if (event.data && event.data.type === 'resize-iframe')
   ```

## Troubleshooting

### Iframe past zich niet aan
- Controleer of de JavaScript listener correct is toegevoegd
- Check de browser console voor eventuele errors
- Zorg dat het iframe `id` overeenkomt met de selector in de JavaScript

### Hoogte springt
- Voeg een CSS transition toe voor vloeiende aanpassingen:
  ```css
  iframe {
    transition: height 0.3s ease;
  }
  ```

### Content wordt afgesneden
- Verhoog de marge in de height berekening:
  ```javascript
  iframe.style.height = (newHeight + 50) + 'px'; // Extra ruimte
  ```

## Technische Details

De applicatie gebruikt:
- `ResizeObserver` API voor real-time content monitoring
- `postMessage` API voor veilige cross-origin communicatie
- `scrollHeight` voor accurate height metingen
