#!/usr/bin/env python3
"""
real-bets: how many independent bets does your portfolio actually hold?

Usage:
    python real_bets.py AAPL MSFT NVDA GOOGL AMZN META JPM XOM
    python real_bets.py AAPL MSFT NVDA --period 2y --out my_portfolio.png
    python real_bets.py --csv prices.csv          # offline: columns = tickers, rows = dates

Math:
    N_eff = N^2 / sum_ij(rho_ij^2)        (effective number of bets, equal weights)
    Equal-correlation shortcut: N_eff = N / (1 + (N-1) * rho^2)
    Ceiling as N -> infinity: 1 / rho^2

Not financial advice. Just math.
"""
import argparse
import sys

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

CRASH_RHO = 0.7  # typical average correlation in a selloff
REPO = "github.com/gleX999/real-bets"  # change if your repo path differs


# ---------------------------------------------------------------- data
def load_prices(tickers, period, csv_path):
    if csv_path:
        df = pd.read_csv(csv_path, index_col=0, parse_dates=True)
        return df.dropna(axis=1, how="all")
    try:
        import yfinance as yf
    except ImportError:
        sys.exit("yfinance is not installed. Run: pip install -r requirements.txt")
    data = yf.download(tickers, period=period, auto_adjust=True, progress=False)
    if data.empty:
        sys.exit("No price data returned. Check the tickers and your connection.")
    prices = data["Close"] if isinstance(data.columns, pd.MultiIndex) else data[["Close"]]
    if isinstance(prices, pd.Series):
        prices = prices.to_frame(tickers[0])
    missing = [t for t in tickers if t not in prices.columns or prices[t].dropna().empty]
    if missing:
        print(f"warning: no data for {', '.join(missing)} (skipped)")
    return prices.drop(columns=[m for m in missing if m in prices.columns])


# ---------------------------------------------------------------- math
def effective_bets(corr):
    n = corr.shape[0]
    return n ** 2 / np.sum(corr ** 2)


def avg_pairwise(corr):
    n = corr.shape[0]
    mask = ~np.eye(n, dtype=bool)
    return corr[mask].mean()


def equal_corr_bets(n, rho):
    return n / (1 + (n - 1) * rho ** 2)


def cluster_order(corr):
    """Order tickers so correlated groups sit next to each other."""
    try:
        from scipy.cluster.hierarchy import linkage, leaves_list
        from scipy.spatial.distance import squareform
        dist = np.sqrt(np.clip(0.5 * (1 - corr), 0, None))
        np.fill_diagonal(dist, 0)
        return leaves_list(linkage(squareform(dist, checks=False), "average"))
    except ImportError:
        # fallback: sort by loading on the first principal component
        _, vecs = np.linalg.eigh(corr)
        return np.argsort(vecs[:, -1])


def analyze(returns):
    corr = returns.corr().values
    n = corr.shape[0]
    rho = avg_pairwise(corr)
    res = {
        "n": n,
        "tickers": list(returns.columns),
        "corr": corr,
        "days": len(returns),
        "avg_rho": rho,
        "n_eff": effective_bets(corr),
        "ceiling": (1 / rho ** 2) if rho > 0 else float("inf"),
        "crash": equal_corr_bets(n, CRASH_RHO),
    }
    # most correlated pairs
    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append((corr[i, j], res["tickers"][i], res["tickers"][j]))
    res["top_pairs"] = sorted(pairs, reverse=True)[:5]
    return res


# ---------------------------------------------------------------- output
def print_report(r, period):
    line = "-" * 46
    print(line)
    print(f" REAL BETS  |  {r['n']} tickers, {r['days']} days ({period})")
    print(line)
    print(f" average correlation        {r['avg_rho']:>8.2f}")
    print(f" effective number of bets   {r['n_eff']:>8.1f}")
    ceil = "no limit" if r["ceiling"] == float("inf") else f"{r['ceiling']:.1f}"
    print(f" ceiling at this correlation {ceil:>7}")
    print(f" in a crash (rho = {CRASH_RHO})      {r['crash']:>8.1f}")
    print(line)
    print(" most correlated pairs:")
    for c, a, b in r["top_pairs"]:
        print(f"   {a:<6} {b:<6} {c:.2f}")
    print(line)
    print(f" you own {r['n']} tickers. you hold {r['n_eff']:.1f} bets.")
    print(" not financial advice. just math.")


def plot(r, out):
    BG, W, G, DG, B = "#000000", "#FFFFFF", "#8A8F98", "#2A2D33", "#2F80FF"
    cmap = LinearSegmentedColormap.from_list("rb", ["#0E1116", "#1A3A6B", B, "#BFD8FF"])

    order = cluster_order(r["corr"])
    corr = r["corr"][np.ix_(order, order)]
    labels = [r["tickers"][i] for i in order]
    n = r["n"]

    fig = plt.figure(figsize=(12, 13), facecolor=BG)
    fig.text(0.06, 0.955, "REAL BETS  ·  CORRELATION MAP", color=G, fontsize=13,
             family="monospace")
    fig.text(0.06, 0.915, f"You own {n} stocks.", color=W, fontsize=30, weight="bold")
    fig.text(0.06, 0.872, f"You have {r['n_eff']:.1f} bets.", color=B, fontsize=30,
             weight="bold")

    ax = fig.add_axes([0.12, 0.2, 0.74, 0.62])
    ax.set_facecolor(BG)
    im = ax.imshow(corr, cmap=cmap, vmin=-0.2, vmax=1, interpolation="nearest")
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    fs = 11 if n <= 20 else 8 if n <= 40 else 6
    ax.set_xticklabels(labels, rotation=90, color=W, fontsize=fs, family="monospace")
    ax.set_yticklabels(labels, color=W, fontsize=fs, family="monospace")
    ax.tick_params(length=0)
    for s in ax.spines.values():
        s.set_visible(False)
    if n <= 15:
        for i in range(n):
            for j in range(n):
                v = corr[i, j]
                ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=8,
                        color=BG if v > 0.75 else W, family="monospace")

    cax = fig.add_axes([0.88, 0.2, 0.018, 0.62])
    cb = fig.colorbar(im, cax=cax)
    cb.outline.set_visible(False)
    cb.ax.tick_params(colors=G, labelsize=10, length=0)

    ceil = "∞" if r["ceiling"] == float("inf") else f"{r['ceiling']:.1f}"
    stats = (f"avg correlation {r['avg_rho']:.2f}    ceiling {ceil} bets    "
             f"crash (ρ={CRASH_RHO}) {r['crash']:.1f} bets")
    fig.text(0.06, 0.1, stats, color=W, fontsize=13, family="monospace")
    fig.text(0.06, 0.07, "N_eff = N² / Σρ²   ·   not financial advice. just math.",
             color=G, fontsize=11, family="monospace")
    fig.lines.append(plt.Line2D([0.06, 0.94], [0.045, 0.045], color=DG,
                                transform=fig.transFigure))
    fig.text(0.06, 0.02, "@gleX999", color=W, fontsize=12, weight="bold",
             family="monospace")
    fig.text(0.94, 0.02, REPO, color=G, fontsize=11,
             ha="right", family="monospace")

    fig.savefig(out, dpi=130, facecolor=BG)
    print(f" saved correlation map -> {out}")


# ---------------------------------------------------------------- main
def main():
    p = argparse.ArgumentParser(description="How many real bets are in your portfolio?")
    p.add_argument("tickers", nargs="*", help="tickers, e.g. AAPL MSFT NVDA")
    p.add_argument("--period", default="1y", help="lookback: 6mo, 1y, 2y, 5y (default 1y)")
    p.add_argument("--csv", help="offline mode: CSV of prices (columns = tickers)")
    p.add_argument("--out", default="real_bets.png", help="output image path")
    a = p.parse_args()

    if not a.csv and len(a.tickers) < 2:
        p.error("give at least 2 tickers, or --csv prices.csv")

    tickers = [t.upper() for t in a.tickers]
    prices = load_prices(tickers, a.period, a.csv)
    returns = prices.pct_change().dropna(how="all").dropna(axis=1, thresh=20).dropna()
    if returns.shape[1] < 2 or len(returns) < 20:
        sys.exit("not enough overlapping price history to compute correlations.")

    r = analyze(returns)
    print_report(r, a.period if not a.csv else "csv")
    plot(r, a.out)


if __name__ == "__main__":
    main()
