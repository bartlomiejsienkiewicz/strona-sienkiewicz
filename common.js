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
