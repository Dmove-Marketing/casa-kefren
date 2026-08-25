// Interações da página Casa Kefren.
// Módulo ES (carregado com defer pelo Astro → DOM já pronto).
// A lógica de formulário fica no forms.ts compartilhado — não duplicar aqui.

/* Sticky header */
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* Menu mobile */
const toggle = document.querySelector('.nav-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
if (toggle && mobileMenu) {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
  });
  mobileMenu.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      toggle.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    })
  );
}

/* Reveal on scroll */
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}

/* Barra de autoridade: contagem animada do número de convidados */
const counters = document.querySelectorAll('.count');
if (counters.length && 'IntersectionObserver' in window) {
  const countIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10) || 0;
        const duration = 3200;
        let start = null;
        const stepFn = (ts) => {
          if (start === null) start = ts;
          const progress = Math.min((ts - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(eased * target);
          if (progress < 1) requestAnimationFrame(stepFn);
        };
        requestAnimationFrame(stepFn);
        countIo.unobserve(el);
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((el) => countIo.observe(el));
} else {
  counters.forEach((el) => (el.textContent = el.getAttribute('data-target')));
}

/* Carrossel da Gastronomia */
function setupCarousel(trackSel, prevSel, nextSel) {
  const track = document.querySelector(trackSel);
  const prevBtn = document.querySelector(prevSel);
  const nextBtn = document.querySelector(nextSel);
  if (!track || !prevBtn || !nextBtn) return;
  const scrollAmount = () => {
    const card = track.querySelector('figure, a');
    return card ? card.getBoundingClientRect().width + 16 : 300;
  };
  nextBtn.addEventListener('click', () => track.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
  prevBtn.addEventListener('click', () => track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
}
setupCarousel('.gastronomy-track', '.gastronomy-prev', '.gastronomy-next');
