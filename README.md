# real-bets

**You own 20 stocks. How many bets do you actually have?**

`real-bets` downloads real price data for your tickers, measures how they move together, and tells you the **effective number of independent bets** in your portfolio — plus a correlation map you can share.

```
----------------------------------------------
 REAL BETS  |  20 tickers, 251 days (1y)
----------------------------------------------
 average correlation                0.40
 effective number of bets            4.4
 ceiling at this correlation         6.1
 in a crash (rho = 0.7)              1.9
----------------------------------------------
 you own 20 tickers. you hold 4.4 bets.
```

The math is explained in the article: **[You Own 20 Stocks. You Have 3 Bets.](https://x.com/glex999/status/2103977489831706882)**

---

## Quick start

```bash
git clone https://github.com/gleX999/real-bets
cd real-bets
pip install -r requirements.txt

python real_bets.py AAPL MSFT NVDA GOOGL AMZN META JPM XOM
```

Options:

```bash
python real_bets.py AAPL MSFT NVDA --period 2y     # lookback: 6mo, 1y, 2y, 5y
python real_bets.py AAPL MSFT NVDA --out mine.png  # custom image name
python real_bets.py --csv prices.csv               # offline: your own price file
```

### Make a demo video

```bash
python demo_video.py NVDA AMD AVGO MSFT GOOGL META AMZN AAPL JPM XOM
```

Renders `real_bets_demo.mp4` (1920×1080, ~24s): a live terminal on the left and a dashboard on the right that runs three passes — prices, correlation matrix with eigenvalue spectrum, and a crash stress test — ending on your real number of bets. Needs `ffmpeg` (Colab has it).

### No Python on your machine? Use Google Colab (works on a phone too)

Open [colab.research.google.com](https://colab.research.google.com), create a new notebook and run:

```python
!git clone https://github.com/gleX999/real-bets
%cd real-bets
!pip install -q yfinance
!python real_bets.py AAPL MSFT NVDA GOOGL AMZN META JPM XOM
!python demo_video.py AAPL MSFT NVDA GOOGL AMZN META JPM XOM
```

Then open `real_bets.png` and `real_bets_demo.mp4` from the file panel on the left.

---

## What it measures

| Output | Meaning |
|---|---|
| **average correlation** | how much your holdings move together, from −1 to 1 |
| **effective number of bets** | how many truly independent positions you hold |
| **ceiling** | the most bets you could reach by adding more similar stocks (1/ρ²) |
| **in a crash** | your bets if average correlation jumps to 0.7, as it tends to in selloffs |
| **most correlated pairs** | the positions that are secretly the same bet |

## The math

Effective number of bets, from the correlation matrix of daily returns:

```
N_eff = N² / Σ ρ_ij²        (sum over every pair, including each stock with itself)
```

If every pair has the same correlation ρ, this simplifies to:

```
N_eff = N / (1 + (N − 1) × ρ²)      →   ceiling 1/ρ² as N grows
```

This equals the participation ratio of the correlation matrix's eigenvalues: one dominant eigenvalue means one hidden factor (usually "the market") is running the whole portfolio.

## Notes and limits

- Uses **equal weights**. A portfolio with one huge position is less diversified than the number shows.
- Correlations come from **past** returns and change over time, especially in crashes.
- Price data comes from Yahoo Finance via `yfinance` and may have gaps.

## License

MIT. Not financial advice. Just math.

Made by [@gleX999](https://x.com/gleX999).
