#!/usr/bin/env python3
"""
demo_video.py: render a dashboard-style demo video of real-bets on your tickers.

    python demo_video.py NVDA AMD AVGO MSFT GOOGL META AMZN AAPL JPM BAC XOM CVX
    python demo_video.py --csv prices.csv --out demo.mp4

1920x1080, ~24s. Needs ffmpeg on the PATH (Google Colab already has it).
"""
import argparse
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import matplotlib
from matplotlib.colors import LinearSegmentedColormap

import real_bets as rb

W, H, FPS = 1920, 1080, 30
BG = (5, 7, 11)
PANEL = (11, 15, 22)
CARD = (15, 20, 29)
BORDER = (28, 35, 48)
WHITE = (240, 244, 250)
GREY = (120, 128, 142)
DIM = (60, 67, 80)
BLUE = (47, 128, 255)
CYAN = (92, 200, 255)
GREEN = (61, 220, 151)
RED = (255, 95, 86)
AMBER = (255, 189, 46)

FDIR = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "ttf")
_fc = {}


def F(kind, size):
    key = (kind, size)
    if key not in _fc:
        name = {"m": "DejaVuSansMono.ttf", "mb": "DejaVuSansMono-Bold.ttf",
                "s": "DejaVuSans.ttf", "sb": "DejaVuSans-Bold.ttf"}[kind]
        _fc[key] = ImageFont.truetype(os.path.join(FDIR, name), size)
    return _fc[key]


CMAP = LinearSegmentedColormap.from_list("rb", ["#0E1116", "#1A3A6B", "#2F80FF", "#BFD8FF"])
WATERMARK = ""


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def seg(t, a, b):
    """progress of t inside [a, b] -> 0..1"""
    return min(max((t - a) / (b - a), 0.0), 1.0)


# ------------------------------------------------------------ math helpers
def stress_path(corr, target=rb.CRASH_RHO, steps=60):
    n = corr.shape[0]
    J = np.full((n, n), target)
    np.fill_diagonal(J, 1.0)
    xs, ys = [], []
    for w in np.linspace(0, 1, steps):
        c = (1 - w) * corr + w * J
        xs.append(rb.avg_pairwise(c))
        ys.append(rb.effective_bets(c))
    return np.array(xs), np.array(ys)


# ------------------------------------------------------------ static layers
def glow_badge(text, color):
    f = F("sb", 30)
    tw = f.getlength(text)
    w, h = int(tw + 70), 58
    pad = 30
    img = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    g.rounded_rectangle([pad, pad, pad + w, pad + h], radius=14, fill=color + (170,))
    img = img.filter(ImageFilter.GaussianBlur(16))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=14, fill=color + (255,))
    d.text((pad + w / 2, pad + h / 2), text, font=f, fill=(5, 7, 11, 255), anchor="mm")
    return img


def base_layer(r):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # subtle grid
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(9, 12, 18))
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(9, 12, 18))
    # header
    d.text((W / 2 - 10, 50), "REAL BETS", font=F("sb", 46), fill=WHITE, anchor="rm")
    d.text((W / 2 + 10, 50), "+ MATH", font=F("sb", 46), fill=BLUE, anchor="lm")
    d.text((W / 2, 98), "tickers → correlations → eigenvalues → real bets",
           font=F("m", 20), fill=GREY, anchor="mm")
    # left terminal
    d.rounded_rectangle([30, 135, 690, 1005], radius=18, fill=PANEL, outline=BORDER, width=2)
    for i, c in enumerate([RED, AMBER, GREEN]):
        d.ellipse([52 + i * 26, 155, 66 + i * 26, 169], fill=c)
    d.text((360, 162), "~/real-bets — python", font=F("m", 17), fill=GREY, anchor="mm")
    d.line([(30, 185), (690, 185)], fill=BORDER, width=2)
    # right dashboard window
    d.rounded_rectangle([720, 135, 1890, 1005], radius=18, fill=PANEL, outline=BORDER, width=2)
    for i, c in enumerate([RED, AMBER, GREEN]):
        d.ellipse([742 + i * 26, 155, 756 + i * 26, 169], fill=c)
    d.rounded_rectangle([1130, 150, 1480, 176], radius=13, fill=CARD)
    d.text((1305, 163), "🔒 localhost:8050 · real-bets".replace("🔒 ", ""), font=F("m", 16),
           fill=GREY, anchor="mm")
    d.line([(720, 185), (1890, 185)], fill=BORDER, width=2)
    # dashboard header row
    d.text((750, 222), "REAL BETS", font=F("sb", 26), fill=BLUE, anchor="lm")
    d.text((930, 224), f"LIVE · {r['n']} tickers · {r['days']} days", font=F("m", 16),
           fill=GREY, anchor="lm")
    # gauge card + checklist card
    d.rounded_rectangle([745, 255, 1085, 965], radius=14, fill=CARD, outline=BORDER)
    d.rounded_rectangle([1105, 255, 1865, 845], radius=14, fill=CARD, outline=BORDER)
    # footer
    d.text((30, 1045), "@gleX999", font=F("mb", 22), fill=WHITE, anchor="lm")
    d.text((W - 30, 1045), rb.REPO, font=F("m", 18), fill=GREY, anchor="rm")
    d.text((W / 2, 1045), "N_eff = N² / Σρ²   ·   not financial advice. just math.",
           font=F("m", 18), fill=DIM, anchor="mm")
    return img


# ------------------------------------------------------------ frame drawing
TABS = ["SCAN", "MATRIX", "CRASH", "RESULT"]
STAGES = ["prices", "returns", "correlation", "eigenvalues", "clusters", "crash test"]


def draw_frame(t, S):
    r = S["r"]
    n = r["n"]
    img = S["base"].copy()
    d = ImageDraw.Draw(img)

    # ---------- timeline
    T_TYPE, T_P1, T_P2, T_P3, T_END = 2.0, 6.5, 13.5, 18.5, S["dur"]
    phase = 0 if t < T_P1 else 1 if t < T_P2 else 2 if t < T_P3 else 3

    # tabs
    x = 1865 - sum(F("mb", 15).getlength(tb) + 36 for tb in TABS) + 10
    for i, tab in enumerate(TABS):
        w = F("mb", 15).getlength(tab) + 26
        act = i == phase
        d.rounded_rectangle([x, 208, x + w, 238], radius=6,
                            fill=BLUE if act else CARD, outline=None if act else BORDER)
        d.text((x + w / 2, 223), tab, font=F("mb", 15), fill=BG if act else GREY, anchor="mm")
        x += w + 10

    # ---------- terminal
    cmd = "$ python real_bets.py " + " ".join(r["tickers"])
    typed = cmd[: int(len(cmd) * seg(t, 0.2, T_TYPE))]
    lines = []
    ymax = 58
    cur = ""
    for w_ in typed.split(" "):
        if len(cur) + len(w_) + 1 > 60 and cur:
            lines.append((cur, WHITE))
            cur = "    " + w_
        else:
            cur = (cur + " " + w_) if cur else w_
    lines.append((cur, WHITE))
    log = S["log"]
    shown = [l for l in log if l[0] <= t]
    lines += [(txt, col) for _, txt, col in shown]
    lines = lines[-ymax:]
    y = 205
    fl = F("m", 16)
    visible = lines[-38:]
    for txt, col in visible:
        d.text((52, y), txt, font=fl, fill=col)
        y += 20.5
    if int(t * 2) % 2 == 0 and t < T_END - 0.5:
        d.rectangle([52, y + 2, 61, y + 17], fill=WHITE)

    # ---------- gauge
    cx, cy, R = 915, 420, 120
    d.arc([cx - R, cy - R, cx + R, cy + R], 0, 360, fill=(30, 38, 52), width=16)
    if phase == 0:
        a0 = (t * 300) % 360
        d.arc([cx - R, cy - R, cx + R, cy + R], a0, a0 + 70, fill=BLUE, width=16)
        d.text((cx, cy - 8), "—", font=F("sb", 60), fill=WHITE, anchor="mm")
        d.rounded_rectangle([cx - 70, cy + 40, cx + 70, cy + 70], radius=8, fill=(22, 40, 70))
        d.text((cx, cy + 55), "SCANNING", font=F("mb", 16), fill=CYAN, anchor="mm")
    else:
        k = ease(seg(t, T_P1 + 2.5, T_P1 + 5.5))
        val = lerp(n, r["n_eff"], k)
        if phase >= 2:
            val = r["n_eff"]
        frac = val / n
        d.arc([cx - R, cy - R, cx + R, cy + R], -90, -90 + 360 * frac, fill=BLUE, width=16)
        d.text((cx, cy - 10), f"{val:.1f}", font=F("sb", 72), fill=WHITE, anchor="mm")
        d.text((cx, cy + 50), f"of {n} tickers", font=F("m", 17), fill=GREY, anchor="mm")
    d.text((cx, cy + R + 38), "REAL BETS SCORE", font=F("mb", 16), fill=GREY, anchor="mm")

    # checklist
    stage_t = S["stage_t"]
    yy = 640
    d.text((770, yy - 30), "PIPELINE", font=F("mb", 14), fill=DIM)
    for i, name in enumerate(STAGES):
        st, en, val = stage_t[i]
        if t < st:
            dot, col, vtxt = DIM, DIM, "waiting"
        elif t < en:
            blink = int(t * 4) % 2 == 0
            dot, col, vtxt = (CYAN if blink else BLUE), WHITE, "running…"
        else:
            dot, col, vtxt = GREEN, WHITE, val
        d.ellipse([770, yy + 5, 782, yy + 17], fill=dot)
        d.text((795, yy + 11), name, font=F("m", 17), fill=col, anchor="lm")
        d.text((1065, yy + 11), vtxt, font=F("m", 15),
               fill=GREEN if t >= en else GREY, anchor="rm")
        yy += 50

    # ---------- main panel content
    px0, py0, px1, py1 = 1105, 255, 1865, 845
    if phase == 0:
        d.text((px0 + 25, py0 + 22), "PRICES · 1Y DAILY", font=F("mb", 15), fill=GREY)
        cols = 5
        cw, ch = 133, 70
        gx, gy = px0 + 30, py0 + 60
        n_lit = int(n * seg(t, T_TYPE + 0.3, T_P1 - 0.6)) if t > T_TYPE else 0
        for i, tk in enumerate(r["tickers"][:40]):
            c, rr = i % cols, i // cols
            x0 = gx + c * (cw + 11)
            y0 = gy + rr * (ch + 10)
            if y0 + ch > py1 - 10:
                break
            lit = i < n_lit
            d.rounded_rectangle([x0, y0, x0 + cw, y0 + ch], radius=8,
                                fill=(18, 30, 52) if lit else (13, 17, 25),
                                outline=BLUE if lit else BORDER)
            d.text((x0 + 10, y0 + 8), tk, font=F("mb", 16), fill=WHITE if lit else DIM)
            if lit:
                sp = S["spark"][i]
                pts = [(x0 + 10 + j * (cw - 20) / (len(sp) - 1), y0 + ch - 10 - v * 30)
                       for j, v in enumerate(sp)]
                d.line(pts, fill=CYAN, width=2)
    elif phase == 1:
        d.text((px0 + 25, py0 + 22), "MATRIX", font=F("mb", 15), fill=GREY)
        corr = S["corr_o"]
        size = 470
        cs = size / n
        gx, gy = px0 + 110, py0 + 70
        rev = ease(seg(t, T_P1 + 0.2, T_P1 + 3.0))
        lf = F("m", max(9, min(14, int(cs * 0.6))))
        for i in range(n):
            if cs >= 11:
                d.text((gx - 8, gy + i * cs + cs / 2), S["labels"][i], font=lf, fill=GREY,
                       anchor="rm")
            for j in range(n):
                if i + j > rev * (2 * n - 2):
                    continue
                v = (corr[i, j] + 0.2) / 1.2
                rgb = tuple(int(255 * c) for c in CMAP(np.clip(v, 0, 1))[:3])
                d.rectangle([gx + j * cs + 0.5, gy + i * cs + 0.5, gx + (j + 1) * cs - 0.5,
                             gy + (i + 1) * cs - 0.5], fill=rgb)
        # eigenvalue spectrum
        ev = S["eig"]
        bx, by, bw, bh = px0 + 610, py0 + 70, 120, 470
        d.text((bx, by - 8), "λ spectrum", font=F("mb", 14), fill=GREY, anchor="ls")
        k = ease(seg(t, T_P1 + 2.5, T_P1 + 5.0))
        m = min(len(ev), 10)
        barh = bh / m - 6
        for i in range(m):
            L = ev[i] / ev[0] * bw * k
            yb = by + 10 + i * (barh + 6)
            d.rectangle([bx, yb, bx + max(L, 1), yb + barh], fill=BLUE if i == 0 else (40, 70, 120))
        if k > 0.95:
            d.text((bx, by + bh + 25), f"λ₁ = {ev[0]:.1f}", font=F("mb", 16), fill=WHITE)
            d.text((bx, by + bh + 47), "= \"the market\"", font=F("m", 14), fill=GREY)
    else:
        d.text((px0 + 25, py0 + 22), "STRESS", font=F("mb", 15), fill=GREY)
        xs, ys = S["path"]
        cx0, cy0, cx1, cy1 = px0 + 90, py0 + 80, px1 - 60, py1 - 90
        # axes
        d.line([(cx0, cy1), (cx1, cy1)], fill=BORDER, width=2)
        d.line([(cx0, cy0), (cx0, cy1)], fill=BORDER, width=2)
        ymax = max(ys[0] * 1.25, 2)
        X = lambda v: cx0 + v / 0.9 * (cx1 - cx0)
        Y = lambda v: cy1 - v / ymax * (cy1 - cy0)
        for g in np.arange(0, 0.91, 0.1):
            d.text((X(g), cy1 + 18), f"{g:.1f}", font=F("m", 14), fill=GREY, anchor="mm")
        for g in range(0, int(ymax) + 1, max(1, int(ymax / 5))):
            d.text((cx0 - 14, Y(g)), str(g), font=F("m", 14), fill=GREY, anchor="rm")
            d.line([(cx0, Y(g)), (cx1, Y(g))], fill=(20, 26, 36))
        d.text(((cx0 + cx1) / 2, cy1 + 48), "average correlation ρ", font=F("m", 15),
               fill=GREY, anchor="mm")
        d.text((cx0 - 60, cy0 - 25), "real bets", font=F("m", 15), fill=GREY)
        # crash zone
        d.rectangle([X(0.65), cy0, X(0.9), cy1], fill=(40, 14, 16))
        d.text((X(0.775), cy0 + 18), "CRASH ZONE", font=F("mb", 14), fill=RED, anchor="mm")
        k = ease(seg(t, T_P2 + 0.4, T_P3 - 1.2)) if phase == 2 else 1
        m = max(2, int(len(xs) * k))
        pts = [(X(a), Y(b)) for a, b in zip(xs[:m], ys[:m])]
        for i in range(len(pts) - 1):
            col = mix(BLUE, RED, i / len(xs))
            d.line([pts[i], pts[i + 1]], fill=col, width=5)
        mx, my = pts[-1]
        cur = ys[m - 1]
        colm = mix(BLUE, RED, (m - 1) / (len(xs) - 1))
        d.ellipse([mx - 11, my - 11, mx + 11, my + 11], fill=colm, outline=WHITE, width=3)
        d.text((mx + 18, my - 26), f"{cur:.1f} bets", font=F("sb", 26), fill=WHITE)
        d.ellipse([X(xs[0]) - 7, Y(ys[0]) - 7, X(xs[0]) + 7, Y(ys[0]) + 7], fill=BLUE)
        d.text((X(xs[0]) - 14, Y(ys[0])), f"today {ys[0]:.1f}", font=F("m", 15), fill=GREY,
               anchor="rm")

    # ---------- pass badge (floating)
    badges = S["badges"]
    bi = min(phase, 2)
    b_on = seg(t, [T_TYPE, T_P1, T_P2][bi], [T_TYPE, T_P1, T_P2][bi] + 0.35)
    if phase < 3:
        bimg = badges[bi]
        yoff = int(lerp(-20, 0, ease(b_on)))
        img.paste(bimg, (int(1485 - bimg.width / 2), 210 + yoff), bimg)

    # ---------- caption banner + progress segments
    d.rounded_rectangle([1105, 865, 1865, 915], radius=10, fill=(9, 12, 18), outline=BORDER)
    caps = ["WATCH 20 TICKERS GET MEASURED.".replace("20", str(n)),
            "SAME MARKET. SAME FACTOR. FEWER BETS.",
            "CORRELATIONS SPIKE. BETS COLLAPSE.",
            f"YOU OWN {n} STOCKS. YOU HOLD {r['n_eff']:.1f} BETS."]
    cap = caps[phase]
    parts = cap.split(". ", 1)
    f = F("sb", 24)
    if len(parts) == 2:
        a_, b_ = parts[0] + ". ", parts[1]
        wa, wb = f.getlength(a_), f.getlength(b_)
        x0 = 1485 - (wa + wb) / 2
        d.text((x0, 890), a_, font=f, fill=WHITE, anchor="lm")
        d.text((x0 + wa, 890), b_, font=f, fill=BLUE, anchor="lm")
    else:
        d.text((1485, 890), cap, font=f, fill=WHITE, anchor="mm")
    prog = seg(t, 0, T_P3)
    nseg = 10
    sw = (760 - (nseg - 1) * 6) / nseg
    for i in range(nseg):
        x0 = 1105 + i * (sw + 6)
        fill = BLUE if (i + 1) / nseg <= prog + 1e-6 else (14, 19, 28)
        d.rounded_rectangle([x0, 930, x0 + sw, 962], radius=5, fill=fill, outline=BORDER)
        d.text((x0 + sw / 2, 946), ["prices", "returns", "matrix", "λ", "clusters", "pairs",
                                   "stress", "crash", "score", "done"][i], font=F("m", 12),
               fill=BG if fill == BLUE else DIM, anchor="mm")

    # ---------- final overlay
    if phase == 3:
        a = ease(seg(t, T_P3, T_P3 + 0.8))
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        o = ImageDraw.Draw(ov)
        o.rounded_rectangle([1125, 300, 1845, 800], radius=16, fill=(5, 7, 11, int(250 * a)), outline=(47, 128, 255, int(180 * a)), width=2)
        img.paste(ov, (0, 0), ov)
        d = ImageDraw.Draw(img)
        if a > 0.05:
            ca = lambda c: mix(BG, c, a)
            d.text((1485, 400), f"You own {n} stocks.", font=F("sb", 52), fill=ca(WHITE), anchor="mm")
            d.text((1485, 475), f"You have {r['n_eff']:.1f} bets.", font=F("sb", 52), fill=ca(BLUE),
                   anchor="mm")
            ceil = "∞" if r["ceiling"] == float("inf") else f"{r['ceiling']:.1f}"
            stats = [("avg ρ", f"{r['avg_rho']:.2f}", WHITE), ("ceiling", ceil, WHITE),
                     ("crash", f"{r['crash']:.1f}", RED)]
            for i, (lab, val, c) in enumerate(stats):
                xx = 1265 + i * 220
                d.text((xx, 575), lab, font=F("m", 18), fill=ca(GREY), anchor="mm")
                d.text((xx, 622), val, font=F("sb", 44), fill=ca(c), anchor="mm")
            d.text((1485, 720), "check yours → " + rb.REPO, font=F("m", 20), fill=ca(CYAN),
                   anchor="mm")

    if WATERMARK:
        d.text((W - 30, 50), WATERMARK, font=F("mb", 26), fill=RED, anchor="rm")
    return img


# ------------------------------------------------------------ setup
def build_state(r, prices, returns):
    n = r["n"]
    order = rb.cluster_order(r["corr"])
    ev = np.sort(np.linalg.eigvalsh(r["corr"]))[::-1]
    spark = []
    for tk in r["tickers"]:
        s = prices[tk].dropna().values
        idx = np.linspace(0, len(s) - 1, 40).astype(int)
        s = s[idx]
        s = (s - s.min()) / (s.max() - s.min() + 1e-12)
        spark.append(s)
    n_factors = int((ev > 1).sum())
    T_TYPE, T_P1, T_P2, T_P3 = 2.0, 6.5, 13.5, 18.5
    stage_t = [
        (T_TYPE, T_P1 - 0.5, f"{r['days']}d"),
        (T_P1 - 0.5, T_P1 + 0.4, "ok"),
        (T_P1 + 0.4, T_P1 + 2.6, f"{n}×{n}"),
        (T_P1 + 2.6, T_P1 + 4.6, f"λ₁={ev[0]:.1f}"),
        (T_P1 + 4.6, T_P2 - 0.3, f"{n_factors} factors"),
        (T_P2 + 0.3, T_P3 - 1.0, f"{r['crash']:.1f} bets"),
    ]
    # terminal log
    log = []
    t0 = T_TYPE + 0.3
    step = (T_P1 - 0.8 - t0) / max(n, 1)
    log.append((T_TYPE + 0.1, "downloading 1y of daily prices…", GREY))
    for i, tk in enumerate(r["tickers"]):
        log.append((t0 + i * step, f"  fetch {tk:<6} ✓  {r['days']} days", GREEN))
    log += [
        (T_P1 - 0.4, "● PASS 1 · PRICES done", BLUE),
        (T_P1 + 0.1, "computing daily returns … ok", WHITE),
        (T_P1 + 0.6, f"correlation matrix {n}×{n} … ok", WHITE),
        (T_P1 + 1.2, f"  avg pairwise ρ = {r['avg_rho']:.2f}", CYAN),
        (T_P1 + 2.7, "eigendecomposition … ok", WHITE),
        (T_P1 + 3.2, f"  λ₁ = {ev[0]:.2f}  ({ev[0] / n * 100:.0f}% of variance)", CYAN),
        (T_P1 + 4.7, f"factors with λ > 1: {n_factors}", WHITE),
        (T_P1 + 5.5, f"N_eff = N² / Σρ² = {r['n_eff']:.2f}", AMBER),
        (T_P2 - 0.4, "● PASS 2 · CORRELATION done", BLUE),
        (T_P2 + 0.3, f"stress test: ρ → {rb.CRASH_RHO}", WHITE),
    ]
    xs, ys = stress_path(r["corr"])
    for k, frac in enumerate([0.33, 0.66, 1.0]):
        idx = int((len(xs) - 1) * frac)
        log.append((T_P2 + 0.8 + k * 1.2, f"  ρ = {xs[idx]:.2f} → {ys[idx]:.1f} bets",
                    mix(CYAN, RED, frac)))
    log += [
        (T_P3 - 0.6, "● PASS 3 · CRASH TEST done", BLUE),
        (T_P3 + 0.2, "", GREY),
        (T_P3 + 0.3, f"you own {n} tickers.", WHITE),
        (T_P3 + 0.6, f"you hold {r['n_eff']:.1f} bets.", BLUE),
        (T_P3 + 1.0, "not financial advice. just math.", GREY),
    ]
    return {
        "r": r, "base": base_layer(r), "labels": [r["tickers"][i] for i in order],
        "corr_o": r["corr"][np.ix_(order, order)], "eig": ev, "spark": spark,
        "stage_t": stage_t, "log": log, "path": (xs, ys), "dur": 24.0,
        "badges": [glow_badge("PASS 1 · PRICES", BLUE), glow_badge("PASS 2 · CORRELATION", BLUE),
                   glow_badge("PASS 3 · CRASH TEST", RED)],
    }


def render(S, out):
    total = int(S["dur"] * FPS)
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
         "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    for f in range(total):
        proc.stdin.write(draw_frame(f / FPS, S).tobytes())
        if f % 90 == 0:
            print(f"  rendering {f / total * 100:4.0f}%", end="\r")
    proc.stdin.close()
    proc.wait()
    print(f"saved video -> {out}  ({S['dur']:.0f}s, {W}x{H})")


def main():
    global WATERMARK
    p = argparse.ArgumentParser(description="Render a demo video of real-bets")
    p.add_argument("tickers", nargs="*")
    p.add_argument("--period", default="1y")
    p.add_argument("--csv")
    p.add_argument("--out", default="real_bets_demo.mp4")
    p.add_argument("--watermark", default="")
    p.add_argument("--frame", type=float, help="save a single PNG frame at this second")
    a = p.parse_args()
    WATERMARK = a.watermark
    if not a.csv and len(a.tickers) < 2:
        p.error("give at least 2 tickers, or --csv prices.csv")
    tickers = [t.upper() for t in a.tickers]
    prices = rb.load_prices(tickers, a.period, a.csv)
    returns = prices.pct_change().dropna(how="all").dropna(axis=1, thresh=20).dropna()
    if returns.shape[1] < 2:
        sys.exit("not enough data.")
    r = rb.analyze(returns)
    S = build_state(r, prices[returns.columns], returns)
    if a.frame is not None:
        draw_frame(a.frame, S).save(a.out)
        print(f"saved frame -> {a.out}")
        return
    render(S, a.out)


if __name__ == "__main__":
    main()
