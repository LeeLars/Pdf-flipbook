<?php
// seamless-flipbook-proxy.php
// Plaats dit bestand op je eigen server en include het waar je de flipbook wilt tonen

// Proxy URL naar je Railway app
$flipbookUrl = 'https://web-production-e48a7.up.railway.app/embed/vrije-tijd';

// Haal de HTML content op
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => [
            'User-Agent: PHP-Seamless-Embed/1.0',
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: nl,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding: gzip, deflate',
            'Connection: keep-alive',
            'Upgrade-Insecure-Requests: 1',
        ],
        'timeout' => 30,
    ]
]);

$content = file_get_contents($flipbookUrl, false, $context);

if ($content === false) {
    echo '<div style="padding: 20px; text-align: center; border: 1px solid #ccc; background: #f9f9f9;">
        <p>Kon flipbook niet laden. Controleer je internetverbinding.</p>
    </div>';
    exit;
}

// Vervang relatieve URLs naar absolute URLs
$content = str_replace('src="/', 'src="https://web-production-e48a7.up.railway.app/', $content);
$content = str_replace('href="/', 'href="https://web-production-e48a7.up.railway.app/', $content);

// Voeg een wrapper div toe voor styling
$content = '<div class="seamless-flipbook-wrapper" style="width: 100%; overflow: visible;">' . $content . '</div>';

// Output de content
echo $content;
?>

<style>
/* Extra CSS voor naadloze integratie */
.seamless-flipbook-wrapper {
    border: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
}

.seamless-flipbook-wrapper * {
    box-sizing: border-box;
}

/* Verberg eventuele iframe indicators */
.seamless-flipbook-wrapper iframe {
    display: none !important;
}
</style>
