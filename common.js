/* ============================================================================
   COMMON.JS — współdzielone przez stronę główną i każdą podstronę artykułu
   (mobilne menu, animacja pojawiania się elementów, przycisk „Do góry”).
   ============================================================================ */
(function(){
  /* ---------------- Mobile nav ---------------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  if(toggle && nav){
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
    }));
  }

  /* ---------------- Reveal on scroll ---------------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduceMotion && 'IntersectionObserver' in window){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold:.12, rootMargin:'0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------------- Do góry: przewiń jednym kliknięciem ---------------- */
  const topFloatBtn = document.getElementById('float-top');
  if(topFloatBtn){
    function updateTopFloatBtn(){
      topFloatBtn.classList.toggle('is-visible', window.scrollY > 480);
    }
    window.addEventListener('scroll', updateTopFloatBtn, { passive:true });
    updateTopFloatBtn();
    topFloatBtn.addEventListener('click', () => {
      window.scrollTo({ top:0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------- Rok w stopce ---------------- */
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();
})();

/* ============================================================================
   STATYSTYKI (Google Analytics 4) ZA ZGODĄ UŻYTKOWNIKA
   Wklej poniżej swój identyfikator pomiaru z GA4 (wygląda jak G-XXXXXXXXXX).
   Dopóki jest pusty, nic się nie ładuje i baner zgody się nie pokazuje.
   Skrypt Google ładuje się DOPIERO po kliknięciu „Akceptuję”.
   ============================================================================ */
(function(){
  const GA_ID = 'G-6MBF8PPP5L';
  if(!GA_ID) return;

  const KEY = 'cookie-consent';
  const read = () => { try{ return localStorage.getItem(KEY); }catch(e){ return null; } };
  const write = v => { try{ localStorage.setItem(KEY, v); }catch(e){} };

  function loadGA(){
    if(window.__gaLoaded) return;
    window.__gaLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function closeBanner(){
    const b = document.getElementById('cookie-banner');
    if(b) b.remove();
  }

  function showBanner(){
    if(document.getElementById('cookie-banner')) return;
    const b = document.createElement('div');
    b.id = 'cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Zgoda na pliki cookies');
    b.style.cssText = 'position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:1000;max-width:640px;margin-inline:auto;'
      + 'background:#0e2a52;color:#fff;border-radius:10px;padding:1rem 1.2rem;box-shadow:0 8px 30px rgba(0,0,0,.3);'
      + 'font:500 .92rem/1.5 "Libre Franklin",system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;';
    b.innerHTML = '<span style="flex:1 1 280px;">Ta strona używa plików cookies Google Analytics do anonimowych statystyk odwiedzin. '
      + 'Korzystamy z nich tylko za Twoją zgodą.</span>'
      + '<span style="display:flex;gap:.5rem;">'
      + '<button type="button" data-c="no" style="cursor:pointer;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:6px;padding:.5rem .9rem;font:inherit;">Odrzucam</button>'
      + '<button type="button" data-c="yes" style="cursor:pointer;background:#e9b949;color:#0e2a52;border:0;border-radius:6px;padding:.5rem .9rem;font:inherit;font-weight:700;">Akceptuję</button>'
      + '</span>';
    b.addEventListener('click', e => {
      const c = e.target && e.target.getAttribute && e.target.getAttribute('data-c');
      if(!c) return;
      write(c === 'yes' ? 'granted' : 'denied');
      if(c === 'yes') loadGA();
      closeBanner();
    });
    document.body.appendChild(b);
  }

  // Link w stopce, żeby można było zmienić decyzję w każdej chwili
  const footer = document.querySelector('footer');
  if(footer){
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'Ustawienia cookies';
    a.style.cssText = 'display:inline-block;margin:.6rem 0 0;color:inherit;opacity:.8;font-size:.85rem;text-decoration:underline;';
    a.addEventListener('click', e => { e.preventDefault(); showBanner(); });
    footer.appendChild(a);
  }

  const saved = read();
  if(saved === 'granted') loadGA();
  else if(saved !== 'denied') showBanner();
})();
