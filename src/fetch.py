"""시계열 수집기 — 표준 라이브러리만 사용.

원칙
- 저장소의 data/raw/<id>.csv 가 '원본 장부'다. 소스가 죽어도 장부는 남는다.
- 새로 받은 값은 장부에 '더하기'만 한다. 과거 값은 최근 10일치만 정정 반영한다.
- 한 시계열이 실패해도 나머지는 계속 간다. 실패 내역은 docs/data/status.json 에 남긴다.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
REVISE_DAYS = 10


def http_get(url: str, timeout: int = 40, tries: int = 3) -> str:
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001 — 어떤 실패든 재시도 후 상위에서 기록
            last = e
            time.sleep(2 + 3 * i)
    raise RuntimeError(f"GET 실패: {url} :: {last}")


# ---------- 소스별 파서 (입력 텍스트 -> {날짜: 값}) ----------

def parse_fred_csv(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    rows = csv.reader(io.StringIO(text))
    header = next(rows, None)
    if not header or len(header) < 2:
        raise ValueError("FRED 응답 형식이 다름")
    for row in rows:
        if len(row) < 2:
            continue
        d, v = row[0].strip(), row[1].strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) or v in ("", "."):
            continue
        try:
            out[d] = float(v)
        except ValueError:
            continue
    return out


def parse_yahoo_chart(text: str) -> dict[str, float]:
    j = json.loads(text)
    res = (j.get("chart") or {}).get("result") or []
    if not res:
        raise ValueError("Yahoo 응답에 result 없음")
    r = res[0]
    ts = r.get("timestamp") or []
    closes = ((r.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    off = int((r.get("meta") or {}).get("gmtoffset") or 0)
    out: dict[str, float] = {}
    for t, c in zip(ts, closes):
        if c is None:
            continue
        d = (datetime.fromtimestamp(t, tz=timezone.utc) + timedelta(seconds=off)).strftime("%Y-%m-%d")
        out[d] = float(c)
    return out


def parse_naver_index(text: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for m in re.finditer(r'\[\s*"(\d{8})"\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)', text):
        d = m.group(1)
        out[f"{d[:4]}-{d[4:6]}-{d[6:]}"] = float(m.group(5))
    if not out:
        raise ValueError("네이버 응답에 데이터 없음")
    return out


def fetch_source(src: dict) -> dict[str, float]:
    t, sym = src["type"], src["symbol"]
    if t == "fred":
        return parse_fred_csv(http_get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={urllib.parse.quote(sym)}"))
    if t == "yahoo":
        q = urllib.parse.quote(sym)
        return parse_yahoo_chart(http_get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{q}?period1=0&period2=9999999999&interval=1d&events=history"))
    if t == "naver_index":
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        return parse_naver_index(http_get(
            "https://api.finance.naver.com/siseJson.naver?symbol=" + urllib.parse.quote(sym)
            + f"&requestType=1&startTime=19900101&endTime={today}&timeframe=day"))
    raise ValueError(f"모르는 소스 종류: {t}")


# ---------- 장부 읽기/쓰기/병합 ----------

def read_store(sid: str) -> dict[str, float]:
    p = RAW / f"{sid}.csv"
    if not p.exists():
        return {}
    out = {}
    with p.open(encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) == 2 and row[0] != "date":
                out[row[0]] = float(row[1])
    return out


def write_store(sid: str, data: dict[str, float]) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    with (RAW / f"{sid}.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "value"])
        for d in sorted(data):
            w.writerow([d, repr(round(data[d], 6))])


def combine_sources(results: list[dict[str, float]]) -> dict[str, float]:
    """앞쪽 소스 우선. 뒤쪽 소스는 빠진 날짜만 채운다."""
    out: dict[str, float] = {}
    for res in reversed(results):
        out.update(res)
    return out


def sane(v: float) -> bool:
    return v == v and v not in (float("inf"), float("-inf"))


def merge_into_store(store: dict[str, float], fresh: dict[str, float], today: str, kind: str = "price") -> tuple[dict[str, float], int]:
    """장부에 새 값을 합친다. 반환: (새 장부, 추가·정정된 건수).

    - 미래 날짜, 0 이하 가격은 버린다.
    - 장부에 이미 있는 날짜는 최근 REVISE_DAYS일 안쪽만 덮어쓴다(소스 정정 반영).
    """
    out = dict(store)
    cutoff = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=REVISE_DAYS)).strftime("%Y-%m-%d")
    changed = 0
    for d, v in fresh.items():
        if d > today or not sane(v):
            continue
        if kind == "price" and v <= 0:
            continue
        if d in out:
            if d >= cutoff and abs(out[d] - v) > 1e-9:
                out[d] = v
                changed += 1
        else:
            out[d] = v
            changed += 1
    return out, changed


def update_series(spec: dict, today: str) -> dict:
    sid = spec["id"]
    store = read_store(sid)
    results, errors = [], []
    for src in spec["sources"]:
        try:
            got = fetch_source(src)
            if len(got) < 5:
                raise ValueError(f"데이터가 너무 적음({len(got)}건)")
            results.append(got)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{src['type']}:{src['symbol']} -> {e}")
            results.append({})
    fresh = combine_sources(results)
    merged, changed = merge_into_store(store, fresh, today, spec.get("kind", "price"))
    if changed:
        write_store(sid, merged)
    last = max(merged) if merged else None
    return {"id": sid, "rows": len(merged), "last": last, "changed": changed,
            "ok": bool(fresh), "errors": errors}


def main() -> int:
    cfg = json.loads((ROOT / "config" / "series.json").read_text(encoding="utf-8"))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report = []
    for spec in cfg["series"]:
        r = update_series(spec, today)
        report.append(r)
        print(f"[{'OK' if r['ok'] else '실패'}] {r['id']:8s} rows={r['rows']:6d} last={r['last']} +{r['changed']}"
              + (f"  ! {'; '.join(r['errors'])}" if r["errors"] else ""))
        time.sleep(1)
    out = ROOT / "docs" / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "status.json").write_text(json.dumps(
        {"checked": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "series": report},
        ensure_ascii=False, indent=1), encoding="utf-8")
    have = sum(1 for r in report if r["rows"] > 0)
    # 장부가 하나도 없으면 실패로 끝낸다(첫 실행에서 전부 막힌 경우를 알아채기 위함)
    return 0 if have >= 3 else 1


if __name__ == "__main__":
    sys.exit(main())
