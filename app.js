// Burger King® México — light interactive enhancements
(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ----- Mobile drawer -----
  const toggle    = $('#menuToggle');
  const drawer    = $('#mobileDrawer');
  const closeBtn  = $('#drawerClose');
  const scrim     = $('#scrim');

  function openDrawer() {
    drawer.hidden = false;
    // give the browser one frame so the transition actually plays
    requestAnimationFrame(() => {
      drawer.classList.add('is-open');
      scrim.hidden = false;
      requestAnimationFrame(() => scrim.classList.add('is-visible'));
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    // wait for the transition to end before hiding (so animation is visible)
    setTimeout(() => {
      drawer.hidden = true;
      scrim.hidden = true;
    }, 260);
  }

  if (toggle) toggle.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (scrim) scrim.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
  });

  // ----- Language pill cycle (cosmetic) -----
  const langBtn = $('.lang-pill');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const span = langBtn.querySelector('span');
      const current = span.textContent.trim();
      span.textContent = current === 'ES' ? 'EN' : 'ES';
      langBtn.setAttribute('aria-label',
        `Idioma actual: ${span.textContent === 'ES' ? 'Español' : 'English'}`);
    });
  }

  // ----- Smooth scroll for in-page anchors (with offset for sticky nav) -----
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navH = $('.main-nav')?.getBoundingClientRect().height ?? 0;
      const top  = target.getBoundingClientRect().top + window.scrollY - navH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
      if (!drawer.hidden) closeDrawer();
    });
  });

  // ----- Tiny cart counter helper (so the demo doesn't feel static) -----
  const cartCount = $('.btn--cart span');
  if (cartCount) {
    let value = 0.0;
    cartCount.closest('a').addEventListener('click', (e) => {
      e.preventDefault();
      // simulate a 39 peso snack add
      value = +(value + 39).toFixed(2);
      cartCount.textContent = `$${value.toFixed(2)}`;
    });
  }

  // ----- Reveal on scroll for cards -----
  const cards = $$('.card');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

    cards.forEach((card) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px)';
      card.style.transition = 'opacity .55s ease, transform .55s ease';
      io.observe(card);
    });
  }
})();
