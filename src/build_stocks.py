"""종목 진단기 계산 — data/stocks/* 장부로 docs/data/stocks/*.json 을 만든다. 표준 라이브러리만 사용.

무엇을 하나
- 종목마다 매일의 '국면'을 정한다: 기술(200일선 위·아래 × 60일 수익률 +·−, 4가지) × 수급(외국인 보유율 20일 변화가 자기 과거의 상·중·하위, 3가지) = 12가지.
- 대상 종목 전체의 과거 모든 날을 국면별로 모아, 그날 이후 20·60·120거래일 수익률을 '아무 날'과 비교한다(검증표).
- 지금 국면이 과거에 평소보다 좋았는지 나빴는지를 그 검증표로 판정한다. 판정 기준은 아래 judge() 한 곳에 있다.
- 재무·공시·기관 수급은 과거 시점 자료가 없어 검증할 수 없으므로 '점검표'로만 보여 준다.

알아야 할 한계(화면에도 적는다)
- 대상이 '지금' 시가총액 상위 종목이라 과거 수익률 전체가 실제보다 좋게 나온다(생존 편향). 국면 사이의 상대 비교로만 읽어야 한다.
- 하루씩 밀어 가며 센 값이라 표본이 서로 겹친다.
"""
from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from build import days_between, rolling_pct, stats
import signals as sg

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data" / "stocks"
OUT = ROOT / "docs" / "data" / "stocks"
HZ = [20, 60, 120]
TECH = ["상승 추세", "추세 위 조정", "추세 아래 반등", "하락 추세"]
FLOW = ["외국인 유입", "외국인 중립", "외국인 유출"]
RISK = ["유상증자", "전환사채", "신주인수권부사채", "교환사채", "횡령", "배임", "소송", "거래정지", "관리종목", "불성실공시", "감자", "상장폐지", "회생절차"]
GOOD = ["자기주식 취득", "자기주식취득", "주식 소각", "주식소각", "무상증자", "현금ㆍ현물배당", "현금배당"]


def num(x):
    try:
        return float(re.sub(r"[^\d.\-]", "", str(x)))
    except ValueError:
        return None


def load_price(code: str):
    dates, close, ratio, volume = [], [], [], []
    with (D / "price" / f"{code}.csv").open(encoding="utf-8") as f:
        for r in csv.reader(f):
            if r[0] == "date":
                continue
            dates.append(r[0]); close.append(float(r[1])); ratio.append(float(r[3]) if len(r) > 3 and r[3] else None); volume.append(float(r[2] or 0))
    # 가격제한폭(±30%)을 넘는 하루 변화는 액면분할 등 권리 조정으로 보고 이전 가격을 같은 비율로 맞춘다
    f = 1.0
    for i in range(len(close) - 1, 0, -1):
        close[i] *= f
        r = close[i] / (close[i - 1] * f) if close[i - 1] > 0 else 1
        if r < 0.69 or r > 1.31:
            f *= r
    if close:
        close[0] *= f
    return dates, close, ratio, volume


def regimes(close, ratio):
    n = len(close)
    tech = [None] * n
    s = 0.0
    for i, v in enumerate(close):
        s += v
        if i >= 200:
            s -= close[i - 200]
        if i >= 199 and close[i - 60] > 0:
            up, pos = v >= s / 200, v >= close[i - 60]
            tech[i] = 0 if up and pos else 1 if up else 2 if pos else 3
    d20 = [None if i < 20 or ratio[i] is None or ratio[i - 20] is None else round(ratio[i] - ratio[i - 20], 4) for i in range(n)]
    pct = rolling_pct(d20, window=2520, min_obs=250)
    flow = [None if p is None else 0 if p >= 0.7 else 2 if p <= 0.3 else 1 for p in pct]
    return tech, flow, d20


def judge(st, base):
    """국면의 60거래일 성적을 '아무 날'과 견줘 판정. 차이가 작으면 중립."""
    if not st or not base or st["n"] < 300:
        return "판정 보류"
    dw, dm = st["win"] - base["win"], st["median"] - base["median"]
    # 오른 비율이 5%p 이상 벌어져야 차이로 인정한다. 3~4%p 차이는 생존 편향과 표본 겹침을 감안하면 믿기 어렵다.
    if dw >= 5 and dm > 0.5:
        return "평소보다 좋았음"
    if dw <= -5 and dm < -0.5:
        return "평소보다 나빴음"
    return "뚜렷한 차이 없음"


def fin_value(rows, title, key):
    for r in rows or []:
        if r.get("title") == title:
            return num((r.get("v") or {}).get(key))
    return None


def build():
    uni = json.loads((D / "universe.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    pooled = {(t, f): {h: [] for h in HZ} for t in range(4) for f in range(3)}
    pooled_all = {h: [] for h in HZ}
    work = []
    kospi = {}
    kp = ROOT / "data" / "raw" / "kospi.csv"
    if kp.exists():
        with kp.open(encoding="utf-8") as fh:
            kospi = {r[0]: float(r[1]) for r in csv.reader(fh) if r[0] != "date"}
    sig_x = {k: {h: [] for h in sg.HZ} for k, _, _ in sg.META}      # 초과수익
    sig_r = {k: {h: [] for h in sg.HZ} for k, _, _ in sg.META}      # 단순수익
    base_x = {h: [] for h in sg.HZ}
    sig_active = {k: [] for k, _, _ in sg.META}
    sig_of = {}
    for s in uni:
        code = s["code"]
        if not (D / "price" / f"{code}.csv").exists():
            continue
        dates, close, ratio, volume = load_price(code)
        if len(close) < 520:
            continue
        tech, flow, d20 = regimes(close, ratio)
        own = {(t, f): [] for t in range(4) for f in range(3)}
        own_all = []
        for i in range(len(close)):
            if tech[i] is None or flow[i] is None:
                continue
            for h in HZ:
                if i + h < len(close):
                    r = (close[i + h] / close[i] - 1) * 100
                    pooled[(tech[i], flow[i])][h].append(r)
                    pooled_all[h].append(r)
                    if h == 60:
                        own[(tech[i], flow[i])].append(r)
                        own_all.append(r)
        # 기술적 신호: 켜진 날 이후의 시장 대비 초과수익
        kv = [kospi.get(d) for d in dates]
        det = {k: sg.cool(v) for k, v in sg.detect(close, volume, ratio).items()}
        for h in sg.HZ:
            for i in range(250, len(close) - h):
                if kv[i] and kv[i + h] and close[i] > 0:
                    base_x[h].append((close[i + h] / close[i] - kv[i + h] / kv[i]) * 100)
        mine = []
        for k, idx in det.items():
            for i in idx:
                if i < 250:
                    continue
                for h in sg.HZ:
                    if i + h < len(close) and kv[i] and kv[i + h] and close[i] > 0:
                        sig_x[k][h].append((close[i + h] / close[i] - kv[i + h] / kv[i]) * 100)
                        sig_r[k][h].append((close[i + h] / close[i] - 1) * 100)
            if idx and idx[-1] >= len(close) - 3:
                sig_active[k].append({"code": code, "name": s["name"], "date": dates[idx[-1]], "close": round(close[-1])})
                mine.append(k)
        sig_of[code] = mine
        work.append((s, dates, close, ratio, tech, flow, d20, own, own_all))

    base = {h: stats(pooled_all[h]) for h in HZ}
    table = []
    for t in range(4):
        for f in range(3):
            st = {str(h): stats(pooled[(t, f)][h]) for h in HZ}
            table.append({"tech": t, "flow": f, "name": f"{TECH[t]} · {FLOW[f]}", "n": (st["60"] or {}).get("n", 0),
                          "stats": {h: v and {"median": v["median"], "win": v["win"], "p25": v["p25"], "p75": v["p75"]} for h, v in st.items()},
                          "dwin": round(st["60"]["win"] - base[60]["win"], 1) if st["60"] and base[60] else None,
                          "dmed": round(st["60"]["median"] - base[60]["median"], 2) if st["60"] and base[60] else None,
                          "verdict": judge(st["60"], base[60])})
    verdict_of = {(r["tech"], r["flow"]): r for r in table}

    sbase = {h: stats(base_x[h]) for h in sg.HZ}
    sig_table = []
    for k, name, desc in sg.META:
        sx = {h: stats(sig_x[k][h]) for h in sg.HZ}
        sr = {h: stats(sig_r[k][h]) for h in sg.HZ}
        v = sg.judge(sx[20], sbase[20])
        sig_table.append({"id": k, "name": name, "desc": desc, "n": (sx[20] or {}).get("n", 0), "verdict": v,
                          "dwin": round(sx[20]["win"] - sbase[20]["win"], 1) if sx[20] and sbase[20] else None,
                          "excess": {str(h): sx[h] and {"median": sx[h]["median"], "win": sx[h]["win"]} for h in sg.HZ},
                          "raw": {str(h): sr[h] and {"median": sr[h]["median"], "win": sr[h]["win"], "min": sr[h]["min"], "max": sr[h]["max"]} for h in sg.HZ},
                          "active": sig_active[k]})
    sig_name = {k: n for k, n, _ in sg.META}

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = []
    for s, dates, close, ratio, tech, flow, d20, own, own_all in work:
        code = s["code"]
        i = len(close) - 1
        t, f = tech[i], flow[i]
        row = verdict_of.get((t, f)) if t is not None and f is not None else None
        own_st, own_base = (stats(own[(t, f)]) if row else None), stats(own_all)

        # 수급(최근 60거래일 실제 순매수)
        frows = []
        fp = D / "flow" / f"{code}.csv"
        if fp.exists():
            with fp.open(encoding="utf-8") as fh:
                frows = [r for r in csv.reader(fh) if r[0] != "date"]
        last20 = frows[-20:]
        f20 = {"foreign": sum(int(r[1]) for r in last20), "inst": sum(int(r[2]) for r in last20), "indiv": sum(int(r[3]) for r in last20), "days": len(last20)} if last20 else None

        # 재무·투자지표 스냅숏
        ex = json.loads((D / "extra" / f"{code}.json").read_text(encoding="utf-8")) if (D / "extra" / f"{code}.json").exists() else {}
        info = {x["code"]: x["value"] for x in ((ex.get("integration") or {}).get("totalInfos") or [])}
        cons = (ex.get("integration") or {}).get("consensus") or {}
        q = ex.get("quarter") or {}
        actual_q = [p["key"] for p in (q.get("periods") or []) if p.get("isConsensus") == "N"]
        op_now = op_prev = None
        if len(actual_q) >= 5:
            op_now, op_prev = fin_value(q.get("rows"), "영업이익", actual_q[-1]), fin_value(q.get("rows"), "영업이익", actual_q[-5])
        a = ex.get("annual") or {}
        actual_a = [p["key"] for p in (a.get("periods") or []) if p.get("isConsensus") == "N"]
        cons_a = [p["key"] for p in (a.get("periods") or []) if p.get("isConsensus") == "Y"]
        target = num(cons.get("priceTargetMean"))
        fund = {
            "per": num(info.get("per")), "pbr": num(info.get("pbr")), "cns_per": num(info.get("cnsPer")), "div_yield": num(info.get("dividendYieldRatio")),
            "roe": fin_value(a.get("rows"), "ROE", actual_a[-1]) if actual_a else None,
            "op_margin": fin_value(a.get("rows"), "영업이익률", actual_a[-1]) if actual_a else None,
            "debt_ratio": fin_value(a.get("rows"), "부채비율", actual_a[-1]) if actual_a else None,
            "q_period": actual_q[-1] if actual_q else None, "q_op": op_now, "q_op_prev": op_prev,
            "y_op": fin_value(a.get("rows"), "영업이익", actual_a[-1]) if actual_a else None,
            "y_op_cns": fin_value(a.get("rows"), "영업이익", cons_a[0]) if cons_a else None, "y_cns_period": cons_a[0] if cons_a else None,
            "target": target, "target_gap": round((target / close[i] - 1) * 100, 1) if target and close[i] > 0 else None,
        }

        # 공시
        disc = []
        for dsc in (ex.get("disclosure") or [])[:12]:
            title = re.sub(r"^.*?\(주\)\s*|^\(주\).*?\s", "", dsc.get("title") or "").strip() or dsc.get("title")
            tag = "주의" if any(k in title for k in RISK) else "우호" if any(k in title for k in GOOD) else ""
            disc.append({"date": dsc.get("date"), "title": title, "tag": tag})
        recent = [x for x in disc if x["date"] and days_between(x["date"], dates[i]) <= 60]

        # 점검표: 참(좋음)/거짓(나쁨)/None(판단 불가·중립)
        checks = [
            {"k": "추세", "v": None if t is None else t in (0, 1), "note": TECH[t] if t is not None else "이력 부족"},
            {"k": "외국인", "v": None if f is None or f == 1 else f == 0, "note": (FLOW[f] + f" (보유율 20일 {d20[i]:+.2f}%p)") if f is not None and d20[i] is not None else "자료 없음"},
            {"k": "기관", "v": None if not f20 or f20["days"] < 20 else f20["inst"] > 0, "note": f"최근 20일 순매수 {f20['inst']:+,}주" if f20 else "자료 없음"},
            {"k": "이익", "v": None if op_now is None or op_prev is None else op_now > op_prev,
             "note": f"최근 분기 영업이익 {op_now:,.0f}억, 1년 전 {op_prev:,.0f}억" if op_now is not None and op_prev is not None else "자료 없음"},
            {"k": "공시", "v": not any(x["tag"] == "주의" for x in recent), "note": "최근 60일 주의 공시 " + (str(sum(1 for x in recent if x["tag"] == "주의")) + "건" if any(x["tag"] == "주의" for x in recent) else "없음")},
        ]
        good, bad = sum(1 for c in checks if c["v"] is True), sum(1 for c in checks if c["v"] is False)

        def ch(k):
            return round((close[i] / close[i - k] - 1) * 100, 2) if i >= k and close[i - k] > 0 else None

        w = close[-250:]
        head = {"code": code, "name": s["name"], "market": s["market"], "date": dates[i], "close": round(close[i]), "d1": ch(1), "d20": ch(20), "d250": ch(250),
                "tech": t, "flow": f, "state": row["name"] if row else None, "verdict": row["verdict"] if row else "판정 보류", "dwin": row["dwin"] if row else None,
                "good": good, "bad": bad, "per": fund["per"], "pbr": fund["pbr"], "signals": [sig_name[k] for k in sig_of.get(code, [])]}
        index.append(head)
        detail = {**head, "updated": now, "since": dates[0], "from_hi": round((close[i] / max(w) - 1) * 100, 1),
                  "spark": [round(x) for x in close[-250:]], "ratio": [x for x in ratio[-250:]], "ratio_now": ratio[i], "ratio_d20": d20[i],
                  "pooled": row and {"n": row["n"], "stats": row["stats"], "dmed": row["dmed"]}, "base": {str(h): base[h] and {"median": base[h]["median"], "win": base[h]["win"]} for h in HZ},
                  "own": own_st and {"n": own_st["n"], "median": own_st["median"], "win": own_st["win"]},
                  "own_base": own_base and {"n": own_base["n"], "median": own_base["median"], "win": own_base["win"]},
                  "checks": checks, "flow20": f20, "flows": [[r[0], int(r[1]), int(r[2])] for r in frows[-20:]], "fund": fund, "disc": disc[:8]}
        (OUT / f"{code}.json").write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    asof = max((x["date"] for x in index), default=None)
    (OUT / "index.json").write_text(json.dumps(
        {"updated": now, "asof": asof, "tech": TECH, "flow": FLOW, "base": {str(h): base[h] and {"n": base[h]["n"], "median": base[h]["median"], "win": base[h]["win"]} for h in HZ},
         "table": table, "stocks": index}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "signals.json").write_text(json.dumps(
        {"updated": now, "asof": asof, "universe": len(index), "cooldown": sg.COOLDOWN,
         "base": {str(h): sbase[h] and {"n": sbase[h]["n"], "median": sbase[h]["median"], "win": sbase[h]["win"]} for h in sg.HZ},
         "signals": sig_table}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"stocks": len(index), "asof": asof, "base60": base[60] and (base[60]["median"], base[60]["win"])}


if __name__ == "__main__":
    print(json.dumps(build(), ensure_ascii=False))
