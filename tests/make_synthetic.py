"""로컬 점검용 가짜 장부 생성기 — 실제 데이터가 아니다. 지정한 폴더에만 쓴다(저장소 장부를 건드리지 않음)."""
import csv
import math
import random
import sys
from datetime import date, timedelta
from pathlib import Path

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
random.seed(7)
SPEC = {"kospi": (700, .012, 1996), "kosdaq": (600, .015, 1998), "spx": (400, .011, 1990), "nasdaq": (500, .014, 1990),
        "wti": (20, .022, 1990), "gold": (300, .01, 2000), "btc": (400, .04, 2014), "usdkrw": (1100, .005, 1995), "dxy": (100, .003, 2006)}
LEVEL = {"vix": (19, 1990), "us10y": (4, 1990), "us2y": (3.5, 1990), "hy": (4.5, 1997)}
end = date(2026, 11, 13)


def days(y):
    d = date(y, 1, 2)
    while d <= end:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)


for sid, (p, vol, y) in SPEC.items():
    with (out / f"{sid}.csv").open("w", newline="") as f:
        w = csv.writer(f); w.writerow(["date", "value"])
        for d in days(y):
            shock = random.gauss(0.0003, vol) * (3 if random.random() < 0.01 else 1)
            p *= math.exp(shock)
            w.writerow([d.isoformat(), round(p, 4)])
for sid, (m, y) in LEVEL.items():
    x = m
    with (out / f"{sid}.csv").open("w", newline="") as f:
        w = csv.writer(f); w.writerow(["date", "value"])
        for d in days(y):
            x += 0.02 * (m - x) + random.gauss(0, m * 0.03) * (4 if random.random() < 0.01 else 1)
            x = max(0.05, x)
            w.writerow([d.isoformat(), round(x, 4)])
