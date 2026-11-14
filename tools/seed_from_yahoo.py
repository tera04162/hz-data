"""장기 이력 1회 수령 도구 — 집 PC처럼 Yahoo Finance가 열리는 곳에서 실행한다(깃허브 실행기에서는 429로 막힌다).

    python tools/seed_from_yahoo.py        # seed/gold.csv, seed/wti.csv, seed/hyg.csv 를 다시 만든다

만든 뒤에는 data/raw/<id>.csv 에서 네이버·나스닥이 주는 구간보다 앞선 날짜만 seed 값으로 채운다.
날짜는 반드시 거래소 시간대(America/New_York)로 바꾼다. 고정 오프셋을 쓰면 서머타임 기간에 하루씩 밀린다.
"""
import csv, datetime as dt, json, urllib.parse, urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

OUT = Path(__file__).resolve().parent.parent / "seed"
OUT.mkdir(exist_ok=True)
for sym, name in (("GC=F", "gold"), ("CL=F", "wti"), ("HYG", "hyg")):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?period1=0&period2=9999999999&interval=1d"
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=40))["chart"]["result"][0]
    tz = ZoneInfo(r["meta"].get("exchangeTimezoneName") or "America/New_York")
    rows = {dt.datetime.fromtimestamp(t, tz).strftime("%Y-%m-%d"): round(float(c), 4)
            for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]) if c is not None}
    with (OUT / f"{name}.csv").open("w", newline="") as f:
        w = csv.writer(f); w.writerow(["date", "value"])
        for d in sorted(rows):
            w.writerow([d, rows[d]])
    print(name, len(rows), min(rows), max(rows))
