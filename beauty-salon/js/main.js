/* AURUM: скрипты лендинга */
(() => {
  'use strict';

  /* ===== Настройки: заполнить, когда появятся данные салона ===== */
  const SALON = {
    yclients: {
      // Адрес скрипта из кода виджета YCLIENTS, например 'https://w123456.yclients.com/widgetJS'
      widgetSrc: '',
      // Запасной вариант: ссылка на страницу онлайн-записи, например 'https://n123456.yclients.com'
      bookingUrl: '',
    },
    // Координаты салона для Яндекс Карты (широта и долгота из карточки организации)
    map: { lat: null, lon: null, zoom: 16 },
  };

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // На настоящем сайте страница открыта не во фрейме; в превью-фрейме внешние виджеты недоступны
  const isTopLevel = (() => { try { return window.top === window.self; } catch (e) { return false; } })();

  const token = (name, fallback) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };
  const mulberry32 = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* хранилище недоступно */ } },
  };

  /* ===== Шапка: высота, фон при прокрутке, мобильное меню, плашка черновика ===== */
  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const bar = document.getElementById('draft-bar');
    if (bar) {
      if (store.get('aurum-draft-hidden') === '1') bar.hidden = true;
      bar.querySelector('button')?.addEventListener('click', () => {
        bar.hidden = true;
        store.set('aurum-draft-hidden', '1');
      });
    }

    const setHeight = () => root.style.setProperty('--header-h', `${header.offsetHeight}px`);
    setHeight();
    if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(header);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('is-scrolled', window.scrollY > 24);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const burger = header.querySelector('.burger');
    const nav = document.getElementById('nav');
    if (!burger || !nav) return;
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      nav.classList.toggle('is-open', open);
      header.classList.toggle('menu-open', open);
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); burger.focus(); }
    });
    window.matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* ===== Запись: виджет YCLIENTS или запасное окно ===== */
  function initBooking() {
    const buttons = document.querySelectorAll('.js-book');
    const { widgetSrc, bookingUrl } = SALON.yclients;

    if (widgetSrc && isTopLevel) {
      // Виджет YCLIENTS сам открывается по клику на элементы с классом ms_booking
      buttons.forEach((b) => b.classList.add('ms_booking'));
      const script = document.createElement('script');
      script.src = widgetSrc;
      script.charset = 'UTF-8';
      script.async = true;
      document.body.appendChild(script);
      return;
    }

    const dialog = document.getElementById('booking');
    const target = dialog?.querySelector('[data-booking-target]');
    buttons.forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      if (bookingUrl) { window.open(bookingUrl, '_blank', 'noopener'); return; }
      if (!dialog || typeof dialog.showModal !== 'function') return;
      if (target) target.textContent = b.dataset.book || 'Любая услуга';
      dialog.showModal();
    }));
    // Клик по затемнению вокруг окна закрывает его
    dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  /* ===== Вкладки прайса ===== */
  function initTabs() {
    const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
    if (!tabs.length) return;
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
    // Ссылки «Цены» в карточках услуг открывают нужную вкладку
    document.querySelectorAll('[data-open-tab]').forEach((link) => {
      link.addEventListener('click', () => {
        const tab = document.getElementById(link.dataset.openTab);
        if (tab) select(tab);
      });
    });
  }

  /* ===== Фильтр работ ===== */
  function initGallery() {
    const chips = document.querySelectorAll('.chip[data-filter]');
    const tiles = document.querySelectorAll('.tile[data-cat]');
    chips.forEach((chip) => chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      tiles.forEach((t) => { t.hidden = filter !== 'all' && t.dataset.cat !== filter; });
    }));
  }

  /* ===== Копирование телефона ===== */
  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      const label = btn.textContent;
      let timer = 0;
      const show = (text) => {
        btn.textContent = text;
        clearTimeout(timer);
        timer = setTimeout(() => { btn.textContent = label; }, 2000);
      };
      const selectText = () => {
        const el = btn.parentElement.querySelector('[data-copy-text]');
        if (el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        show('Выделено');
      };
      btn.addEventListener('click', () => {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(btn.dataset.copy).then(() => show('Скопировано'), selectText);
        } else {
          selectText();
        }
      });
    });
  }

  /* ===== Карта: Яндекс Карта по координатам или схема-заглушка ===== */
  function initMap() {
    const box = document.getElementById('map');
    if (!box) return;
    const { lat, lon, zoom } = SALON.map;
    if (lat && lon && isTopLevel) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://yandex.ru/map-widget/v1/?ll=${lon},${lat}&z=${zoom}&pt=${lon},${lat},pm2rdl`;
      iframe.title = 'Карта: как добраться до салона';
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      box.classList.add('has-iframe');
      box.appendChild(iframe);
      return;
    }
    drawMapSketch(box);
  }

  function drawMapSketch(box) {
    const canvas = box.querySelector('canvas');
    if (!canvas) return;
    const c = canvas.getContext('2d');
    const col = {
      bg: token('--ink-2', '#15120f'),
      water: token('--ink', '#0d0b09'),
      minor: token('--ink-3', '#1d1915'),
      major: token('--line', '#2e2822'),
      gold: hexToRgb(token('--gold', '#c9a46a')),
    };
    const paint = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rnd = mulberry32(7);
      const d = Math.hypot(w, h);
      const line = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

      c.fillStyle = col.bg;
      c.fillRect(0, 0, w, h);

      // Река под улицами: мосты получаются сами
      c.strokeStyle = col.water;
      c.lineWidth = Math.max(28, w * 0.06);
      c.beginPath();
      c.moveTo(-40, h * 0.82);
      c.bezierCurveTo(w * 0.3, h * 0.62, w * 0.6, h * 1.02, w + 40, h * 0.68);
      c.stroke();

      // Сетка кварталов, повёрнутая вокруг салона в центре
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(-0.2);
      c.strokeStyle = col.minor;
      c.lineWidth = 3;
      for (let x = -d / 2; x < d / 2; x += 34 + rnd() * 30) line(x, -d / 2, x, d / 2);
      for (let y = -d / 2; y < d / 2; y += 30 + rnd() * 34) line(-d / 2, y, d / 2, y);
      c.strokeStyle = col.major;
      c.lineWidth = 8;
      line(-d / 2, 0, d / 2, 0);
      line(-150, -d / 2, -150, d / 2);
      line(-d / 2, 160, d / 2, 160);
      line(130, -d / 2, 130, d / 2);
      // Маршрут до входа
      c.strokeStyle = `rgba(${col.gold},0.8)`;
      c.lineWidth = 2;
      c.setLineDash([3, 7]);
      c.beginPath();
      c.moveTo(-150, d / 2);
      c.lineTo(-150, 0);
      c.lineTo(0, 0);
      c.stroke();
      c.restore();
    };
    paint();
    if ('ResizeObserver' in window) new ResizeObserver(paint).observe(box);
  }

  /* ===== Фон первого экрана: золотые шёлковые пряди =====
     Две «ленты» из тонких линий колышутся, слегка закручиваются и ловят бегущий блик,
     как блеск ухоженных волос. Сверху медленно поднимается золотая пыль.
     Курсор даёт лёгкий параллакс. При prefers-reduced-motion рисуется один статичный кадр. */
  function initSilk() {
    const hero = document.getElementById('hero');
    const canvas = document.getElementById('silk');
    if (!hero || !canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const TAU = Math.PI * 2;
    const colors = [
      hexToRgb(token('--gold', '#c9a46a')),
      hexToRgb(token('--gold-soft', '#e6d2a8')),
      hexToRgb(token('--bronze', '#8c6a3f')),
    ];

    let W = 0;
    let H = 0;
    let wide = true;
    let ribbons = [];
    let dust = [];
    let raf = 0;
    let last = 0;
    let time = 9; // старт с середины движения: первый же кадр выглядит законченным
    let inView = true;
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };

    const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    const bezD = (a, b, c, d, t) => { const u = 1 - t; return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c); };

    function makeRibbon(cfg, rnd) {
      const strands = [];
      for (let i = 0; i < cfg.count; i++) {
        const r = rnd();
        strands.push({
          u: (i + rnd() * 0.8) / cfg.count,           // место пряди поперёк ленты
          c: colors[r < 0.55 ? 0 : r < 0.8 ? 1 : 2],
          a: 0.45 + rnd() * 0.9,                       // яркость
          w: 0.55 + rnd() * 0.9,                       // толщина
          amp: cfg.amp * (0.12 + rnd() * 0.3),         // собственная волна пряди
          f: 6 + rnd() * 7,
          sp: 0.35 + rnd() * 0.5,
          ph: rnd() * TAU,
        });
      }
      const n = cfg.points + 1;
      const buf = () => new Float32Array(n);
      return { ...cfg, strands, bx: buf(), by: buf(), nx: buf(), ny: buf(), tw: buf(), wv: buf(), xs: buf(), ys: buf() };
    }

    function newMote(rnd, anywhere) {
      const big = rnd() < 0.16;
      return {
        x: W * (wide ? 0.3 + rnd() * 0.7 : rnd()),
        y: anywhere ? rnd() * H : H + 20,
        z: 0.25 + rnd() * 0.75,
        big,
        r: big ? 6 + rnd() * 14 : 0.5 + rnd() * 1.3,
        v: 5 + rnd() * 12,
        ph: rnd() * TAU,
        tw: 0.6 + rnd() * 1.6,
        c: colors[rnd() < 0.6 ? 1 : 0],
      };
    }

    function layout() {
      const rect = hero.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wide = W >= 900;
      const s = Math.min(W, H);
      const rnd = mulberry32(20261014);
      // Контрольные точки кривых в долях ширины и высоты; концы уходят за край экрана
      const configs = wide ? [
        { p: [[0.80, -0.32], [1.20, 0.20], [0.38, 0.62], [0.74, 1.36]], width: s * 0.34, count: 92, points: 72, amp: H * 0.045, alpha: 0.12, lw: 0.9, seed: 0 },
        { p: [[1.04, -0.28], [0.64, 0.30], [1.18, 0.70], [0.92, 1.32]], width: s * 0.2, count: 46, points: 60, amp: H * 0.035, alpha: 0.075, lw: 0.75, seed: 2.1 },
      ] : [
        { p: [[1.08, -0.22], [0.22, 0.30], [1.22, 0.62], [0.38, 1.26]], width: s * 0.62, count: 62, points: 52, amp: H * 0.03, alpha: 0.12, lw: 0.8, seed: 0 },
        { p: [[0.55, -0.22], [1.12, 0.36], [0.28, 0.70], [0.96, 1.26]], width: s * 0.34, count: 28, points: 44, amp: H * 0.025, alpha: 0.08, lw: 0.7, seed: 2.1 },
      ];
      ribbons = configs.map((cfg) => makeRibbon(cfg, rnd));
      dust = Array.from({ length: wide ? 70 : 32 }, () => newMote(rnd, true));
      draw(0);
    }

    function drawRibbon(rb, t) {
      const n = rb.points;
      const ox = ptr.x * 26;
      const oy = ptr.y * 16;
      const P = rb.p.map(([x, y]) => [x * W + ox, y * H + oy]);
      const sway = Math.sin(t * 0.21 + rb.seed) * H * 0.02;

      for (let k = 0; k <= n; k++) {
        const s = k / n;
        const dx = bezD(P[0][0], P[1][0], P[2][0], P[3][0], s);
        const dy = bezD(P[0][1], P[1][1], P[2][1], P[3][1], s);
        const len = Math.hypot(dx, dy) || 1;
        rb.nx[k] = -dy / len;
        rb.ny[k] = dx / len;
        rb.bx[k] = bez(P[0][0], P[1][0], P[2][0], P[3][0], s);
        rb.by[k] = bez(P[0][1], P[1][1], P[2][1], P[3][1], s);
        // Лента закручивается: её ширина «дышит» по длине и во времени
        rb.tw[k] = rb.width * (0.16 + 0.84 * Math.abs(Math.cos(s * 3.1 + t * 0.17 + rb.seed)));
        rb.wv[k] = rb.amp * Math.sin(s * 6.8 - t * 0.75 + rb.seed) + sway;
      }

      // Блик бежит вниз по прядям и уходит за край, потом начинается снова
      const sheen = ((t * 0.065 + rb.seed * 0.3) % 1.7) - 0.35;
      const band = 0.11;
      const { xs, ys } = rb;

      for (const st of rb.strands) {
        for (let k = 0; k <= n; k++) {
          const s = k / n;
          const off = (st.u - 0.5) * rb.tw[k] + rb.wv[k] + st.amp * Math.sin(s * st.f + t * st.sp + st.ph);
          xs[k] = rb.bx[k] + rb.nx[k] * off;
          ys[k] = rb.by[k] + rb.ny[k] * off;
        }
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let k = 1; k <= n; k++) ctx.lineTo(xs[k], ys[k]);
        ctx.lineWidth = rb.lw * st.w;
        ctx.strokeStyle = `rgba(${st.c},${(rb.alpha * st.a).toFixed(3)})`;
        ctx.stroke();

        const k0 = Math.max(0, Math.floor((sheen - band) * n));
        const k1 = Math.min(n, Math.ceil((sheen + band) * n));
        if (k1 - k0 < 2) continue;
        const peak = Math.min(1, rb.alpha * st.a * 3.2).toFixed(3);
        const g = ctx.createLinearGradient(xs[k0], ys[k0], xs[k1], ys[k1]);
        g.addColorStop(0, `rgba(${colors[1]},0)`);
        g.addColorStop(0.5, `rgba(${colors[1]},${peak})`);
        g.addColorStop(1, `rgba(${colors[1]},0)`);
        ctx.beginPath();
        ctx.moveTo(xs[k0], ys[k0]);
        for (let k = k0 + 1; k <= k1; k++) ctx.lineTo(xs[k], ys[k]);
        ctx.strokeStyle = g;
        ctx.lineWidth = rb.lw * st.w * 1.3;
        ctx.stroke();
      }
    }

    function drawDust(t, dt) {
      for (const m of dust) {
        if (dt) {
          m.y -= m.v * m.z * dt;
          m.x += Math.sin(t * 0.4 + m.ph) * 0.12 * m.z;
          if (m.y < -24) Object.assign(m, newMote(Math.random, false));
        }
        const twinkle = 0.5 + 0.5 * Math.sin(t * m.tw + m.ph);
        const x = m.x + ptr.x * 14 * m.z;
        const y = m.y + ptr.y * 9 * m.z;
        if (m.big) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, m.r);
          g.addColorStop(0, `rgba(${m.c},${(0.08 * twinkle * m.z + 0.02).toFixed(3)})`);
          g.addColorStop(1, `rgba(${m.c},0)`);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = `rgba(${m.c},${(0.2 + 0.6 * twinkle * m.z).toFixed(3)})`;
        }
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, TAU);
        ctx.fill();
      }
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter'; // пересечения прядей светлеют, как у шёлка
      for (const rb of ribbons) drawRibbon(rb, time);
      drawDust(time, dt);
      ctx.globalCompositeOperation = 'source-over';
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      ptr.x += (ptr.tx - ptr.x) * 0.045;
      ptr.y += (ptr.ty - ptr.y) * 0.045;
      hero.style.setProperty('--px', ptr.x.toFixed(3));
      hero.style.setProperty('--py', ptr.y.toFixed(3));
      draw(dt);
    }

    // Анимация идёт только когда первый экран виден, вкладка активна и движение не отключено
    function sync() {
      const run = !reduceMotion.matches && inView && !document.hidden;
      if (run && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    layout();
    let resizeTimer = 0;
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 120); }).observe(hero);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(hero);
    }
    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener('change', () => { sync(); draw(0); });
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      ptr.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    hero.addEventListener('pointerleave', () => { ptr.tx = 0; ptr.ty = 0; });
    sync();
  }

  function init() {
    initHeader();
    initBooking();
    initTabs();
    initGallery();
    initCopy();
    initMap();
    initSilk();
    document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
