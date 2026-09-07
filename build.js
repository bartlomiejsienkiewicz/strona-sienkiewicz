#!/usr/bin/env node
/**
 * ============================================================================
 * BUILD.JS — generator statycznej strony pod SEO/GEO
 * ----------------------------------------------------------------------------
 * Uruchamiany automatycznie przez Netlify przy każdej publikacji (patrz
 * netlify.toml). Nie wymaga żadnych zewnętrznych paczek (czysty Node.js).
 *
 * Co robi:
 *   1. Wczytuje articles.json (edytowany przez panel /admin).
 *   2. Dla KAŻDEGO artykułu generuje osobną, w pełni samodzielną podstronę
 *      /blog/{slug}/index.html — z prawdziwym adresem URL, własnym tytułem,
 *      opisem, danymi Open Graph/Twitter Card i danymi strukturalnymi
 *      (schema.org/Article). Dzięki temu każdy odcinek jest osobno
 *      indeksowalny przez Google i czytelny dla botów LLM (GEO) — inaczej niż
 *      przy starym rozwiązaniu z "#/artykul/..." (hash), które wyszukiwarki
 *      traktowały jako jedną i tę samą stronę główną.
 *   3. Kopiuje resztę plików (strona główna, panel /admin, style, dane).
 *   4. Generuje sitemap.xml i robots.txt, zawsze zgodne z aktualną listą
 *      artykułów.
 *
 * Adres domeny ustawia się w JEDNYM miejscu: site.config.json (siteUrl).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE_URL = config.siteUrl.replace(/\/$/, '');

const articlesRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'articles.json'), 'utf8'));
const articles = Array.isArray(articlesRaw) ? articlesRaw : (articlesRaw.items || []);

const sourceHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------
function rimraf(p){
  if(fs.existsSync(p)) fs.rmSync(p, { recursive:true, force:true });
}
function copyRecursive(src, dest){
  const stat = fs.statSync(src);
  if(stat.isDirectory()){
    fs.mkdirSync(dest, { recursive:true });
    for(const item of fs.readdirSync(src)){
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive:true });
    fs.copyFileSync(src, dest);
  }
}
function writeFile(relPath, content){
  const full = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(full), { recursive:true });
  fs.writeFileSync(full, content, 'utf8');
}
function escapeXml(s){
  return String(s || '').replace(/[<>&'"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
}
function escapeHtmlAttr(s){
  return String(s || '').replace(/"/g, '&quot;');
}
function stripTags(html){
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
/* Parsuje datę DD.MM.RRRR -> RRRR-MM-DD (ISO), dla danych strukturalnych i sitemapy. */
function toIsoDate(d){
  const m = String(d || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(!m) return null;
  const [_, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}
function extractBetween(html, startMarker, endMarker){
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker, s);
  if(s === -1 || e === -1) throw new Error(`Nie znaleziono fragmentu: ${startMarker} … ${endMarker}`);
  return html.slice(s, e + endMarker.length);
}

// ---------------------------------------------------------------------------
// Wyciągnij współdzielony header i footer z index.html, żeby podstrony
// artykułów miały dokładnie tę samą nawigację i stopkę co strona główna
// (jedno źródło prawdy — edytujesz tylko index.html).
// ---------------------------------------------------------------------------
let headerHtml = extractBetween(sourceHtml, '<header class="site-header">', '</header>');
let footerHtml = extractBetween(sourceHtml, '<!-- ======================= FOOTER ======================= -->', '</footer>');

// Na podstronie artykułu nawigacja musi wracać do sekcji na stronie głównej
// ("#about" -> "/#about"), a logo ma linkować do "/", nie "#landing".
function toHomeLinks(html){
  return html
    .replace(/href="#landing"/g, 'href="/"')
    .replace(/href="#(about|work|priorities|blog|contact)"/g, 'href="/#$1"');
}
headerHtml = toHomeLinks(headerHtml);
footerHtml = toHomeLinks(footerHtml);

const floatButtonsHtml = `<div class="float-stack" aria-hidden="false">
  <button type="button" class="float-btn top" id="float-top" aria-label="Przewiń do góry strony" title="Do góry">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
  </button>
</div>`;

// ---------------------------------------------------------------------------
// Szablon pojedynczej podstrony artykułu
// ---------------------------------------------------------------------------
function articlePage(article, prevNext){
  const url = `${SITE_URL}/blog/${article.slug}/`;
  const title = `${article.title} — ${config.podcastName}`;
  const description = article.excerpt || stripTags(article.body).slice(0, 155);
  const isoDate = toIsoDate(article.date);
  const dateBadge = (article.date && !/PLACEHOLDER/i.test(article.date)) ? article.date : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description,
    inLanguage: 'pl-PL',
    url,
    ...(isoDate ? { datePublished: isoDate } : {}),
    author: { '@type': 'Person', name: config.authorName, url: `${SITE_URL}/` },
    publisher: { '@type': 'Person', name: config.authorName },
    isPartOf: { '@type': 'Blog', name: config.podcastName, url: `${SITE_URL}/#blog` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/#blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url }
    ]
  };

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<script>document.documentElement.classList.add('js');</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttr(title)}</title>
<meta name="description" content="${escapeHtmlAttr(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="${escapeHtmlAttr(config.authorName)}">
<link rel="canonical" href="${url}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHtmlAttr(config.siteName)}">
<meta property="og:locale" content="pl_PL">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHtmlAttr(article.title)}">
<meta property="og:description" content="${escapeHtmlAttr(description)}">
<meta property="og:image" content="${SITE_URL}/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${isoDate ? `<meta property="article:published_time" content="${isoDate}">\n` : ''}<meta property="article:author" content="${escapeHtmlAttr(config.authorName)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtmlAttr(article.title)}">
<meta name="twitter:description" content="${escapeHtmlAttr(description)}">
<meta name="twitter:image" content="${SITE_URL}/og-image.jpg">

<meta name="theme-color" content="#0e2a52">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Libre+Franklin:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
</head>
<body>
<a class="skip" href="#article-content">Przejdź do treści</a>

<svg class="kilim-defs" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="kilim" width="40" height="24" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#0e2a52" stroke-width="1.1" stroke-linejoin="round" opacity="0.55">
        <path d="M0 3 L10 12 L20 3 L30 12 L40 3"/>
        <path d="M0 21 L10 12 L20 21 L30 12 L40 21"/>
        <path d="M20 7.5 L25 12 L20 16.5 L15 12 Z"/>
        <path d="M0 7.5 L5 12 L0 16.5"/>
        <path d="M40 7.5 L35 12 L40 16.5"/>
      </g>
      <g fill="#c8961e" opacity="0.9">
        <path d="M20 9.5 L22.5 12 L20 14.5 L17.5 12 Z"/>
        <path d="M0 9.5 L2.5 12 L0 14.5 Z"/>
        <path d="M40 9.5 L37.5 12 L40 14.5 Z"/>
      </g>
    </pattern>
  </defs>
</svg>

${headerHtml}

<main id="landing">
  <div class="wrap article-view active" style="padding-block:clamp(2.5rem,6vw,4rem);">
    <a class="back-link" href="/#blog">Wróć do bloga</a>
    <article class="article" id="article-content">
      <p class="a-pod">${escapeHtmlAttr(config.podcastName)}</p>
      <h1 tabindex="-1">${escapeHtmlAttr(article.title)}</h1>
      ${dateBadge ? `<p class="a-meta"><span class="ph">${escapeHtmlAttr(dateBadge)}</span></p>` : ''}
      <div class="article-body">${article.body}</div>
    </article>
    <div class="article-foot">
      <a class="back-link" href="/#blog">Wróć do bloga</a>
      ${prevNext.next ? `<p style="margin-top:1.2rem;"><a href="/blog/${prevNext.next.slug}/">Następny odcinek: ${escapeHtmlAttr(prevNext.next.title)} →</a></p>` : ''}
      ${prevNext.prev ? `<p style="margin-top:.6rem;"><a href="/blog/${prevNext.prev.slug}/">← Poprzedni odcinek: ${escapeHtmlAttr(prevNext.prev.title)}</a></p>` : ''}
    </div>
  </div>
</main>

${footerHtml}

${floatButtonsHtml}

<script src="/common.js"></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Budowanie
// ---------------------------------------------------------------------------
rimraf(DIST);
fs.mkdirSync(DIST, { recursive:true });

// 1) Strona główna, style, favicon, dane, panel admina — kopiowane 1:1
//    (z podmianą %%SITE_URL%% na prawdziwy adres z site.config.json)
let homeHtml = sourceHtml.split('%%SITE_URL%%').join(SITE_URL);
writeFile('index.html', homeHtml);
copyRecursive(path.join(ROOT, 'styles.css'), path.join(DIST, 'styles.css'));
copyRecursive(path.join(ROOT, 'common.js'), path.join(DIST, 'common.js'));
copyRecursive(path.join(ROOT, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
copyRecursive(path.join(ROOT, 'articles.json'), path.join(DIST, 'articles.json'));
copyRecursive(path.join(ROOT, 'admin'), path.join(DIST, 'admin'));
if(fs.existsSync(path.join(ROOT, 'og-image.jpg'))){
  copyRecursive(path.join(ROOT, 'og-image.jpg'), path.join(DIST, 'og-image.jpg'));
}
// Zdjęcia wgrywane przez edytora bloga (Decap CMS, media_folder z admin/config.yml)
if(fs.existsSync(path.join(ROOT, 'uploads'))){
  copyRecursive(path.join(ROOT, 'uploads'), path.join(DIST, 'uploads'));
}
// Pliki weryfikacyjne wyszukiwarek (Google Search Console, Bing Webmaster Tools itp.) —
// wystarczy wrzucić taki plik do głównego folderu repozytorium na GitHubie, a przy
// najbliższej publikacji sam trafi na stronę główną, bez zmian w tym skrypcie.
// Google: plik w stylu googleXXXXXXXXXXXXXXXX.html
// Bing:   plik w stylu BingSiteAuth.xml
for(const f of fs.readdirSync(ROOT)){
  if(/^google[0-9a-f]+\.html$/i.test(f) || f === 'BingSiteAuth.xml'){
    copyRecursive(path.join(ROOT, f), path.join(DIST, f));
    console.log('  + skopiowano plik weryfikacyjny:', f);
  }
}

// 2) Podstrony artykułów, posortowane od najnowszego (do nawigacji poprzedni/następny)
function parseDatePl(d){
  const m = String(d || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(!m) return -1;
  return new Date(+m[3], +m[2]-1, +m[1]).getTime();
}
const sorted = [...articles].sort((a,b) => parseDatePl(b.date) - parseDatePl(a.date));

let generated = 0;
sorted.forEach((article, i) => {
  if(!article.slug || !article.title || !article.body){
    console.warn('Pomijam artykuł bez wymaganych pól:', article.title || article.slug);
    return;
  }
  const prevNext = { next: sorted[i - 1] || null, prev: sorted[i + 1] || null }; // next = nowszy, prev = starszy
  writeFile(`blog/${article.slug}/index.html`, articlePage(article, prevNext));
  generated++;
});

// 3) sitemap.xml
const urls = [
  { loc: `${SITE_URL}/`, priority: '1.0' },
  ...sorted.filter(a => a.slug).map(a => ({
    loc: `${SITE_URL}/blog/${a.slug}/`,
    lastmod: toIsoDate(a.date) || undefined,
    priority: '0.7'
  }))
];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFile('sitemap.xml', sitemapXml);

// 4) robots.txt
writeFile('robots.txt', `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
`);

console.log(`✔ Zbudowano stronę: ${generated} podstron artykułów, sitemap.xml, robots.txt.`);
console.log(`  Wyjście: ${DIST}`);
