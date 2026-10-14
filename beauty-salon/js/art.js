/* Queen Studio: рисованные анимации в золотой линейной графике.
   girl(): девушка со спины проводит рукой по волосам (первый экран).
   hand(): рука разжимает кулак и показывает маникюр (блок маникюра, управляется прокруткой). */
window.QSArt = (() => {
  'use strict';

  const TAU = Math.PI * 2;
  const GOLD = '214,178,108';
  const SOFT = '244,224,170';
  const BRONZE = '150,112,56';
  const mulberry32 = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (p) => p * p * (3 - 2 * p);
  const lerp = (a, b, t) => a + (b - a) * t;

  function setupCanvas(canvas, ctx) {
    const r = canvas.getBoundingClientRect();
    const W = r.width;
    const H = r.height;
    if (!W || !H) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W, H };
  }

  // Гладкая кривая через точки (квадратичные сплайны через середины отрезков)
  function smoothPath(ctx, pts, close) {
    const n = pts.length;
    if (n < 2) return;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    if (close) {
      const mx = (pts[n - 1][0] + pts[0][0]) / 2;
      const my = (pts[n - 1][1] + pts[0][1]) / 2;
      ctx.quadraticCurveTo(pts[n - 1][0], pts[n - 1][1], mx, my);
      ctx.closePath();
    } else {
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }

  // Золотая линия с мягким свечением: широкий прозрачный проход и тонкий яркий
  function goldStroke(ctx, width, alpha) {
    ctx.lineWidth = width * 4;
    ctx.strokeStyle = `rgba(${GOLD},${(alpha * 0.08).toFixed(3)})`;
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = `rgba(${SOFT},${alpha.toFixed(3)})`;
    ctx.stroke();
  }

  /* ================= Девушка: пространство рисунка 1000×1000 ================= */
  function girl(canvas, place) {
    const ctx = canvas.getContext('2d');
    let W = 0;
    let H = 0;
    let k = 1;
    let ox = 0;
    let oy = 0;
    let K = 40;
    let strands = [];
    const S = [668, 560];          // плечевой сустав поднятой руки
    const LU = 240;                // плечо
    const LF = 222;                // предплечье
    const HAND = 92;               // от запястья до кончиков пальцев
    const PERIOD = 7.6;            // цикл движения руки, секунды

    // Путь кончиков пальцев: заходит в волосы у макушки, проводит вниз, выходит и возвращается
    const KEYS = [
      [0.00, 668, 250, 0],
      [0.13, 588, 266, 1],
      [0.36, 594, 378, 1],
      [0.56, 607, 500, 1],
      [0.67, 640, 512, 0.4],
      [0.80, 684, 392, 0],
      [1.00, 668, 250, 0],
    ];

    function handAt(time) {
      const p = (time % PERIOD) / PERIOD;
      let i = 0;
      while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
      const a = KEYS[i];
      const b = KEYS[i + 1];
      const prev = KEYS[Math.max(0, i - 1)];
      const next = KEYS[Math.min(KEYS.length - 1, i + 2)];
      const f = clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
      // Catmull-Rom между ключами: путь без углов
      const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      const x = cr(prev[1], a[1], b[1], next[1], f);
      const y = cr(prev[2], a[2], b[2], next[2], f);
      const g = lerp(a[3], b[3], smooth(f));
      return { x, y, g };
    }

    function build() {
      const r = mulberry32(2026);
      const n = W > 700 ? 190 : 120;
      K = W > 700 ? 40 : 30;
      strands = Array.from({ length: n }, (_, i) => {
        const u = clamp((i / (n - 1)) * 2 - 1 + (r() - 0.5) * 0.05, -1, 1);
        const pick = r();
        const s = {
          u,
          len: 0.8 + r() * 0.22,
          ph: r() * TAU,
          amp: 0.5 + r() * 0.9,
          curl: (r() - 0.5) * 2,
          c: pick < 0.5 ? GOLD : pick < 0.8 ? SOFT : BRONZE,
          a: 0.17 + r() * 0.48,
          w: 0.45 + r() * 0.75,
          rx: new Float32Array(K + 1),
          ry: new Float32Array(K + 1),
          xs: new Float32Array(K + 1),
          ys: new Float32Array(K + 1),
        };
        // Корень на дуге черепа: от левого виска через макушку к правому
        const th = (-90 + 74 * u) * Math.PI / 180;
        const x0 = 518 + 92 * Math.cos(th);
        const y0 = 300 + 106 * Math.sin(th);
        const x1 = 518 + 104 * u;
        const y1 = Math.max(y0 + 40, 300);
        const x2 = 518 + 100 * u + 10 * s.curl;
        const y2 = 560;
        const x3 = 518 + 152 * u + 34 * s.curl;
        const y3 = 300 + (905 - 300) * s.len;
        const lock = Math.floor((u + 1) * 9);          // пряди собраны в локоны
        const lockPh = lock * 1.7;
        for (let j = 0; j <= K; j++) {
          const t = j / K;
          const y = bez(y0, y1, y2, y3, t);
          const wave = Math.sin(y * 0.014 + lockPh) * 10 * clamp((y - 360) / 400, 0, 1);
          s.rx[j] = bez(x0, x1, x2, x3, t) + wave;
          s.ry[j] = y;
        }
        return s;
      });
    }

    function layout() {
      const size = setupCanvas(canvas, ctx);
      if (!size) return false;
      W = size.W;
      H = size.H;
      const p = place(W, H);
      k = p.k;
      ox = p.x - 515 * k;
      oy = p.y - 194 * k;
      build();
      return true;
    }

    const X = (x) => ox + x * k;
    const Y = (y) => oy + y * k;

    function ik(wx, wy) {
      let dx = wx - S[0];
      let dy = wy - S[1];
      let d = Math.hypot(dx, dy);
      const max = LU + LF - 2;
      if (d > max) { dx *= max / d; dy *= max / d; d = max; }
      const a = Math.atan2(dy, dx);
      const b = Math.acos(clamp((LU * LU + d * d - LF * LF) / (2 * LU * d), -1, 1));
      const e1 = [S[0] + LU * Math.cos(a - b), S[1] + LU * Math.sin(a - b)];
      const e2 = [S[0] + LU * Math.cos(a + b), S[1] + LU * Math.sin(a + b)];
      return { e: e1[0] > e2[0] ? e1 : e2, w: [S[0] + dx, S[1] + dy] };
    }

    // Контур тела: плечи и спина, левая рука опущена, правая поднята
    function drawBody(alpha) {
      const body = [
        [446, 418], [449, 470], [420, 496], [340, 518], [292, 556], [274, 640], [266, 780], [262, 1010],
        [640, 1010], [642, 800], [650, 650], [672, 586], [640, 512], [580, 492], [553, 470], [556, 420],
      ].map(([x, y]) => [X(x), Y(y)]);
      ctx.beginPath();
      smoothPath(ctx, body, true);
      const grad = ctx.createLinearGradient(0, Y(420), 0, Y(1000));
      grad.addColorStop(0, 'rgba(30,22,15,0.92)');
      grad.addColorStop(1, 'rgba(14,10,7,0.4)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Видимые линии: левое плечо и рука, лопатка, правый бок под поднятой рукой
      const lines = [
        [[449, 472], [420, 496], [340, 518], [292, 556], [274, 640], [266, 780], [262, 940]],
        [[318, 660], [322, 760], [328, 860]],
        [[553, 472], [580, 492], [640, 512], [668, 540]],
        [[662, 610], [650, 700], [642, 820], [640, 940]],
      ];
      for (const l of lines) {
        ctx.beginPath();
        smoothPath(ctx, l.map(([x, y]) => [X(x), Y(y)]), false);
        goldStroke(ctx, 1.4, alpha);
      }
    }

    // Профиль лица выглядывает слева: скула, ресницы, нос, губы, подбородок
    function drawFace(alpha) {
      const face = [[440, 246], [424, 268], [412, 292], [404, 312], [392, 334], [380, 352], [394, 360], [399, 366], [392, 376], [401, 384], [395, 394], [401, 408], [414, 422], [434, 434], [448, 440], [450, 474]];
      ctx.beginPath();
      smoothPath(ctx, face.map(([x, y]) => [X(x), Y(y)]), false);
      ctx.lineTo(X(470), Y(474));
      ctx.lineTo(X(470), Y(246));
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,22,15,0.95)';
      ctx.fill();
      ctx.beginPath();
      smoothPath(ctx, face.map(([x, y]) => [X(x), Y(y)]), false);
      goldStroke(ctx, 1.4, alpha);
      // Ресницы
      ctx.beginPath();
      for (const [x, y, dx, dy] of [[404, 316, -11, -3], [406, 319, -10, 2], [408, 322, -8, 6]]) {
        ctx.moveTo(X(x), Y(y));
        ctx.lineTo(X(x + dx), Y(y + dy));
      }
      goldStroke(ctx, 1, alpha * 0.9);
    }

    // Серьга-капля покачивается в такт
    function drawEarring(time, alpha) {
      const sway = Math.sin(time * 1.6) * 0.12;
      const top = [431, 364];
      const len = 26;
      const end = [top[0] + Math.sin(sway) * len, top[1] + Math.cos(sway) * len];
      ctx.beginPath();
      ctx.moveTo(X(top[0]), Y(top[1]));
      ctx.lineTo(X(end[0]), Y(end[1]));
      goldStroke(ctx, 1, alpha);
      ctx.beginPath();
      ctx.arc(X(end[0]), Y(end[1] + 4), 4.2 * k, 0, TAU);
      ctx.fillStyle = `rgba(${SOFT},${(alpha * 0.95).toFixed(3)})`;
      ctx.fill();
    }

    function drawStrands(time, hand, alpha, clipOnly) {
      const sheen = ((time * 0.09) % 1.6) - 0.3;
      for (const s of strands) {
        // Повторный проход поверх пальцев нужен только для прядей рядом с рукой
        if (clipOnly && Math.abs(s.rx[K >> 1] - hand.x) > 130) continue;
        const { rx, ry, xs, ys } = s;
        for (let j = 0; j <= K; j++) {
          let x = rx[j];
          let y = ry[j];
          // Покачивание: макушка неподвижна, кончики двигаются сильнее
          const sw = Math.pow(clamp((y - 250) / 640, 0, 1), 1.3) * 16 * s.amp;
          x += sw * (Math.sin(time * 0.9 + s.ph + y * 0.008) * 0.7 + Math.sin(time * 1.7 + s.ph * 1.3 + y * 0.02) * 0.3);
          // Рука собирает пряди и ведёт их за собой
          if (hand.g > 0.001) {
            const dx = x - hand.x;
            const dy = y - hand.y;
            const wl = Math.exp(-(dx * dx) / (2 * 52 * 52));
            const wv = dy > 0 ? Math.exp(-(dy * dy) / (2 * 190 * 190)) : Math.exp(-(dy * dy) / (2 * 42 * 42));
            const w = wl * wv * hand.g;
            x += (hand.x - x) * 0.58 * w;
            y -= 10 * w;
          }
          xs[j] = X(x);
          ys[j] = Y(y);
        }
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let j = 1; j <= K; j++) ctx.lineTo(xs[j], ys[j]);
        ctx.lineWidth = s.w * Math.max(0.8, k);
        ctx.strokeStyle = `rgba(${s.c},${(s.a * alpha * (clipOnly ? 0.6 : 1)).toFixed(3)})`;
        ctx.stroke();
        if (clipOnly) continue;
        // Блик бежит вниз по волосам
        const j0 = Math.max(0, Math.floor((sheen - 0.1) * K));
        const j1 = Math.min(K, Math.ceil((sheen + 0.1) * K));
        if (j1 - j0 < 2) continue;
        const g = ctx.createLinearGradient(xs[j0], ys[j0], xs[j1], ys[j1]);
        const peak = Math.min(1, s.a * alpha * 1.9).toFixed(3);
        g.addColorStop(0, `rgba(${SOFT},0)`);
        g.addColorStop(0.5, `rgba(${SOFT},${peak})`);
        g.addColorStop(1, `rgba(${SOFT},0)`);
        ctx.beginPath();
        ctx.moveTo(xs[j0], ys[j0]);
        for (let j = j0 + 1; j <= j1; j++) ctx.lineTo(xs[j], ys[j]);
        ctx.strokeStyle = g;
        ctx.lineWidth = s.w * Math.max(0.8, k) * 1.4;
        ctx.stroke();
      }
    }

    // Поднятая рука: плечо и предплечье по суставам, кисть с пальцами в волосах
    function arm(hand) {
      const dir = [-0.28, 0.96];
      const wrist = [hand.x - dir[0] * HAND, hand.y - dir[1] * HAND];
      const { e, w } = ik(wrist[0], wrist[1]);
      return { e, w, dir };
    }

    function drawArm(pose, alpha) {
      const { e, w, dir } = pose;
      const seg = (a, b) => { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
      const n1 = seg(S, e);
      const n2 = seg(e, w);
      const ne = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
      const off = (p, n, r) => [p[0] + n[0] * r, p[1] + n[1] * r];
      const mid1 = [(S[0] + e[0]) / 2, (S[1] + e[1]) / 2];
      const mid2 = [(e[0] + w[0]) / 2, (e[1] + w[1]) / 2];
      const sideA = [off(S, n1, 38), off(mid1, n1, 31), off(e, ne, 24), off(mid2, n2, 21), off(w, n2, 16)];
      const sideB = [off(w, n2, -16), off(mid2, n2, -20), off(e, ne, -22), off(mid1, n1, -30), off(S, n1, -36)];
      const toScreen = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);

      // Кисть: тыльная сторона и четыре пальца, уходящих в волосы
      const nh = [-dir[1], dir[0]];
      const knuckle = [w[0] + dir[0] * 46, w[1] + dir[1] * 46];
      const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
      const fingers = [-1.5, -0.5, 0.5, 1.5].map((f, i) => {
        const base = [knuckle[0] + nh[0] * f * 11, knuckle[1] + nh[1] * f * 11];
        const len = [46, 54, 52, 40][i];
        const d1 = rot(dir, f * 0.07);
        const d2 = rot(d1, 0.28);          // кончики слегка подогнуты к волосам
        const mid = [base[0] + d1[0] * len * 0.55, base[1] + d1[1] * len * 0.55];
        const tip = [mid[0] + d2[0] * len * 0.45, mid[1] + d2[1] * len * 0.45];
        return [base, tip, mid];
      });

      // Заливка руки тёмным, чтобы она была перед волосами
      ctx.beginPath();
      smoothPath(ctx, toScreen([...sideA, off(knuckle, nh, 26), off(knuckle, nh, -26), ...sideB]), true);
      ctx.fillStyle = 'rgba(26,19,13,0.96)';
      ctx.fill();
      for (const [b, tip, mid] of fingers) {
        ctx.beginPath();
        ctx.moveTo(X(b[0]), Y(b[1]));
        ctx.quadraticCurveTo(X(mid[0]), Y(mid[1]), X(tip[0]), Y(tip[1]));
        ctx.lineCap = 'round';
        ctx.lineWidth = 9 * k;
        ctx.strokeStyle = 'rgba(26,19,13,0.96)';
        ctx.stroke();
      }

      // Контуры
      ctx.beginPath();
      smoothPath(ctx, toScreen([...sideA, off(knuckle, nh, 26)]), false);
      goldStroke(ctx, 1.4, alpha);
      ctx.beginPath();
      smoothPath(ctx, toScreen([off(knuckle, nh, -26), ...sideB]), false);
      goldStroke(ctx, 1.4, alpha);
      for (const [b, tip, mid] of fingers) {
        // Палец: два контура по изгибу, на кончике короткий блик ногтя
        const d = [tip[0] - b[0], tip[1] - b[1]];
        const l = Math.hypot(d[0], d[1]);
        const nn = [-d[1] / l * 4.2, d[0] / l * 4.2];
        ctx.beginPath();
        ctx.moveTo(X(b[0] + nn[0]), Y(b[1] + nn[1]));
        ctx.quadraticCurveTo(X(mid[0] + nn[0]), Y(mid[1] + nn[1]), X(tip[0] + nn[0] * 0.6), Y(tip[1] + nn[1] * 0.6));
        ctx.moveTo(X(b[0] - nn[0]), Y(b[1] - nn[1]));
        ctx.quadraticCurveTo(X(mid[0] - nn[0]), Y(mid[1] - nn[1]), X(tip[0] - nn[0] * 0.6), Y(tip[1] - nn[1] * 0.6));
        goldStroke(ctx, 1.05, alpha * 0.8);
        ctx.beginPath();
        ctx.moveTo(X(tip[0] - d[0] / l * 9), Y(tip[1] - d[1] / l * 9));
        ctx.lineTo(X(tip[0]), Y(tip[1]));
        ctx.lineWidth = 3 * k;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${SOFT},${(alpha * 0.75).toFixed(3)})`;
        ctx.stroke();
      }
      return fingers;
    }

    function draw(time, reveal) {
      ctx.clearRect(0, 0, W, H);
      const hand = handAt(time);
      const pose = arm(hand);
      const alpha = reveal;
      drawBody(alpha);
      drawFace(alpha);
      drawEarring(time, alpha);
      ctx.globalCompositeOperation = 'lighter';
      drawStrands(time, hand, alpha, false);
      ctx.globalCompositeOperation = 'source-over';
      const fingers = drawArm(pose, alpha);
      // Часть прядей поверх пальцев: рука действительно в волосах
      ctx.save();
      ctx.beginPath();
      for (const [b, tip] of fingers) {
        ctx.moveTo(X(tip[0]) + 9 * k, Y(tip[1]));
        ctx.arc(X((b[0] + tip[0]) / 2), Y((b[1] + tip[1]) / 2), 24 * k, 0, TAU);
      }
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      drawStrands(time, hand, alpha * 0.8, true);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    return { layout, draw };
  }

  /* ================= Рука с маникюром: пространство рисунка 600×760 =================
     Тыльная сторона правой руки, пальцы вверх. c = 1 — кулак, c = 0 — раскрытая ладонь.
     Сгиб пальцев показан ракурсом: фаланги укорачиваются и уходят за кисть, ногти видны в конце. */
  function hand(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0;
    let H = 0;
    let k = 1;
    let ox = 0;
    let oy = 0;
    const SKIN = 'rgba(30,22,16,0.97)';
    const FINGERS = [
      { base: [259, 422], ang: -7, len: [90, 55, 43], w: [41, 37, 32], nail: 'nude' },
      { base: [300, 411], ang: -1, len: [98, 61, 45], w: [43, 38, 33], nail: 'nude' },
      { base: [340, 419], ang: 5, len: [92, 57, 43], w: [40, 35, 31], nail: 'gold' },
      { base: [376, 442], ang: 12, len: [70, 43, 35], w: [34, 30, 27], nail: 'nude' },
    ];

    function layout() {
      const size = setupCanvas(canvas, ctx);
      if (!size) return false;
      W = size.W;
      H = size.H;
      k = Math.min(H / 640, W / 470);
      ox = W / 2 - 310 * k;
      oy = H - 700 * k;
      return true;
    }
    const X = (x) => ox + x * k;
    const Y = (y) => oy + y * k;
    const P = (pt) => [X(pt[0]), Y(pt[1])];

    function nailPath(baseC, dir, n, len, width, overhang) {
      // Миндальный ноготь: от основания к острому кончику за пределами пальца
      const b = baseC;
      const tip = [b[0] + dir[0] * (len + overhang), b[1] + dir[1] * (len + overhang)];
      const sh = [b[0] + dir[0] * len * 0.55, b[1] + dir[1] * len * 0.55];
      const hw = width / 2;
      ctx.beginPath();
      ctx.moveTo(...P([b[0] + n[0] * hw * 0.92, b[1] + n[1] * hw * 0.92]));
      ctx.quadraticCurveTo(...P([sh[0] + n[0] * hw * 1.08, sh[1] + n[1] * hw * 1.08]), ...P(tip));
      ctx.quadraticCurveTo(...P([sh[0] - n[0] * hw * 1.08, sh[1] - n[1] * hw * 1.08]), ...P([b[0] - n[0] * hw * 0.92, b[1] - n[1] * hw * 0.92]));
      ctx.quadraticCurveTo(...P([b[0] - dir[0] * hw * 0.5, b[1] - dir[1] * hw * 0.5]), ...P([b[0] + n[0] * hw * 0.92, b[1] + n[1] * hw * 0.92]));
      ctx.closePath();
      return tip;
    }

    function drawFinger(f, c, tilt, gloss, alpha) {
      const a = (f.ang + tilt) * Math.PI / 180;
      const dir = [Math.sin(a), -Math.cos(a)];
      const n = [-dir[1], dir[0]];
      const phi1 = c * 92;
      const phi2 = phi1 + c * 100;
      const phi3 = phi2 + c * 75;
      const cosd = (d) => Math.cos(d * Math.PI / 180);
      const proj = [cosd(phi1), cosd(phi2), cosd(phi3)];
      // Видимые суставы: фаланга, ушедшая за кисть (cos ≤ 0), не рисуется
      const pts = [f.base];
      const ws = [f.w[0]];
      for (let i = 0; i < 3; i++) {
        if (proj[i] <= 0.02) break;
        const prev = pts[pts.length - 1];
        const l = f.len[i] * proj[i];
        pts.push([prev[0] + dir[0] * l, prev[1] + dir[1] * l]);
        ws.push(f.w[Math.min(i + 1, 2)] * (i === 2 ? 0.92 : 1));
      }
      const end = pts[pts.length - 1];
      const wEnd = ws[ws.length - 1];
      const r = wEnd / 2;
      const b = f.base;
      const w0 = f.w[0] / 2;
      // Палец: капсула от костяшки до видимого конца
      ctx.beginPath();
      ctx.moveTo(...P([b[0] - n[0] * w0, b[1] - n[1] * w0]));
      ctx.lineTo(...P([end[0] - n[0] * r, end[1] - n[1] * r]));
      const ang = Math.atan2(n[1], n[0]);
      ctx.arc(X(end[0]), Y(end[1]), r * k, ang + Math.PI, ang + TAU, false);
      ctx.lineTo(...P([b[0] + n[0] * w0, b[1] + n[1] * w0]));
      ctx.fillStyle = SKIN;
      ctx.fill();
      goldStroke(ctx, 1.4, alpha);
      // Складки на суставах
      ctx.beginPath();
      for (let i = 1; i < pts.length - 1; i++) {
        const j = pts[i];
        const hw = ws[i] * 0.28;
        ctx.moveTo(...P([j[0] - n[0] * hw, j[1] - n[1] * hw + 3]));
        ctx.quadraticCurveTo(...P([j[0], j[1] - 3]), ...P([j[0] + n[0] * hw, j[1] + n[1] * hw + 3]));
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${GOLD},${(alpha * 0.4).toFixed(3)})`;
      ctx.stroke();
      // Ноготь появляется, когда последняя фаланга смотрит на нас
      const vis = clamp((proj[2] - 0.2) / 0.8, 0, 1);
      if (pts.length === 4 && vis > 0) {
        const nlen = f.len[2] * 0.6 * proj[2];
        const nb = [end[0] - dir[0] * nlen * 0.95, end[1] - dir[1] * nlen * 0.95];
        const tip = nailPath(nb, dir, n, nlen, wEnd * 0.74, 12 * vis);
        const g = ctx.createLinearGradient(...P([nb[0] - n[0] * 14, nb[1]]), ...P([nb[0] + n[0] * 14, nb[1] - 30]));
        if (f.nail === 'gold') {
          g.addColorStop(0, `rgba(150,112,56,${vis})`);
          g.addColorStop(0.45, `rgba(244,224,170,${vis})`);
          g.addColorStop(1, `rgba(184,141,69,${vis})`);
        } else {
          g.addColorStop(0, `rgba(158,101,89,${vis})`);
          g.addColorStop(0.5, `rgba(226,175,160,${vis})`);
          g.addColorStop(1, `rgba(186,128,114,${vis})`);
        }
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${SOFT},${(alpha * 0.55 * vis).toFixed(3)})`;
        ctx.stroke();
        // Глянец: тонкий блик вдоль ногтя и бегущая полоса света
        ctx.beginPath();
        ctx.moveTo(...P([nb[0] - n[0] * 3 + dir[0] * 6, nb[1] - n[1] * 3 + dir[1] * 6]));
        ctx.lineTo(...P([nb[0] - n[0] * 2 + dir[0] * nlen * 0.8, nb[1] - n[1] * 2 + dir[1] * nlen * 0.8]));
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.2 * k;
        ctx.strokeStyle = `rgba(255,248,236,${(0.6 * vis).toFixed(3)})`;
        ctx.stroke();
        if (gloss > 0 && gloss < 1) {
          const gx = lerp(220, 400, gloss);
          const band = Math.exp(-Math.pow((b[0] - gx) / 26, 2));
          if (band > 0.02) {
            nailPath(nb, dir, n, nlen, wEnd * 0.74, 12 * vis);
            ctx.fillStyle = `rgba(255,250,240,${(0.55 * band * vis).toFixed(3)})`;
            ctx.fill();
          }
        }
        return tip;
      }
      return null;
    }

    function draw(c, gloss, time, alpha = 1) {
      ctx.clearRect(0, 0, W, H);
      const open = 1 - c;
      const tilt = lerp(6, -3, open);
      ctx.save();
      // Лёгкий поворот кисти вокруг запястья по мере раскрытия
      ctx.translate(X(300), Y(700));
      ctx.rotate(tilt * Math.PI / 180 * 0.6);
      ctx.translate(-X(300), -Y(700));

      // Большой палец: отводится в сторону при раскрытии, основание прячется под кистью
      const ta = lerp(-14, -50, smooth(open)) * Math.PI / 180;
      const td = [Math.sin(ta), -Math.cos(ta)];
      const tn = [-td[1], td[0]];
      const tb = [262, 590];
      const tl = lerp(92, 112, open);
      const tm = [tb[0] + td[0] * tl * 0.55, tb[1] + td[1] * tl * 0.55];
      const ta2 = ta + lerp(0.05, 0.22, open);
      const td2 = [Math.sin(ta2), -Math.cos(ta2)];
      const te = [tm[0] + td2[0] * tl * 0.45, tm[1] + td2[1] * tl * 0.45];
      const tn2 = [-td2[1], td2[0]];
      ctx.beginPath();
      ctx.moveTo(...P([tb[0] - tn[0] * 30, tb[1] - tn[1] * 30]));
      ctx.quadraticCurveTo(...P([tm[0] - tn[0] * 22, tm[1] - tn[1] * 22]), ...P([te[0] - tn2[0] * 16, te[1] - tn2[1] * 16]));
      const tang = Math.atan2(tn2[1], tn2[0]);
      ctx.arc(X(te[0]), Y(te[1]), 16 * k, tang + Math.PI, tang + TAU, false);
      ctx.quadraticCurveTo(...P([tm[0] + tn[0] * 19, tm[1] + tn[1] * 19]), ...P([tb[0] + tn[0] * 24, tb[1] + tn[1] * 24]));
      ctx.fillStyle = SKIN;
      ctx.fill();
      goldStroke(ctx, 1.4, alpha);
      const tv = clamp((open - 0.5) / 0.5, 0, 1);
      if (tv > 0) {
        const nb = [te[0] - td2[0] * 24, te[1] - td2[1] * 24];
        nailPath(nb, td2, tn2, 24, 22, 9 * tv);
        const g = ctx.createLinearGradient(...P(nb), ...P(te));
        g.addColorStop(0, `rgba(158,101,89,${tv})`);
        g.addColorStop(1, `rgba(226,175,160,${tv})`);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Тыльная сторона кисти и предплечье
      const palm = [[250, 790], [252, 700], [250, 642], [244, 600], [240, 540], [243, 470], [248, 430], [300, 405], [356, 421], [393, 454], [394, 512], [384, 584], [366, 640], [368, 700], [372, 790]];
      ctx.beginPath();
      smoothPath(ctx, palm.map(P), true);
      ctx.fillStyle = SKIN;
      ctx.fill();
      ctx.beginPath();
      smoothPath(ctx, [[250, 790], [252, 700], [250, 642], [244, 600], [240, 540], [243, 470], [249, 432]].map(P), false);
      goldStroke(ctx, 1.4, alpha);
      ctx.beginPath();
      smoothPath(ctx, [[393, 454], [394, 512], [384, 584], [366, 640], [368, 700], [372, 790]].map(P), false);
      goldStroke(ctx, 1.4, alpha);
      // Сухожилия едва заметны
      ctx.beginPath();
      for (const [x1, x2] of [[272, 262], [300, 300], [328, 338], [350, 370]]) {
        ctx.moveTo(X(x1 + 4), Y(610));
        ctx.quadraticCurveTo(X((x1 + x2) / 2), Y(530), X(x2), Y(452));
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${GOLD},${(alpha * 0.12).toFixed(3)})`;
      ctx.stroke();
      // Тонкий браслет на запястье
      ctx.beginPath();
      ctx.moveTo(X(251), Y(660));
      ctx.quadraticCurveTo(X(310), Y(680), X(367), Y(660));
      goldStroke(ctx, 2.2, alpha * 0.9);

      // Пальцы от мизинца к указательному
      for (let i = FINGERS.length - 1; i >= 0; i--) drawFinger(FINGERS[i], c, 0, gloss, alpha);

      ctx.restore();

      // Искры на ногтях, когда рука раскрыта
      if (open > 0.85) {
        const sp = (open - 0.85) / 0.15;
        for (let i = 0; i < 4; i++) {
          const f = FINGERS[i];
          const tw = 0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.7);
          const a = (f.ang) * Math.PI / 180;
          const len = f.len[0] + f.len[1] + f.len[2] - 10;
          const x = f.base[0] + Math.sin(a) * len + 8;
          const y = f.base[1] - Math.cos(a) * len + 4;
          const s = (3 + 5 * tw) * k * sp;
          ctx.beginPath();
          ctx.moveTo(X(x), Y(y) - s); ctx.lineTo(X(x) + s * 0.25, Y(y) - s * 0.25);
          ctx.lineTo(X(x) + s, Y(y)); ctx.lineTo(X(x) + s * 0.25, Y(y) + s * 0.25);
          ctx.lineTo(X(x), Y(y) + s); ctx.lineTo(X(x) - s * 0.25, Y(y) + s * 0.25);
          ctx.lineTo(X(x) - s, Y(y)); ctx.lineTo(X(x) - s * 0.25, Y(y) - s * 0.25);
          ctx.closePath();
          ctx.fillStyle = `rgba(255,246,222,${(0.85 * tw * sp).toFixed(3)})`;
          ctx.fill();
        }
      }
    }

    return { layout, draw };
  }

  return { girl, hand };
})();
