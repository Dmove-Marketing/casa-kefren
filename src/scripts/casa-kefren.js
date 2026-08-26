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

/* Carrossel da Gastronomia — loop infinito (clona 1º/último item nas pontas) */
function setupCarousel(trackSel, prevSel, nextSel) {
  const track = document.querySelector(trackSel);
  const prevBtn = document.querySelector(prevSel);
  const nextBtn = document.querySelector(nextSel);
  if (!track || !prevBtn || !nextBtn) return;

  const items = Array.from(track.children);
  if (items.length < 2) return;

  const firstClone = items[0].cloneNode(true);
  const lastClone = items[items.length - 1].cloneNode(true);
  firstClone.setAttribute('aria-hidden', 'true');
  lastClone.setAttribute('aria-hidden', 'true');
  track.appendChild(firstClone);
  track.insertBefore(lastClone, items[0]);

  const gapPx = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
  const cardWidth = () => items[0].getBoundingClientRect().width + gapPx;

  const total = items.length;
  let index = 1; // 0 = clone do último, 1..total = itens reais, total+1 = clone do primeiro
  let settleTimer;

  function scrollToIndex(i, smooth) {
    track.scrollTo({ left: i * cardWidth(), behavior: smooth ? 'smooth' : 'auto' });
  }
  scrollToIndex(index, false);

  function settle() {
    if (index === 0) {
      index = total;
      scrollToIndex(index, false);
    } else if (index === total + 1) {
      index = 1;
      scrollToIndex(index, false);
    }
  }

  function goTo(i) {
    index = i;
    scrollToIndex(index, true);
    clearTimeout(settleTimer);
    // Espera o scroll suave realmente terminar (scrollend quando suportado) antes
    // de reposicionar sem animação — reposicionar cedo demais causa um "salto"
    // visível no meio da animação.
    let settled = false;
    const run = () => { if (settled) return; settled = true; settle(); };
    if ('onscrollend' in window) {
      track.addEventListener('scrollend', run, { once: true });
      settleTimer = setTimeout(run, 900); // fallback de segurança
    } else {
      settleTimer = setTimeout(run, 650);
    }
  }

  nextBtn.addEventListener('click', () => goTo(index + 1));
  prevBtn.addEventListener('click', () => goTo(index - 1));
}
setupCarousel('.gastronomy-track', '.gastronomy-prev', '.gastronomy-next');
