"""계산 엔진 — data/raw/*.csv 장부를 읽어 docs/data/*.json 을 만든다. 표준 라이브러리만 사용.

산출물
- market.json            시장 체온(종합), 자산별 온도·등락, 유사 국면, 지금 켜진 신호
- events.json            이벤트 통계 요약(전체 목록)
- events/<id>.json       이벤트별 과거 발생일과 이후 수익률 전체

방법론(바꾸면 README와 블로그 설명문도 같이 고칠 것)
- 자산 온도(0~100) = 0.6 x [200일 이동평균 대비 이격의 백분위] + 0.4 x [60거래일 변화의 백분위]
  백분위는 '그날 이전' 최대 20년(5040거래일) 자기 과거와 비교한다. 미래 값을 쓰지 않는다.
  장부가 10년 미만인 자산은 온도를 내지 않는다.
- 시장 체온 = 자산 온도의 가중평균. VIX·원/달러는 뒤집어서(100-온도) 넣는다.
- 이벤트 통계 = 조건이 처음 충족된 날(쿨다운으로 뭉침 제거) 이후 N거래일 수익률 분포 + 같은 기간 '아무 날' 평균과 비교.
"""
from __future__ import annotations

import csv
import json
import math
from bisect import bisect_left, bisect_right, insort
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "docs" / "data"

WINDOW = 5040        # 백분위 비교 창: 약 20년
MIN_OBS = 500        # 이만큼 과거가 쌓이기 전에는 온도를 내지 않는다
MIN_HISTORY = 2520   # 장부가 10년(2520거래일)에 못 미치는 자산은 온도를 내지 않는다 — 짧은 과거와의 비교는 의미가 없다
MA = 200
MOM = 60
HORIZONS = [5, 20, 60, 120, 250]
FFILL_DAYS = 10      # 달력이 다른 시계열을 맞출 때 허용하는 최대 공백(일)
LABELS = [(20, "혹한"), (40, "쌀쌀"), (60, "평온"), (80, "따뜻"), (101, "과열")]


def label_of(t: float) -> str:
    for hi, name in LABELS:
        if t < hi:
            return name
    return "과열"


# ---------- 기본 도구 ----------

def load(sid: str) -> tuple[list[str], list[float]]:
    p = RAW / f"{sid}.csv"
    if not p.exists():
        return [], []
    rows = []
    with p.open(encoding="utf-8") as f:
        for r in csv.reader(f):
            if len(r) == 2 and r[0] != "date":
                rows.append((r[0], float(r[1])))
    rows.sort()
    return [d for d, _ in rows], [v for _, v in rows]


def rolling_pct(xs: list[float | None], window: int = WINDOW, min_obs: int = MIN_OBS) -> list[float | None]:
    """각 시점 값이 '그 이전' window개 안에서 차지하는 백분위(0~1). 동률은 절반 반영."""
    out: list[float | None] = [None] * len(xs)
    sorted_win: list[float] = []
    order: list[float] = []
    for i, x in enumerate(xs):
        if x is None:
            continue
        n = len(sorted_win)
        if n >= min_obs:
            lo, hi = bisect_left(sorted_win, x), bisect_right(sorted_win, x)
            out[i] = (lo + 0.5 * (hi - lo)) / n
        insort(sorted_win, x)
        order.append(x)
        if len(order) > window:
            old = order.pop(0)
            del sorted_win[bisect_left(sorted_win, old)]
    return out


def temperature(vals: list[float], kind: str) -> list[float | None]:
    n = len(vals)
    gap: list[float | None] = [None] * n
    mom: list[float | None] = [None] * n
    s = 0.0
    for i, v in enumerate(vals):
        s += v
        if i >= MA:
            s -= vals[i - MA]
        if i >= MA - 1:
            ma = s / MA
            gap[i] = (v / ma - 1) if kind == "price" and ma > 0 else (v - ma)
        if i >= MOM:
            b = vals[i - MOM]
            mom[i] = (v / b - 1) if kind == "price" and b > 0 else (v - b)
    p1, p2 = rolling_pct(gap), rolling_pct(mom)
    return [None if a is None or b is None else round(100 * (0.6 * a + 0.4 * b), 2) for a, b in zip(p1, p2)]


def days_between(a: str, b: str) -> int:
    return (datetime.strptime(b, "%Y-%m-%d") - datetime.strptime(a, "%Y-%m-%d")).days


def align(dates: list[str], vals: list, master: list[str], max_gap: int = FFILL_DAYS) -> list:
    """master 달력에 맞춰 직전 값으로 채운다. 공백이 max_gap일을 넘으면 None."""
    out = [None] * len(master)
    j = -1
    for i, d in enumerate(master):
        while j + 1 < len(dates) and dates[j + 1] <= d:
            j += 1
        if j >= 0 and vals[j] is not None and days_between(dates[j], d) <= max_gap:
            out[i] = vals[j]
    return out


def chg(vals: list[float], k: int, kind: str) -> float | None:
    if len(vals) <= k:
        return None
    a, b = vals[-1 - k], vals[-1]
    if kind == "price":
        return round((b / a - 1) * 100, 2) if a > 0 else None
    return round(b - a, 3)


def stats(xs: list[float]) -> dict | None:
    if not xs:
        return None
    s = sorted(xs)
    n = len(s)

    def q(p: float) -> float:
        k = (n - 1) * p
        f, c = math.floor(k), math.ceil(k)
        return s[f] + (s[c] - s[f]) * (k - f)

    return {"n": n, "mean": round(sum(s) / n, 2), "median": round(median(s), 2),
            "win": round(100 * sum(1 for x in s if x > 0) / n, 1),
            "min": round(s[0], 2), "max": round(s[-1], 2), "p25": round(q(.25), 2), "p75": round(q(.75), 2)}


# ---------- 이벤트 탐지기: (dates, vals) -> 조건이 충족된 인덱스 목록 ----------

def det_daily_move(vals, thr_pct):
    out = []
    for i in range(1, len(vals)):
        r = (vals[i] / vals[i - 1] - 1) * 100
        if (thr_pct < 0 and r <= thr_pct) or (thr_pct > 0 and r >= thr_pct):
            out.append(i)
    return out


def det_cross(vals, level, up=True):
    out = []
    for i in range(1, len(vals)):
        if up and vals[i - 1] < level <= vals[i]:
            out.append(i)
        if not up and vals[i - 1] > level >= vals[i]:
            out.append(i)
    return out


def det_extreme(vals, window=250, high=True):
    out = []
    for i in range(window, len(vals)):
        w = vals[i - window:i]
        if (high and vals[i] > max(w)) or (not high and vals[i] < min(w)):
            out.append(i)
    return out


def det_drawdown(vals, pct, window=250):
    """최근 window일 고점 대비 낙폭이 -pct%를 '처음' 넘어선 날."""
    out, prev = [], 0.0
    for i in range(len(vals)):
        peak = max(vals[max(0, i - window + 1):i + 1])
        dd = (vals[i] / peak - 1) * 100
        if i >= window and prev > -pct >= dd:
            out.append(i)
        prev = dd
    return out


def det_streak(vals, n, down=True):
    out, run = [], 0
    for i in range(1, len(vals)):
        hit = vals[i] < vals[i - 1] if down else vals[i] > vals[i - 1]
        run = run + 1 if hit else 0
        if run == n:
            out.append(i)
    return out


def det_ma_cross(vals, ma=200, up=False):
    out, s, prev = [], 0.0, None
    for i, v in enumerate(vals):
        s += v
        if i >= ma:
            s -= vals[i - ma]
        if i >= ma - 1:
            side = v >= s / ma
            if prev is not None and side != prev and side == up:
                out.append(i)
            prev = side
    return out


def cooldown(idx: list[int], gap: int) -> list[int]:
    out: list[int] = []
    for i in idx:
        if not out or i - out[-1] > gap:
            out.append(i)
    return out


EVENTS = [
    # id, 제목, 설명, 원천 시계열, 탐지 함수, 쿨다운(거래일), 수익률을 볼 대상
    ("kospi_drop3", "코스피 하루 3% 이상 급락", "코스피 종가가 전일보다 3% 이상 떨어진 날", "kospi", lambda v: det_daily_move(v, -3), 10, ["kospi"]),
    ("kospi_rise3", "코스피 하루 3% 이상 급등", "코스피 종가가 전일보다 3% 이상 오른 날", "kospi", lambda v: det_daily_move(v, 3), 10, ["kospi"]),
    ("kospi_streak5", "코스피 5거래일 연속 하락", "코스피가 5거래일 연달아 내린 날", "kospi", lambda v: det_streak(v, 5), 10, ["kospi"]),
    ("kospi_dd10", "코스피 고점 대비 -10% 진입", "코스피가 최근 1년 고점에서 10% 넘게 밀린 첫날(조정 진입)", "kospi", lambda v: det_drawdown(v, 10), 60, ["kospi"]),
    ("kospi_dd20", "코스피 고점 대비 -20% 진입", "코스피가 최근 1년 고점에서 20% 넘게 밀린 첫날(약세장 진입)", "kospi", lambda v: det_drawdown(v, 20), 120, ["kospi"]),
    ("kospi_high52", "코스피 52주 신고가", "코스피가 최근 250거래일 최고치를 새로 쓴 날", "kospi", lambda v: det_extreme(v, 250, True), 60, ["kospi"]),
    ("kospi_low52", "코스피 52주 신저가", "코스피가 최근 250거래일 최저치를 새로 쓴 날", "kospi", lambda v: det_extreme(v, 250, False), 60, ["kospi"]),
    ("kospi_below200", "코스피 200일선 하향 이탈", "코스피 종가가 200일 이동평균 아래로 내려간 날", "kospi", lambda v: det_ma_cross(v, 200, False), 60, ["kospi"]),
    ("kospi_above200", "코스피 200일선 회복", "코스피 종가가 200일 이동평균 위로 올라선 날", "kospi", lambda v: det_ma_cross(v, 200, True), 60, ["kospi"]),
    ("nasdaq_drop3", "나스닥 하루 3% 이상 급락", "나스닥 종합지수가 하루에 3% 이상 떨어진 날", "nasdaq", lambda v: det_daily_move(v, -3), 10, ["nasdaq", "kospi"]),
    ("nasdaq_dd10", "나스닥 고점 대비 -10% 진입", "나스닥이 최근 1년 고점에서 10% 넘게 밀린 첫날", "nasdaq", lambda v: det_drawdown(v, 10), 60, ["nasdaq"]),
    ("spx_drop3", "S&P 500 하루 3% 이상 급락", "S&P 500이 하루에 3% 이상 떨어진 날", "spx", lambda v: det_daily_move(v, -3), 10, ["spx", "kospi"]),
    ("spx_dd10", "S&P 500 고점 대비 -10% 진입", "S&P 500이 최근 1년 고점에서 10% 넘게 밀린 첫날(조정 진입)", "spx", lambda v: det_drawdown(v, 10), 60, ["spx"]),
    ("spx_dd20", "S&P 500 고점 대비 -20% 진입", "S&P 500이 최근 1년 고점에서 20% 넘게 밀린 첫날(약세장 진입)", "spx", lambda v: det_drawdown(v, 20), 120, ["spx", "kospi"]),
    ("spx_below200", "S&P 500 200일선 하향 이탈", "S&P 500 종가가 200일 이동평균 아래로 내려간 날", "spx", lambda v: det_ma_cross(v, 200, False), 60, ["spx"]),
    ("vix_cross30", "VIX 30 돌파", "VIX가 30 아래에 있다가 30 이상으로 마감한 날", "vix", lambda v: det_cross(v, 30, True), 20, ["spx", "kospi"]),
    ("vix_cross40", "VIX 40 돌파", "VIX가 40 아래에 있다가 40 이상으로 마감한 날", "vix", lambda v: det_cross(v, 40, True), 20, ["spx", "kospi"]),
    ("hyg_dd5", "하이일드 채권 고점 대비 -5% 진입", "하이일드 채권 ETF(HYG)가 최근 1년 고점에서 5% 넘게 밀린 첫날(신용 불안 신호)", "hyg", lambda v: det_drawdown(v, 5), 60, ["spx", "kospi"]),
    ("curve_invert", "미국 장단기 금리 역전", "미국 10년-2년 금리 차가 0 아래로 내려간 날", "curve", lambda v: det_cross(v, 0, False), 120, ["spx"]),
    ("curve_uninvert", "미국 장단기 금리 역전 해소", "미국 10년-2년 금리 차가 다시 0 위로 올라선 날", "curve", lambda v: det_cross(v, 0, True), 120, ["spx"]),
    ("usdkrw_high52", "원/달러 환율 52주 신고가", "원/달러 환율이 최근 250거래일 최고치를 새로 쓴 날(원화 약세)", "usdkrw", lambda v: det_extreme(v, 250, True), 60, ["kospi", "usdkrw"]),
    ("wti_drop5", "WTI 유가 하루 5% 이상 급락", "WTI가 하루에 5% 이상 떨어진 날", "wti", lambda v: det_daily_move(v, -5), 10, ["wti"]),
    ("wti_rise5", "WTI 유가 하루 5% 이상 급등", "WTI가 하루에 5% 이상 오른 날", "wti", lambda v: det_daily_move(v, 5), 10, ["wti", "kospi"]),
    ("gold_high52", "금 52주 신고가", "금 가격이 최근 250거래일 최고치를 새로 쓴 날", "gold", lambda v: det_extreme(v, 250, True), 60, ["gold"]),
    ("gold_drop3", "금 하루 3% 이상 급락", "금 선물이 하루에 3% 이상 떨어진 날", "gold", lambda v: det_daily_move(v, -3), 10, ["gold"]),
    ("dxy_high52", "달러 지수 52주 신고가", "연준 광의 달러 지수가 최근 250거래일 최고치를 새로 쓴 날(달러 강세)", "dxy", lambda v: det_extreme(v, 250, True), 60, ["kospi", "spx"]),
    ("btc_drop10", "비트코인 하루 10% 이상 급락", "비트코인이 하루에 10% 이상 떨어진 날", "btc", lambda v: det_daily_move(v, -10), 10, ["btc"]),
]


def forward_returns(ev_dates: list[str], tdates: list[str], tvals: list[float]) -> list[list]:
    """각 발생일 이후 대상 자산의 N거래일 수익률(%). 기준가는 발생일 당일 또는 그 직전 종가."""
    rows = []
    for d in ev_dates:
        i = bisect_right(tdates, d) - 1
        if i < 0 or days_between(tdates[i], d) > FFILL_DAYS or tvals[i] <= 0:
            continue
        row = [d]
        for h in HORIZONS:
            row.append(round((tvals[i + h] / tvals[i] - 1) * 100, 2) if i + h < len(tvals) else None)
        rows.append(row)
    return rows


def baseline(tdates: list[str], tvals: list[float], since: str) -> dict:
    s = bisect_left(tdates, since)
    out = {}
    for h in HORIZONS:
        xs = [(tvals[i + h] / tvals[i] - 1) * 100 for i in range(s, len(tvals) - h) if tvals[i] > 0]
        st = stats(xs)
        out[str(h)] = None if st is None else {"mean": st["mean"], "median": st["median"], "win": st["win"]}
    return out


# ---------- 조립 ----------

def build() -> dict:
    cfg = json.loads((ROOT / "config" / "series.json").read_text(encoding="utf-8"))
    spec = {s["id"]: s for s in cfg["series"]}
    S = {sid: load(sid) for sid in spec}
    S = {k: v for k, v in S.items() if len(v[0]) >= 30}
    if not S:
        raise SystemExit("장부가 비어 있음 — fetch.py를 먼저 실행")
    names = {sid: spec[sid]["name"] for sid in spec}
    names["curve"] = "미국 10년-2년 금리 차"

    # 파생: 장단기 금리 차
    if "us10y" in S and "us2y" in S:
        d2 = dict(zip(*S["us2y"]))
        cd = [d for d in S["us10y"][0] if d in d2]
        d10 = dict(zip(*S["us10y"]))
        S["curve"] = (cd, [round(d10[d] - d2[d], 4) for d in cd])

    temps = {sid: (temperature(S[sid][1], spec[sid]["kind"]) if len(S[sid][1]) >= MIN_HISTORY else [None] * len(S[sid][1]))
             for sid in S if sid in spec}

    # 기준 달력: 한국·미국 주식 중 하나라도 열린 날
    master = sorted(set(S.get("kospi", ([], []))[0]) | set(S.get("spx", ([], []))[0])) or sorted(set().union(*[set(v[0]) for v in S.values()]))
    asof = master[-1]

    # 시장 체온
    comp_w = [w for w in cfg["composite"]["weights"] if w["id"] in temps]
    aligned = {w["id"]: align(S[w["id"]][0], temps[w["id"]], master) for w in comp_w}
    comp: list[float | None] = []
    for i in range(len(master)):
        num = den = 0.0
        for w in comp_w:
            t = aligned[w["id"]][i]
            if t is None:
                continue
            num += w["w"] * (t if w["sign"] > 0 else 100 - t)
            den += w["w"]
        comp.append(round(num / den, 1) if den >= 0.5 else None)

    last_i = max((i for i, c in enumerate(comp) if c is not None), default=None)
    composite = None
    analogs = []
    if last_i is not None:
        cval = comp[last_i]
        hist_vals = [c for c in comp[max(0, last_i - WINDOW):last_i] if c is not None]
        pct = round(100 * sum(1 for c in hist_vals if c < cval) / len(hist_vals), 1) if hist_vals else None

        def back(k):
            j = last_i - k
            return round(cval - comp[j], 1) if j >= 0 and comp[j] is not None else None

        comps = []
        for w in comp_w:
            t = aligned[w["id"]][last_i]
            if t is not None:
                comps.append({"id": w["id"], "name": names[w["id"]], "temp": t, "sign": w["sign"],
                              "adj": round(t if w["sign"] > 0 else 100 - t, 1), "w": w["w"]})
        start = max(0, last_i - WINDOW)
        hist = [[master[i], comp[i]] for i in range(start, last_i + 1) if comp[i] is not None and (i % 5 == 0 or i > last_i - 250)]
        composite = {"value": cval, "label": label_of(cval), "pct": pct, "date": master[last_i],
                     "chg5": back(5), "chg20": back(20), "components": comps, "hist": hist}

        # 유사 국면: 오늘과 구성 온도가 가장 비슷했던 과거 날짜
        # 이력이 15년 넘는 재료만 쓴다(비트코인처럼 짧은 자산이 끼면 비교 대상이 최근 몇 년으로 쪼그라든다)
        ids = [c["id"] for c in comps if days_between(S[c["id"]][0][0], master[last_i]) >= 15 * 365]
        today_vec = [aligned[i][last_i] for i in ids]
        cands = []
        for i in range(0, last_i - 250 if ids else 0):
            vec = [aligned[k][i] for k in ids]
            if any(v is None for v in vec) or comp[i] is None:
                continue
            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(vec, today_vec)) / len(vec))
            cands.append((dist, i))
        cands.sort()
        picked: list[int] = []
        for dist, i in cands:
            if all(abs(i - p) > 120 for p in picked):
                picked.append(i)
                row = {"date": master[i], "dist": round(dist, 1), "composite": comp[i], "after": {}}
                for tid in ("kospi", "spx"):
                    if tid in S:
                        fr = forward_returns([master[i]], *S[tid])
                        if fr:
                            row["after"][tid] = dict(zip(["20", "60", "120"], [fr[0][2], fr[0][3], fr[0][4]]))
                analogs.append(row)
            if len(picked) >= 5:
                break

    # 체온 구간별 이후 수익률 — 체온 숫자 자체가 쓸모 있는지 검증하는 표
    bands = []
    if composite is not None:
        edges = [0] + [hi for hi, _ in LABELS]
        tot = sum(1 for c in comp if c is not None)
        for bi, (hi, nm) in enumerate(LABELS):
            lo = edges[bi]
            days = [i for i, c in enumerate(comp) if c is not None and lo <= c < hi]
            row = {"name": nm, "lo": lo, "hi": min(hi, 100), "days": len(days),
                   "share": round(100 * len(days) / tot, 1) if tot else None, "now": lo <= composite["value"] < hi, "after": {}}
            for tid in ("kospi", "spx"):
                if tid not in S:
                    continue
                td, tv = S[tid]
                row["after"][tid] = {}
                for h in (60, 120, 250):
                    xs = []
                    for i in days:
                        j = bisect_right(td, master[i]) - 1
                        if j >= 0 and j + h < len(tv) and tv[j] > 0 and days_between(td[j], master[i]) <= FFILL_DAYS:
                            xs.append((tv[j + h] / tv[j] - 1) * 100)
                    st = stats(xs)
                    row["after"][tid][str(h)] = None if st is None else {"n": st["n"], "median": st["median"], "win": st["win"], "min": st["min"]}
            bands.append(row)

    # 자산 카드
    assets = []
    for s in cfg["series"]:
        sid = s["id"]
        if sid not in S:
            continue
        d, v = S[sid]
        k = s["kind"]
        y0 = bisect_left(d, d[-1][:4] + "-01-01")
        ytd = None
        if y0 > 0:
            base = v[y0 - 1]
            ytd = round((v[-1] / base - 1) * 100, 2) if k == "price" else round(v[-1] - base, 3)
        w = v[-250:]
        t = temps[sid][-1]
        assets.append({
            "id": sid, "name": s["name"], "group": s["group"], "unit": s["unit"], "digits": s["digits"], "kind": k,
            "date": d[-1], "last": round(v[-1], 4), "stale": days_between(d[-1], asof) > 7,
            "d1": chg(v, 1, k), "d5": chg(v, 5, k), "d20": chg(v, 20, k), "d250": chg(v, 250, k), "ytd": ytd,
            "hi52": round(max(w), 4), "lo52": round(min(w), 4),
            "from_hi": round((v[-1] / max(w) - 1) * 100, 2) if k == "price" else round(v[-1] - max(w), 3),
            "temp": t, "label": label_of(t) if t is not None else None,
            "spark": [round(x, 4) for x in v[-120:]], "since": d[0],
        })

    # 이벤트 통계
    ev_summary, active = [], []
    (OUT / "events").mkdir(parents=True, exist_ok=True)
    for eid, title, desc, src, det, gap, targets in EVENTS:
        if src not in S:
            continue
        sd, sv = S[src]
        idx = cooldown(det(sv), gap)
        ev_dates = [sd[i] for i in idx]
        if not ev_dates:
            continue
        is_active = idx[-1] >= len(sv) - 5
        tg_sum, tg_full = [], []
        for tid in targets:
            if tid not in S:
                continue
            td, tv = S[tid]
            rows = forward_returns(ev_dates, td, tv)
            if not rows:
                continue
            st = {str(h): stats([r[k + 1] for r in rows if r[k + 1] is not None]) for k, h in enumerate(HORIZONS)}
            base = baseline(td, tv, rows[0][0])
            tg_sum.append({"id": tid, "name": names[tid], "n": len(rows), "stats": st, "base": base})
            tg_full.append({"id": tid, "name": names[tid], "n": len(rows), "stats": st, "base": base, "rows": rows})
        if not tg_sum:
            continue
        head = {"id": eid, "title": title, "desc": desc, "source": src, "source_name": names[src],
                "cooldown": gap, "n": len(ev_dates), "first": ev_dates[0], "last": ev_dates[-1], "active": is_active}
        ev_summary.append({**head, "targets": tg_sum})
        (OUT / "events" / f"{eid}.json").write_text(
            json.dumps({**head, "horizons": HORIZONS, "targets": tg_full}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        if is_active:
            t0 = tg_sum[0]
            active.append({"id": eid, "title": title, "date": ev_dates[-1], "n": t0["n"], "target": t0["name"],
                           "s20": t0["stats"]["20"], "s60": t0["stats"]["60"], "b60": t0["base"]["60"]})

    # 오늘 달라진 것 — 매일 바뀌는 한 줄들
    brief = []
    if composite is not None and last_i is not None and last_i >= 1 and comp[last_i - 1] is not None:
        d1c = round(composite["value"] - comp[last_i - 1], 1)
        brief.append(f"시장 체온 {composite['value']}도({composite['label']}), 하루 사이 {'+' if d1c > 0 else ''}{d1c}도")
    fresh = [a for a in assets if a["kind"] == "price" and a["d1"] is not None and days_between(a["date"], asof) <= 3]
    if fresh:
        up, dn = max(fresh, key=lambda a: a["d1"]), min(fresh, key=lambda a: a["d1"])
        if up["d1"] > 0:
            brief.append(f"가장 많이 오른 자산은 {up['name']} +{up['d1']}%")
        if dn["d1"] < 0 and dn["id"] != up["id"]:
            brief.append(f"가장 많이 내린 자산은 {dn['name']} {dn['d1']}%")
    for a in assets:
        if a["kind"] == "price" and days_between(a["date"], asof) <= 3:
            if a["last"] >= a["hi52"]:
                brief.append(f"{a['name']} 52주 최고가")
            elif a["last"] <= a["lo52"]:
                brief.append(f"{a['name']} 52주 최저가")
    for e in active:
        brief.append(f"신호 발생: {e['title']}({e['date'][5:].replace('-', '.')})")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    market = {"updated": now, "asof": asof, "composite": composite, "bands": bands, "brief": brief, "assets": assets, "analogs": analogs, "active": active,
              "labels": [{"lt": hi, "name": nm} for hi, nm in LABELS]}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "market.json").write_text(json.dumps(market, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "events.json").write_text(json.dumps(
        {"updated": now, "asof": asof, "horizons": HORIZONS, "events": ev_summary}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"asof": asof, "assets": len(assets), "events": len(ev_summary), "active": len(active),
            "composite": None if composite is None else composite["value"]}


if __name__ == "__main__":
    print(json.dumps(build(), ensure_ascii=False))
