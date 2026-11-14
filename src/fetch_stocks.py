"""종목 데이터 수집기 — 종목 진단기용. 표준 라이브러리만 사용, 전부 키 없이 열리는 네이버 증권 공개 API.

장부(더하기만 한다)
- data/stocks/universe.json          대상 종목(코스피·코스닥 시가총액 상위). 한 번 들어온 종목은 빠지지 않는다.
- data/stocks/price/<code>.csv       날짜, 종가, 거래량, 외국인 보유율(%) — 1990년부터, 원자료 그대로(액면분할 보정은 계산 단계에서)
- data/stocks/flow/<code>.csv        날짜, 외국인·기관·개인 순매수 수량 — 네이버가 최근 60거래일만 주므로 매일 쌓아 간다
- data/stocks/extra/<code>.json      재무(연간·분기), 투자지표, 최근 공시 제목 — 최신 스냅숏
"""
from __future__ import annotations

import csv
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch import http_get, num  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data" / "stocks"
TOP = {"KOSPI": 30, "KOSDAQ": 10}
API = "https://m.stock.naver.com/api"


def universe() -> list[dict]:
    p = D / "universe.json"
    cur = {s["code"]: s for s in (json.loads(p.read_text(encoding="utf-8")) if p.exists() else [])}
    for market, top in TOP.items():
        try:
            j = json.loads(http_get(f"{API}/stocks/marketValue/{market}?page=1&pageSize={top * 2}"))
        except Exception as e:  # noqa: BLE001
            print("시총 순위 실패", market, e, flush=True)
            continue
        n = 0
        for s in j.get("stocks", []):
            name, code = s.get("stockName", ""), s.get("itemCode", "")
            if s.get("stockEndType") != "stock" or not re.fullmatch(r"\d{6}", code):
                continue
            if re.search(r"(우|우B|우C)$|스팩|리츠", name):
                continue
            n += 1
            if n > top:
                break
            cur[code] = {"code": code, "name": name, "market": market, "rank": n,
                         "cap": int(s.get("marketValueRaw") or 0)}
    out = sorted(cur.values(), key=lambda s: -s.get("cap", 0))
    D.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def read_rows(p: Path) -> dict[str, list[str]]:
    if not p.exists():
        return {}
    with p.open(encoding="utf-8") as f:
        return {r[0]: r[1:] for r in csv.reader(f) if r and r[0] != "date"}


def write_rows(p: Path, header: list[str], rows: dict[str, list]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for d in sorted(rows):
            w.writerow([d, *rows[d]])


def update_price(code: str, today: str) -> int:
    p = D / "price" / f"{code}.csv"
    rows = read_rows(p)
    start = "19900101"
    if rows:
        start = (datetime.strptime(max(rows), "%Y-%m-%d") - timedelta(days=40)).strftime("%Y%m%d")
    text = http_get(f"https://api.finance.naver.com/siseJson.naver?symbol={code}&requestType=1&startTime={start}"
                    f"&endTime={today.replace('-', '')}&timeframe=day")
    added = 0
    for m in re.finditer(r'\[\s*"(\d{8})"\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]*)\s*\]', text):
        d = f"{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:]}"
        if d > today or float(m.group(2)) <= 0:
            continue
        new = [m.group(2), m.group(3), m.group(4)]
        if rows.get(d) != new:
            rows[d] = new
            added += 1
    if added:
        write_rows(p, ["date", "close", "volume", "frgn_ratio"], rows)
    return len(rows)


def update_flow(code: str) -> int:
    p = D / "flow" / f"{code}.csv"
    rows = read_rows(p)
    for it in json.loads(http_get(f"{API}/stock/{code}/trend?pageSize=60&page=1")):
        b = str(it.get("bizdate", ""))
        if not re.fullmatch(r"\d{8}", b):
            continue
        try:
            rows[f"{b[:4]}-{b[4:6]}-{b[6:]}"] = [int(num(it["foreignerPureBuyQuant"])), int(num(it["organPureBuyQuant"])), int(num(it["individualPureBuyQuant"]))]
        except (KeyError, ValueError):
            continue
    write_rows(p, ["date", "foreign", "inst", "indiv"], rows)
    return len(rows)


def update_extra(code: str) -> None:
    out = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    for key, path in (("annual", f"/stock/{code}/finance/annual"), ("quarter", f"/stock/{code}/finance/quarter"),
                      ("integration", f"/stock/{code}/integration"), ("disclosure", f"/stock/{code}/disclosure?pageSize=20&page=1")):
        try:
            j = json.loads(http_get(API + path))
            if key in ("annual", "quarter"):
                fi = j.get("financeInfo") or {}
                j = {"periods": fi.get("trTitleList"), "rows": [{"title": r.get("title"), "v": {k: (c or {}).get("value") for k, c in (r.get("columns") or {}).items()}} for r in fi.get("rowList") or []]}
            elif key == "integration":
                j = {"totalInfos": [{"code": t.get("code"), "key": t.get("key"), "value": t.get("value")} for t in j.get("totalInfos") or []],
                     "consensus": j.get("consensusInfo"), "industryCode": j.get("industryCode")}
            else:
                j = [{"id": d.get("disclosureId"), "title": d.get("title"), "date": str(d.get("datetime", ""))[:10]} for d in j]
            out[key] = j
        except Exception as e:  # noqa: BLE001
            out[key] = None
            print("  부가정보 실패", code, key, str(e)[:60], flush=True)
        time.sleep(0.15)
    p = D / "extra" / f"{code}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> int:
    today = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")   # 한국 날짜
    uni = universe()
    ok = bad = 0
    for s in uni:
        try:
            n = update_price(s["code"], today)
            time.sleep(0.15)
            f = update_flow(s["code"])
            update_extra(s["code"])
            ok += 1
            print(f"[OK] {s['code']} {s['name']} 시세 {n}일 · 수급 {f}일", flush=True)
        except Exception as e:  # noqa: BLE001
            bad += 1
            print(f"[실패] {s['code']} {s['name']} {str(e)[:80]}", flush=True)
        time.sleep(0.2)
    print(f"종목 수집: 성공 {ok}, 실패 {bad}", flush=True)
    return 0   # 종목 수집 실패는 시장체온계 갱신을 막지 않는다


if __name__ == "__main__":
    sys.exit(main())
