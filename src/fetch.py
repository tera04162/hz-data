"""시계열 수집기 — 표준 라이브러리만 사용.

원칙
- 저장소의 data/raw/<id>.csv 가 '원본 장부'다. 소스가 죽어도 장부는 남는다.
- 새로 받은 값은 장부에 '더하기'만 한다. 과거 값은 최근 10일치만 정정 반영한다.
- 한 시계열이 실패해도 나머지는 계속 간다. 결과는 docs/data/status.json 에 남긴다.
- 한 시계열의 소스들은 반드시 '같은 상품의 같은 종가'여야 한다(정의가 다른 값을 섞으면 이음매에서 가짜 급등락이 생긴다).

소스 선정 근거(2026-11, 깃허브 실행기에서 직접 점검)
- 열림: 네이버 금융, CBOE 공식 CSV, DBnomics(연준 H.15 미러), 미 재무부, 코인베이스
- 막힘: Yahoo Finance(429), FRED 그래프 CSV(연결 끊김), Stooq(브라우저 검증 요구)
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

HOST_FAILS: dict[str, int] = {}   # 호스트별 연속 실패 횟수 — 막힌 호스트에 시간을 다 쓰지 않기 위한 차단기
HOST_LIMIT = 2
DEADLINE = 60                     # 응답 하나를 다 받는 데 허용하는 최대 시간(초)


def http_get(url: str, timeout: int = 20, tries: int = 2) -> str:
    host = urllib.parse.urlsplit(url).netloc
    if HOST_FAILS.get(host, 0) >= HOST_LIMIT:
        raise RuntimeError(f"{host} 이번 실행에서 건너뜀(연속 실패)")
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            t0 = time.time()
            chunks = []
            with urllib.request.urlopen(req, timeout=timeout) as r:
                while True:
                    b = r.read(1 << 16)
                    if not b:
                        break
                    chunks.append(b)
                    if time.time() - t0 > DEADLINE:
                        raise TimeoutError("응답이 너무 느림")
            HOST_FAILS[host] = 0
            return b"".join(chunks).decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001 — 어떤 실패든 재시도 후 상위에서 기록
            last = e
            time.sleep(2)
    HOST_FAILS[host] = HOST_FAILS.get(host, 0) + 1
    raise RuntimeError(f"GET 실패: {host} :: {last}")


# ---------- 소스별 파서 (입력 텍스트 -> {날짜: 값}) ----------

def num(x) -> float:
    return float(str(x).replace(",", ""))


def parse_naver_index(text: str) -> dict[str, float]:
    """네이버 국내 지수 일별 시세(siseJson)."""
    out: dict[str, float] = {}
    for m in re.finditer(r'\[\s*"(\d{8})"\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)', text):
        d = m.group(1)
        out[f"{d[:4]}-{d[4:6]}-{d[6:]}"] = float(m.group(5))
    if not out:
        raise ValueError("네이버 응답에 데이터 없음")
    return out


def parse_naver_rows(text: str) -> dict[str, float]:
    """네이버 증권 API의 일별 목록(해외지수·환율·원자재 공통): localTradedAt + closePrice."""
    out: dict[str, float] = {}
    for it in json.loads(text):
        d, c = str(it.get("localTradedAt", ""))[:10], it.get("closePrice")
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) and c not in (None, ""):
            out[d] = num(c)
    return out


def _mdy(s: str) -> str | None:
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s.strip())
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else None


def parse_cboe_csv(text: str) -> dict[str, float]:
    """CBOE 공식 지수 이력 CSV. 날짜는 MM/DD/YYYY, 종가는 CLOSE 열(없으면 마지막 열)."""
    rows = csv.reader(io.StringIO(text))
    header = [h.strip().upper() for h in next(rows, [])]
    if not header or header[0] != "DATE":
        raise ValueError("CBOE 응답 형식이 다름")
    ci = header.index("CLOSE") if "CLOSE" in header else len(header) - 1
    out: dict[str, float] = {}
    for row in rows:
        d = _mdy(row[0]) if len(row) > ci else None
        if not d:
            continue
        try:
            out[d] = float(row[ci])
        except ValueError:
            continue
    return out


def parse_dbnomics(text: str) -> dict[str, float]:
    """DBnomics 시계열(연준 H.15 원자료 미러). period[]와 value[]가 나란히 온다. 결측은 'NA'."""
    docs = (json.loads(text).get("series") or {}).get("docs") or []
    if not docs:
        raise ValueError("DBnomics 응답에 시계열 없음")
    out: dict[str, float] = {}
    for d, v in zip(docs[0].get("period") or [], docs[0].get("value") or []):
        if isinstance(v, (int, float)) and not isinstance(v, bool) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(d)):
            out[d] = float(v)
    return out


def parse_treasury_csv(text: str, column: str) -> dict[str, float]:
    """미 재무부 일별 국채 수익률 곡선(연준 H.15 국채 금리의 원자료). column 예: '10 Yr'."""
    rows = csv.reader(io.StringIO(text))
    header = [h.strip() for h in next(rows, [])]
    if column not in header or "Date" not in header:
        raise ValueError(f"재무부 응답에 '{column}' 열 없음")
    ci, di = header.index(column), header.index("Date")
    out: dict[str, float] = {}
    for row in rows:
        if len(row) <= max(ci, di):
            continue
        d, v = _mdy(row[di]), row[ci].strip()
        if not d or v in ("", "N/A"):
            continue
        try:
            out[d] = float(v)
        except ValueError:
            continue
    return out


def parse_coinbase(text: str, today: str) -> dict[str, float]:
    """코인베이스 일봉 [시각, 저, 고, 시, 종, 거래량]. 아직 끝나지 않은 오늘(UTC) 봉은 버린다."""
    out: dict[str, float] = {}
    for c in json.loads(text):
        d = datetime.fromtimestamp(int(c[0]), tz=timezone.utc).strftime("%Y-%m-%d")
        if d < today:
            out[d] = float(c[4])
    return out


def paged(url_of, parse, known_last: str | None, max_pages: int = 130) -> dict[str, float]:
    """쪽 단위 목록을 최신부터 과거로 받는다. 장부에 이미 있는 구간(정정 창 포함)에 닿으면 멈춘다."""
    out: dict[str, float] = {}
    stop = None
    if known_last:
        stop = (datetime.strptime(known_last, "%Y-%m-%d") - timedelta(days=REVISE_DAYS + 5)).strftime("%Y-%m-%d")
    for page in range(1, max_pages + 1):
        got = parse(http_get(url_of(page)))
        if not got:
            break
        fresh = [d for d in got if d not in out]
        out.update(got)
        if not fresh or (stop and min(got) <= stop):
            break
        time.sleep(0.25)
    return out


def fetch_source(src: dict, known_last: str | None = None) -> dict[str, float]:
    t, sym = src["type"], src["symbol"]
    q = urllib.parse.quote(sym, safe="")
    now = datetime.now(timezone.utc)
    if t == "naver_index":
        return parse_naver_index(http_get(
            f"https://api.finance.naver.com/siseJson.naver?symbol={q}&requestType=1&startTime=19900101"
            f"&endTime={now.strftime('%Y%m%d')}&timeframe=day"))
    if t == "naver_world":
        return paged(lambda p: f"https://api.stock.naver.com/index/{q}/price?page={p}&pageSize=60", parse_naver_rows, known_last)
    if t == "naver_mi":   # symbol 예: exchange/FX_USDKRW, energy/CLcv1, metals/GCcv1
        return paged(lambda p: f"https://api.stock.naver.com/marketindex/{sym}/prices?page={p}&pageSize=60", parse_naver_rows, known_last)
    if t == "cboe":
        return parse_cboe_csv(http_get(f"https://cdn.cboe.com/api/global/us_indices/daily_prices/{q}_History.csv"))
    if t == "dbnomics":
        return parse_dbnomics(http_get(f"https://api.db.nomics.world/v22/series/{sym}?observations=1"))
    if t == "treasury":   # 올해분만 — 최신 구간 보강용
        y = now.year
        return parse_treasury_csv(http_get(
            "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/"
            f"{y}/all?type=daily_treasury_yield_curve&field_tdr_date_value={y}&page&_format=csv"), sym)
    if t == "coinbase":
        today = now.strftime("%Y-%m-%d")
        out: dict[str, float] = {}
        end = now
        stop = None
        if known_last:
            stop = datetime.strptime(known_last, "%Y-%m-%d").replace(tzinfo=timezone.utc) - timedelta(days=REVISE_DAYS + 5)
        for _ in range(20):
            start = end - timedelta(days=299)
            got = parse_coinbase(http_get(
                f"https://api.exchange.coinbase.com/products/{q}/candles?granularity=86400"
                f"&start={start.strftime('%Y-%m-%dT00:00:00Z')}&end={end.strftime('%Y-%m-%dT00:00:00Z')}"), today)
            if not got:
                break
            out.update(got)
            end = start
            if stop and end < stop:
                break
            time.sleep(0.3)
        return out
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
            got = fetch_source(src, max(store) if store else None)
            if len(got) < 3:
                raise ValueError(f"데이터가 너무 적음({len(got)}건)")
            results.append(got)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{src['type']}:{src['symbol']} -> {e}")
            results.append({})
    fresh = combine_sources(results)
    merged, changed = merge_into_store(store, fresh, today, spec.get("kind", "price"))
    if changed:
        write_store(sid, merged)
    return {"id": sid, "rows": len(merged), "first": min(merged) if merged else None,
            "last": max(merged) if merged else None, "changed": changed, "ok": bool(fresh), "errors": errors}


def main() -> int:
    cfg = json.loads((ROOT / "config" / "series.json").read_text(encoding="utf-8"))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report = []
    for spec in cfg["series"]:
        t0 = time.time()
        r = update_series(spec, today)
        report.append(r)
        print(f"({time.time() - t0:5.1f}s) [{'OK' if r['ok'] else '실패'}] {r['id']:8s} rows={r['rows']:6d} "
              f"{r['first']}~{r['last']} +{r['changed']}" + (f"  ! {'; '.join(r['errors'])}" if r["errors"] else ""), flush=True)
        time.sleep(0.5)
    out = ROOT / "docs" / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "status.json").write_text(json.dumps(
        {"checked": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "series": report},
        ensure_ascii=False, indent=1), encoding="utf-8")
    failed = [r["id"] for r in report if not r["ok"]]
    if failed:
        print("수집 실패:", ", ".join(failed), flush=True)
    # 절반 넘게 실패하면 작업을 실패로 끝내 깃허브가 메일로 알리게 한다. 일부만 실패하면 있는 장부로 계속 간다.
    return 1 if len(failed) > len(report) / 2 else 0


if __name__ == "__main__":
    sys.exit(main())
