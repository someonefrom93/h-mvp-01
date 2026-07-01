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

  // ----- Cart store -----
  // (demo counter removed — replaced by CartStore)

  // Static product catalogue — mirrors the 17 menu cards in index.html
  const DATA_PRODUCTS = [
    { id: 'whopper',            name: 'WHOPPER®',            unit_price: 119, category: 'hamburguesas' },
    { id: 'big-king',           name: 'Big King',            unit_price: 129, category: 'hamburguesas' },
    { id: 'hamburguesa-bbq',    name: 'Hamburguesa BBQ',     unit_price: 109, category: 'hamburguesas' },
    { id: 'doble-queso',        name: 'Doble Queso',         unit_price:  89, category: 'hamburguesas' },
    { id: 'pollo-crujiente',    name: 'Pollo Crujiente',     unit_price:  99, category: 'pollo' },
    { id: 'nuggets-6',          name: 'Nuggets (6 piezas)',  unit_price:  69, category: 'pollo' },
    { id: 'pollo-bbq',          name: 'Pollo BBQ',           unit_price: 109, category: 'pollo' },
    { id: 'papas-francesa',     name: 'Papas a la Francesa', unit_price:  49, category: 'acompanamientos' },
    { id: 'onion-rings',        name: 'Onion Rings',         unit_price:  55, category: 'acompanamientos' },
    { id: 'papas-supreme',      name: 'Papas Supreme',        unit_price:  69, category: 'acompanamientos' },
    { id: 'ensalada-fresca',    name: 'Ensalada Fresca',     unit_price:  59, category: 'acompanamientos' },
    { id: 'coca-cola',          name: 'Coca-Cola',           unit_price:  35, category: 'bebidas' },
    { id: 'limonada-natural',    name: 'Limonada Natural',    unit_price:  39, category: 'bebidas' },
    { id: 'malteada-chocolate', name: 'Malteada de Chocolate', unit_price: 59, category: 'bebidas' },
    { id: 'sundae-chocolate',   name: 'Sundae de Chocolate', unit_price:  45, category: 'postres' },
    { id: 'pie-de-manzana',     name: 'Pie de Manzana',      unit_price:  39, category: 'postres' },
    { id: 'cono-de-nieve',      name: 'Cono de Nieve',       unit_price:  29, category: 'postres' },
  ];

  // CartStore factory — factored out so tests can inject memoryStorage / mock bus
  function createCartStore({ storage, bus }) {
    const STORAGE_KEY = 'burger_cart_v1';
    let items = [];

    function load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !Array.isArray(data.items)) return [];
        return data.items;
      } catch {
        return [];
      }
    }

    function save() {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
    }

    function emit() {
      subscribers.forEach(fn => fn(getItems()));
    }

    const subscribers = new Set();

    function getItems() {
      return items.slice();
    }

    function subtotal() {
      return items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    }

    function count() {
      return items.reduce((n, i) => n + i.quantity, 0);
    }

    function add(product) {
      const existing = items.find(i => i.id === product.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        items.push({ id: product.id, name: product.name, unit_price: product.unit_price, category: product.category, quantity: 1 });
      }
      save();
      emit();
    }

    function remove(productId) {
      const idx = items.findIndex(i => i.id === productId);
      if (idx !== -1) items.splice(idx, 1);
      save();
      emit();
    }

    function setQty(productId, qty) {
      if (qty <= 0) { remove(productId); return; }
      const item = items.find(i => i.id === productId);
      if (item) { item.quantity = qty; save(); emit(); }
    }

    function clear() {
      items = [];
      save();
      emit();
    }

    // Restore state from storage on creation
    items = load();

    // Cross-tab sync: reload from storage when another tab writes
    bus.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        items = load();
        emit();
      }
    });

    return { add, remove, setQty, clear, getItems, subtotal, count, subscribe: (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); } };
  }

  // Singleton cart store — uses real localStorage and window
  const CartStore = createCartStore({ storage: localStorage, bus: window });

  // Wire nav badge to CartStore
  const cartBadge = $('.cart-badge');
  if (cartBadge) {
    function updateBadge(items) {
      const n = items.reduce((sum, i) => sum + i.quantity, 0);
      cartBadge.textContent = String(n);
      cartBadge.classList.toggle('is-visible', n > 0);
    }
    CartStore.subscribe(updateBadge);
    // Sync badge with current state on page load
    updateBadge(CartStore.getItems());
  }

  // Wire "Agregar al carrito" buttons on all 17 menu cards
  $$('.card[data-product-id]').forEach((card) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card__add';
    btn.textContent = 'Agregar al carrito';
    const productId = card.dataset.productId;
    btn.addEventListener('click', () => {
      const product = DATA_PRODUCTS.find(p => p.id === productId);
      if (product) CartStore.add(product);
      openCartDrawer(); // PR 2b: open drawer after adding
    });
    // Append button after the price span inside card__body
    const priceSpan = card.querySelector('.card__price');
    if (priceSpan) priceSpan.after(btn);
  });

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

  // ----- Menu tabs -----
  const menuTabs = $$('#menu [role="tab"]');
  if (menuTabs.length) {
    const tablist = $('#menu [role="tablist"]');
    const menuCards = $$('#menu .card');

    const filterCards = (category) => {
      menuCards.forEach((card) => {
        if (card.dataset.category === category) {
          card.classList.remove('card--hidden');
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        } else {
          card.classList.add('card--hidden');
        }
      });
    };

    menuTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const category = tab.dataset.menuFilter;
        menuTabs.forEach((t) => {
          t.setAttribute('aria-selected', 'false');
          t.classList.remove('is-active');
        });
        tab.setAttribute('aria-selected', 'true');
        tab.classList.add('is-active');
        filterCards(category);
      });
    });

    tablist.addEventListener('keydown', (e) => {
      const current = document.activeElement;
      if (!current || current.getAttribute('role') !== 'tab') return;

      const tabs = $$('[role="tab"]', tablist);
      let idx = tabs.indexOf(current);

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          idx = (idx + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          idx = (idx - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          e.preventDefault();
          idx = 0;
          break;
        case 'End':
          e.preventDefault();
          idx = tabs.length - 1;
          break;
        default:
          return;
      }
      tabs[idx].focus();
    });
  }

  // ----- Cart drawer -----
  let drawerUnsubscribe = null;

  function openCartDrawer() {
    cartDrawer.showModal();
    document.body.style.overflow = 'hidden';
    // Render immediately so drawer shows current cart state on open
    renderCartDrawer();
    // Subscribe to CartStore — re-render on any cart mutation
    drawerUnsubscribe = CartStore.subscribe(renderCartDrawer);
  }

  function closeCartDrawer() {
    cartDrawer.close();
  }

  // Handle close event — fires on both explicit .close() call AND ESC key
  cartDrawer.addEventListener('close', () => {
    document.body.style.overflow = '';
    if (drawerUnsubscribe) { drawerUnsubscribe(); drawerUnsubscribe = null; }
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCartDrawer() {
    const items = CartStore.getItems();
    if (items.length === 0) {
      cartDrawerBody.innerHTML = '<p class="cart-drawer__empty">Tu carrito está vacío</p>';
      cartDrawerCheckout.disabled = true;
    } else {
      cartDrawerBody.innerHTML = items.map(item => `
        <article class="cart-row" data-id="${escapeHtml(item.id)}">
          <div class="cart-row__info">
            <h3 class="cart-row__name">${escapeHtml(item.name)}</h3>
            <span class="cart-row__price">$${item.unit_price}</span>
          </div>
          <div class="cart-row__qty">
            <button class="cart-row__btn" data-action="dec" aria-label="Restar uno">−</button>
            <span class="cart-row__qty-value">${item.quantity}</span>
            <button class="cart-row__btn" data-action="inc" aria-label="Sumar uno">+</button>
            <button class="cart-row__btn cart-row__btn--remove" data-action="remove" aria-label="Quitar del carrito">×</button>
          </div>
          <div class="cart-row__line-total">$${(item.unit_price * item.quantity).toFixed(0)}</div>
        </article>
      `).join('');
      cartDrawerCheckout.disabled = false;
    }
    cartDrawerSubtotal.textContent = `$${CartStore.subtotal().toFixed(0)}`;
  }

  function initCartDrawer() {
    // Wire close button
    cartDrawerClose.addEventListener('click', closeCartDrawer);

    // Wire "Ir a pagar" stub — PR 3 wires the real checkout
    cartDrawerCheckout.addEventListener('click', () => {
      console.info('[PR2b] checkout stub — PR 3 will wire this');
    });

    // Event delegation for quantity controls in drawer body
    cartDrawerBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const row = btn.closest('[data-id]');
      if (!row) return;
      const id = row.dataset.id;
      if (btn.dataset.action === 'inc') {
        const item = CartStore.getItems().find(i => i.id === id);
        if (item) CartStore.setQty(id, item.quantity + 1);
      } else if (btn.dataset.action === 'dec') {
        const item = CartStore.getItems().find(i => i.id === id);
        if (item) CartStore.setQty(id, item.quantity - 1);
      } else if (btn.dataset.action === 'remove') {
        CartStore.remove(id);
      }
    });
  }

  // Wire cart icon in nav to open drawer
  const cartBtn = $('.btn--cart');
  if (cartBtn) {
    cartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  }

  // Initialize drawer module
  initCartDrawer();
})();
