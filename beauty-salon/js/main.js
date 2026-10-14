/* Queen Studio: скрипты лендинга */
(() => {
  'use strict';

  /* ===== Настройки: заполнить, когда появятся данные салона ===== */
  const SALON = {
    booking: {
      // Ссылка на страницу онлайн-записи. Рекомендую Reservio: 'https://queen-studio.reservio.com'
      // Пока пусто, кнопки «Записаться» открывают окно с телефоном.
      url: '',
    },
    map: {
      // Адрес для Google Maps. Карта грузится только по кнопке, чтобы не ставить cookies без согласия (GDPR).
      query: 'Husova 557, 274 01 Slaný',
    },
  };

  const I18N = window.QS_I18N || {};
  const LANGS = ['cs', 'en', 'uk'];
  const LANG_META = {
    cs: { flag: 'flag-cz', code: 'CZ', name: 'Čeština', locale: 'cs-CZ' },
    en: { flag: 'flag-gb', code: 'EN', name: 'English', locale: 'en-GB' },
    uk: { flag: 'flag-ua', code: 'UA', name: 'Українська', locale: 'uk-UA' },
  };

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // На настоящем сайте страница открыта не во фрейме; в превью-фрейме внешние виджеты недоступны
  const isTopLevel = (() => { try { return window.top === window.self; } catch (e) { return false; } })();

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
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
    get(key, session) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch (e) { return null; } },
    set(key, value, session) { try { (session ? sessionStorage : localStorage).setItem(key, value); } catch (e) { /* хранилище недоступно */ } },
  };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeBack = (p) => { const c1 = 1.5; const c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

  /* ===== Языки ===== */
  let lang = 'cs';
  const t = (key) => (I18N[lang] && I18N[lang][key]) ?? (I18N.cs && I18N.cs[key]) ?? '';

  function detectLang() {
    const saved = store.get('qs-lang');
    if (LANGS.includes(saved)) return saved;
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const raw of prefs) {
      const l = String(raw).toLowerCase();
      if (l.startsWith('cs') || l.startsWith('sk')) return 'cs';
      if (l.startsWith('uk') || l.startsWith('ru')) return 'uk';
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }

  function priceHTML(value, from) {
    const num = new Intl.NumberFormat(LANG_META[lang].locale).format(value).replace(/\s/g, ' ');
    const amount = lang === 'en' ? `CZK ${num}` : `${num} Kč`;
    return from ? `<small>${t('from')}</small> ${amount}` : amount;
  }

  function applyLang(next, save) {
    lang = LANGS.includes(next) ? next : 'cs';
    const dict = I18N[lang] || {};
    root.lang = lang;
    $$('[data-i18n]').forEach((el) => { const v = dict[el.dataset.i18n]; if (v != null) el.textContent = v; });
    $$('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });
    $$('[data-price]').forEach((el) => { el.innerHTML = priceHTML(Number(el.dataset.price), el.hasAttribute('data-from')); });
    $$('[data-min]').forEach((el) => { el.textContent = `${el.dataset.min} ${t('price.min')}`; });
    document.title = t('meta.title');
    $('meta[name="description"]')?.setAttribute('content', t('meta.desc'));
    if (save) store.set('qs-lang', lang);
    document.dispatchEvent(new CustomEvent('qs:lang'));
  }

  function initLang() {
    const wrap = $('#lang');
    if (!wrap) return;
    const btn = $('.lang__btn', wrap);
    const menu = $('#lang-menu');
    const opts = $$('.lang__opt', wrap);
    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (open) (opts.find((o) => o.dataset.lang === lang) || opts[0]).focus();
    };
    const sync = () => {
      const meta = LANG_META[lang];
      $('.lang__flag use', btn).setAttribute('href', `#${meta.flag}`);
      $('.lang__code', btn).textContent = meta.code;
      btn.setAttribute('aria-label', `${t('lang.label')}: ${meta.name}`);
      opts.forEach((o) => o.setAttribute('aria-current', String(o.dataset.lang === lang)));
    };
    btn.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-lang]');
      if (!opt) return;
      applyLang(opt.dataset.lang, true);
      setOpen(false);
      btn.focus();
    });
    menu.addEventListener('keydown', (e) => {
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length].focus();
      }
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target) && !menu.hidden) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
    document.addEventListener('qs:lang', sync);
    sync();
  }

  /* ===== Шапка: высота, фон при прокрутке, мобильное меню, плашка черновика ===== */
  function initHeader() {
    const header = $('.site-header');
    if (!header) return;

    const bar = $('#draft-bar');
    if (bar) {
      if (store.get('qs-draft-hidden') === '1') bar.hidden = true;
      $('button', bar)?.addEventListener('click', () => { bar.hidden = true; store.set('qs-draft-hidden', '1'); });
    }

    const setHeight = () => root.style.setProperty('--header-h', `${header.offsetHeight}px`);
    setHeight();
    if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(header);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { header.classList.toggle('is-scrolled', window.scrollY > 24); ticking = false; });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const burger = $('.burger', header);
    const nav = $('#nav');
    if (!burger || !nav) return;
    const isOpen = () => burger.getAttribute('aria-expanded') === 'true';
    const label = () => burger.setAttribute('aria-label', t(isOpen() ? 'menu.close' : 'menu.open'));
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      header.classList.toggle('menu-open', open);
      label();
    };
    burger.addEventListener('click', () => setOpen(!isOpen()));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { setOpen(false); burger.focus(); } });
    window.matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
    document.addEventListener('qs:lang', label);
  }

  /* ===== Заставка: логотип собирается по частям и улетает в шапку ===== */
  function initIntro(onDone) {
    const intro = $('#intro');
    if (!intro || intro.hidden) { root.classList.remove('is-intro'); onDone(); return; }
    intro.classList.add('is-running');
    root.classList.add('intro-lock');

    const q = (sel) => $(sel, intro);
    const logo = q('.intro__logo');
    const track = q('.intro-track');
    const spark = q('.intro-spark');
    const crown = q('.intro-crown');
    const star = q('.intro-star');
    const wipeQueen = q('.intro-wipe-queen');
    const studio = q('.intro-studio');
    const wipeScript = q('.intro-wipe-script');
    const glint = q('.intro-glint');
    const glintGrad = $('#qs-glint');
    const place = q('.intro__place');
    const ring = q('.intro-ring');
    const script = q('.intro-script');
    const trackLen = track.getTotalLength();
    const BUILD_END = 3050;

    // t — миллисекунды от начала. Кольцо → Queen → корона с искрой → STUDIO → beauty salon → блик
    function render(time) {
      const r = easeInOut(seg(time, 250, 1500));
      track.setAttribute('stroke-dashoffset', (1 - r).toFixed(4));
      const pt = track.getPointAtLength(trackLen * r);
      spark.setAttribute('cx', pt.x.toFixed(1));
      spark.setAttribute('cy', pt.y.toFixed(1));
      spark.setAttribute('opacity', (seg(time, 250, 420) * (1 - seg(time, 1420, 1650))).toFixed(3));

      wipeQueen.setAttribute('width', (easeOut(seg(time, 650, 1600)) * 900).toFixed(1));

      const c = seg(time, 1250, 1850);
      crown.setAttribute('opacity', easeOut(c).toFixed(3));
      crown.setAttribute('transform', `translate(0 ${(-34 * (1 - easeBack(c))).toFixed(2)}) rotate(${(-7 * (1 - easeOut(c))).toFixed(2)} 292 216)`);

      const s = seg(time, 1750, 2200);
      const pulse = s < 0.5 ? s * 2 : 2 - s * 2;
      star.setAttribute('opacity', pulse.toFixed(3));
      star.setAttribute('transform', `translate(292 172) rotate(${(s * 90).toFixed(1)}) scale(${(0.4 + pulse).toFixed(3)}) translate(-292 -172)`);

      const st = easeOut(seg(time, 1500, 2150));
      studio.setAttribute('opacity', st.toFixed(3));
      studio.setAttribute('letter-spacing', (16 + 28 * (1 - st)).toFixed(2));

      wipeScript.setAttribute('width', (easeInOut(seg(time, 1850, 2700)) * 1000).toFixed(1));

      const g = seg(time, 2350, 3000);
      glint.setAttribute('opacity', g > 0 && g < 1 ? '1' : '0');
      glintGrad.setAttribute('gradientTransform', `translate(${(-260 + g * 1300).toFixed(1)} 0) skewX(-22)`);

      place.style.opacity = easeOut(seg(time, 2400, 2950)).toFixed(3);
    }

    let raf = 0;
    let start = 0;
    let leaving = false;

    function finish() {
      root.classList.remove('is-intro', 'intro-lock');
      store.set('qs-intro', '1', true);
      intro.remove();
      onDone();
    }

    // Логотип уменьшается и встаёт ровно на место логотипа в шапке; кольцо и подпись растворяются
    function leave(fast) {
      if (leaving) return;
      leaving = true;
      cancelAnimationFrame(raf);
      render(BUILD_END);
      const target = $('.site-header .logo__svg');
      const bg = q('.intro__bg');
      const dur = fast ? 500 : 950;
      const easing = 'cubic-bezier(.65, 0, .25, 1)';
      if (!target || !logo.animate) { finish(); return; }
      const a = logo.getBoundingClientRect();
      const h = target.getBoundingClientRect();
      const kH = h.width / 626;
      const kI = a.width / 880;
      const tx = h.left - a.left - (214 - 10) * kH;
      const ty = h.top - a.top - (166 - 130) * kH;
      logo.style.transformOrigin = '0 0';
      const move = logo.animate(
        [{ transform: 'none' }, { transform: `translate(${tx}px, ${ty}px) scale(${kH / kI})` }],
        { duration: dur, easing, fill: 'forwards' },
      );
      const fade = { duration: dur * 0.55, easing: 'ease-out', fill: 'forwards' };
      [ring, script, place, q('.intro__skip')].forEach((el) => el && el.animate([{ opacity: 1 }, { opacity: 0 }], fade));
      bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
      move.onfinish = () => {
        root.classList.remove('is-intro');
        logo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = finish;
      };
    }

    const tick = (now) => {
      if (!start) start = now;
      const time = now - start;
      render(time);
      if (time >= BUILD_END + 350) { leave(false); return; }
      raf = requestAnimationFrame(tick);
    };

    const skip = () => leave(true);
    q('.intro__skip').addEventListener('click', skip);
    intro.addEventListener('click', skip);
    window.addEventListener('wheel', skip, { once: true, passive: true });
    window.addEventListener('touchmove', skip, { once: true, passive: true });
    window.addEventListener('keydown', (e) => { if (!leaving && ['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) skip(); });

    render(0);
    // Ждём шрифты логотипа, но не дольше 1,2 секунды
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(() => {
      if (!leaving) raf = requestAnimationFrame(tick);
    });
  }

  /* ===== Первый экран: кольцо прорисовывается, параллакс за курсором ===== */
  function initHeroRing() {
    const track = $('.hero-track');
    const hero = $('#hero');
    if (!track || !hero) return;
    if (!reduceMotion.matches && track.animate) {
      track.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 2200, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'backwards' });
    }
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    const step = () => {
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      ptr.y += (ptr.ty - ptr.y) * 0.06;
      hero.style.setProperty('--px', ptr.x.toFixed(3));
      hero.style.setProperty('--py', ptr.y.toFixed(3));
      raf = Math.abs(ptr.tx - ptr.x) + Math.abs(ptr.ty - ptr.y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduceMotion.matches) return;
      const r = hero.getBoundingClientRect();
      ptr.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener('pointerleave', () => { ptr.tx = 0; ptr.ty = 0; if (!raf) raf = requestAnimationFrame(step); });

    // Если в первый экран добавлено видео, кнопка в круглом значке ставит его на паузу
    const video = $('.hero__video', hero);
    const core = $('.hero__badge-core', hero);
    if (video && core) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hero__play';
      core.replaceChildren(btn);
      hero.querySelector('.hero__badge').removeAttribute('aria-hidden');
      const sync = () => {
        btn.setAttribute('aria-label', t(video.paused ? 'hero.play' : 'hero.pause'));
        btn.textContent = video.paused ? '▶' : '❚❚';
      };
      btn.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });
      video.addEventListener('play', sync);
      video.addEventListener('pause', sync);
      document.addEventListener('qs:lang', sync);
      if (reduceMotion.matches) video.pause();
      sync();
    }
  }

  /* ===== Тёплые огни боке на фоне первого экрана ===== */
  function initBokeh() {
    const canvas = $('#bokeh');
    const box = canvas?.parentElement;
    if (!canvas || !box || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const TAU = Math.PI * 2;
    const colors = [hexToRgb(token('--gold', '#cfa862')), hexToRgb(token('--gold-soft', '#ecd59a')), hexToRgb(token('--nude', '#c9958a'))];
    let W = 0;
    let H = 0;
    let motes = [];
    let raf = 0;
    let last = 0;
    let time = 4;
    let inView = true;

    function layout() {
      W = box.clientWidth;
      H = box.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rnd = mulberry32(557);
      const count = W > 700 ? 34 : 20;
      motes = Array.from({ length: count }, () => {
        const big = rnd() < 0.45;
        return {
          x: rnd() * W, y: rnd() * H, z: 0.3 + rnd() * 0.7,
          r: big ? 14 + rnd() * 34 : 1 + rnd() * 2.2,
          big, v: 4 + rnd() * 9, ph: rnd() * TAU, tw: 0.4 + rnd() * 1.1,
          c: colors[rnd() < 0.55 ? 1 : rnd() < 0.7 ? 0 : 2],
        };
      });
      draw(0);
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        if (dt) {
          m.y -= m.v * m.z * dt;
          m.x += Math.sin(time * 0.3 + m.ph) * 0.1 * m.z;
          if (m.y < -60) { m.y = H + 60; m.x = Math.random() * W; }
        }
        const tw = 0.5 + 0.5 * Math.sin(time * m.tw + m.ph);
        if (m.big) {
          const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          g.addColorStop(0, `rgba(${m.c},${(0.05 + 0.07 * tw * m.z).toFixed(3)})`);
          g.addColorStop(0.7, `rgba(${m.c},${(0.02 + 0.03 * tw * m.z).toFixed(3)})`);
          g.addColorStop(1, `rgba(${m.c},0)`);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = `rgba(${m.c},${(0.2 + 0.55 * tw * m.z).toFixed(3)})`;
        }
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      draw(dt);
    }
    function sync() {
      const run = !reduceMotion.matches && inView && !document.hidden;
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    layout();
    if ('ResizeObserver' in window) {
      let timer = 0;
      new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(layout, 150); }).observe(box);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(box);
    }
    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener('change', () => { sync(); draw(0); });
    sync();
  }

  /* ===== Маникюр: когда появится видео (video[data-scrub]), кадр раскрывается вместе с прокруткой ===== */
  function initManiScrub() {
    const section = $('#manicure');
    const video = section && $('video[data-scrub]', section);
    if (!video || reduceMotion.matches) return;
    section.classList.add('is-scrub');
    video.pause();
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!video.duration) return;
      const r = section.getBoundingClientRect();
      const p = clamp01(-r.top / (r.height - window.innerHeight));
      video.currentTime = p * (video.duration - 0.05);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    video.addEventListener('loadedmetadata', update);
  }

  /* ===== Запись ===== */
  function initBooking() {
    const dialog = $('#booking');
    const target = dialog && $('[data-booking-target]', dialog);
    let key = 'booking.any';
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.js-book');
      if (!b) return;
      e.preventDefault();
      if (SALON.booking.url && isTopLevel) { window.open(SALON.booking.url, '_blank', 'noopener'); return; }
      if (!dialog || typeof dialog.showModal !== 'function') return;
      key = b.dataset.bookKey || 'booking.any';
      if (target) target.textContent = t(key);
      dialog.showModal();
    });
    document.addEventListener('qs:lang', () => { if (dialog?.open && target) target.textContent = t(key); });
    // Клик по затемнению вокруг окна закрывает его
    dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

  /* ===== Вкладки прайса ===== */
  function initTabs() {
    const tabs = $$('.tabs [role="tab"]');
    if (!tabs.length) return;
    const select = (tab, focus) => {
      tabs.forEach((x) => {
        const on = x === tab;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(x.getAttribute('aria-controls'));
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
    // Карточки услуг открывают нужную вкладку прайса
    $$('[data-open-tab]').forEach((link) => {
      link.addEventListener('click', () => {
        const tab = document.getElementById(link.dataset.openTab);
        if (tab) select(tab);
      });
    });
  }

  /* ===== Фильтр работ ===== */
  function initGallery() {
    const chips = $$('.chip[data-filter]');
    const tiles = $$('.tile[data-cat]');
    chips.forEach((chip) => chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      tiles.forEach((tile) => { tile.hidden = filter !== 'all' && tile.dataset.cat !== filter; });
    }));
  }

  /* ===== Копирование телефона ===== */
  function initCopy() {
    $$('[data-copy]').forEach((btn) => {
      let timer = 0;
      const show = (key) => {
        btn.textContent = t(key);
        clearTimeout(timer);
        timer = setTimeout(() => { btn.textContent = t('copy'); }, 2000);
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
        show('selected');
      };
      btn.addEventListener('click', () => {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(btn.dataset.copy).then(() => show('copied'), selectText);
        else selectText();
      });
    });
  }

  /* ===== Карта: схема-заглушка, на сайте Google Maps по кнопке ===== */
  function initMap() {
    const box = $('#map');
    if (!box) return;
    drawMapSketch(box);
    const consent = $('.map__consent', box);
    if (!isTopLevel || !consent) return;
    consent.hidden = false;
    $('.map__load', consent).addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(SALON.map.query)}&hl=${lang}&z=16&output=embed`;
      iframe.title = 'Google Maps: Queen Studio, Husova 557, Slaný';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      box.classList.add('has-iframe');
      box.appendChild(iframe);
    });
  }

  function drawMapSketch(box) {
    const canvas = $('canvas', box);
    if (!canvas) return;
    const c = canvas.getContext('2d');
    const col = {
      bg: token('--ink-2', '#13100c'),
      water: token('--ink', '#0b0907'),
      minor: token('--ink-3', '#1c1813'),
      major: token('--line', '#2d271f'),
      gold: hexToRgb(token('--gold', '#cfa862')),
    };
    const paint = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rnd = mulberry32(274);
      const d = Math.hypot(w, h);
      const line = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
      c.fillStyle = col.bg;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = col.water;
      c.lineWidth = Math.max(26, w * 0.05);
      c.beginPath();
      c.moveTo(-40, h * 0.18);
      c.bezierCurveTo(w * 0.35, h * 0.32, w * 0.55, h * 0.02, w + 40, h * 0.22);
      c.stroke();
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(0.28);
      c.strokeStyle = col.minor;
      c.lineWidth = 3;
      for (let x = -d / 2; x < d / 2; x += 32 + rnd() * 30) line(x, -d / 2, x, d / 2);
      for (let y = -d / 2; y < d / 2; y += 30 + rnd() * 34) line(-d / 2, y, d / 2, y);
      c.strokeStyle = col.major;
      c.lineWidth = 8;
      line(-d / 2, 0, d / 2, 0);
      line(-140, -d / 2, -140, d / 2);
      line(-d / 2, 150, d / 2, 150);
      line(120, -d / 2, 120, d / 2);
      c.strokeStyle = `rgba(${col.gold},0.85)`;
      c.lineWidth = 2;
      c.setLineDash([3, 7]);
      c.beginPath();
      c.moveTo(-140, d / 2);
      c.lineTo(-140, 0);
      c.lineTo(0, 0);
      c.stroke();
      c.restore();
    };
    paint();
    if ('ResizeObserver' in window) new ResizeObserver(paint).observe(box);
  }

  function init() {
    applyLang(detectLang(), false);
    initHeader();
    initLang();
    initBooking();
    initTabs();
    initGallery();
    initCopy();
    initMap();
    initBokeh();
    initManiScrub();
    initIntro(initHeroRing);
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
