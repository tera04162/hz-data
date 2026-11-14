"""기술적 신호 검증 — 널리 쓰이는 매매 신호가 실제로 통했는지 대상 종목 전체의 과거로 센다. 표준 라이브러리만 사용.

검증 방법(바꾸면 블로그 설명문도 같이 고칠 것)
- 신호는 '처음 켜진 날'만 센다. 같은 종목에서 같은 신호가 20거래일 안에 다시 켜지면 세지 않는다(표본 겹침을 줄이기 위함).
- 성적은 종목 수익률에서 같은 기간 코스피 수익률을 뺀 '시장 대비 초과수익'으로 본다. 시장이 올라서 오른 것을 신호의 공으로 돌리지 않기 위함이다.
- 비교 기준은 같은 종목들의 '아무 날' 초과수익이다. 대상이 지금의 대형주라 기준 자체가 0보다 높게 나온다(생존 편향). 그래서 신호와 기준의 차이만 본다.
- 판정: 사례 200건 이상이고, 20거래일 뒤 시장을 이긴 비율이 기준과 5%포인트 넘게 벌어지며 중앙값 차이도 같은 방향으로 0.5%포인트 이상일 때만 차이로 인정.
"""
from __future__ import annotations

HZ = [5, 20, 60]
COOLDOWN = 20


def sma(v, n):
    out, s = [None] * len(v), 0.0
    for i, x in enumerate(v):
        s += x
        if i >= n:
            s -= v[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def rsi(v, n=14):
    out = [None] * len(v)
    if len(v) <= n:
        return out
    g = l = 0.0
    for i in range(1, n + 1):
        d = v[i] - v[i - 1]
        g += max(d, 0); l += max(-d, 0)
    g /= n; l /= n
    out[n] = 100 if l == 0 else 100 - 100 / (1 + g / l)
    for i in range(n + 1, len(v)):
        d = v[i] - v[i - 1]
        g = (g * (n - 1) + max(d, 0)) / n
        l = (l * (n - 1) + max(-d, 0)) / n
        out[i] = 100 if l == 0 else 100 - 100 / (1 + g / l)
    return out


def detect(close, volume, ratio):
    """신호별로 '켜진 날'의 인덱스 목록을 돌려준다(쿨다운 적용 전)."""
    n = len(close)
    m20, m50, m200, r = sma(close, 20), sma(close, 50), sma(close, 200), rsi(close)
    v20 = sma(volume, 20)
    sd20 = [None] * n
    for i in range(19, n):
        w = close[i - 19:i + 1]
        mu = m20[i]
        sd20[i] = (sum((x - mu) ** 2 for x in w) / 20) ** 0.5
    out = {k: [] for k in ("golden", "dead", "rsi30", "rsi70", "high52", "low52", "gap20", "bb_low", "vol3", "drop5", "frgn10")}
    up_streak = 0
    for i in range(1, n):
        if m50[i] is not None and m200[i] is not None and m50[i - 1] is not None and m200[i - 1] is not None:
            if m50[i - 1] <= m200[i - 1] and m50[i] > m200[i]:
                out["golden"].append(i)
            if m50[i - 1] >= m200[i - 1] and m50[i] < m200[i]:
                out["dead"].append(i)
        if r[i] is not None and r[i - 1] is not None:
            if r[i - 1] >= 30 > r[i]:
                out["rsi30"].append(i)
            if r[i - 1] <= 70 < r[i]:
                out["rsi70"].append(i)
        if i >= 250:
            w = close[i - 250:i]
            if close[i] > max(w):
                out["high52"].append(i)
            if close[i] < min(w):
                out["low52"].append(i)
        if m20[i] is not None and m20[i - 1] is not None and m20[i] > 0 and m20[i - 1] > 0:
            if close[i] / m20[i] - 1 <= -0.10 < close[i - 1] / m20[i - 1] - 1:
                out["gap20"].append(i)
        if sd20[i] is not None and sd20[i - 1] is not None:
            if close[i] < m20[i] - 2 * sd20[i] and close[i - 1] >= m20[i - 1] - 2 * sd20[i - 1]:
                out["bb_low"].append(i)
        if v20[i - 1] and volume[i] >= 3 * v20[i - 1] and close[i] > close[i - 1]:
            out["vol3"].append(i)
        if close[i - 1] > 0 and close[i] / close[i - 1] - 1 <= -0.05:
            out["drop5"].append(i)
        if ratio[i] is not None and ratio[i - 1] is not None and ratio[i] > ratio[i - 1]:
            up_streak += 1
            if up_streak == 10:
                out["frgn10"].append(i)
        elif ratio[i] is not None and ratio[i - 1] is not None:
            up_streak = 0
    return out


def cool(idx, gap=COOLDOWN):
    out = []
    for i in idx:
        if not out or i - out[-1] > gap:
            out.append(i)
    return out


META = [
    ("golden", "골든크로스", "50일 이동평균선이 200일선을 아래에서 위로 뚫은 날"),
    ("dead", "데드크로스", "50일 이동평균선이 200일선을 위에서 아래로 뚫은 날"),
    ("rsi30", "RSI 30 이하 진입", "14일 RSI가 30 아래로 내려간 날(과매도)"),
    ("rsi70", "RSI 70 이상 진입", "14일 RSI가 70 위로 올라선 날(과매수)"),
    ("high52", "52주 신고가", "최근 250거래일 최고 종가를 새로 쓴 날"),
    ("low52", "52주 신저가", "최근 250거래일 최저 종가를 새로 쓴 날"),
    ("gap20", "20일선 이격도 -10%", "종가가 20일 이동평균보다 10% 넘게 낮아진 날"),
    ("bb_low", "볼린저밴드 하단 이탈", "종가가 20일 볼린저밴드(2표준편차) 하단 아래로 내려간 날"),
    ("vol3", "거래량 3배 급증 상승", "거래량이 20일 평균의 3배를 넘으면서 오른 날"),
    ("drop5", "하루 5% 이상 급락", "종가가 전일보다 5% 이상 떨어진 날"),
    ("frgn10", "외국인 10일 연속 순매수", "외국인 보유율이 10거래일 연속 늘어난 날"),
]


def judge(st, base):
    if not st or not base or st["n"] < 200:
        return "판정 보류"
    dw, dm = st["win"] - base["win"], st["median"] - base["median"]
    if dw >= 5 and dm >= 0.5:
        return "시장을 더 자주 이김"
    if dw <= -5 and dm <= -0.5:
        return "시장에 더 자주 짐"
    return "뚜렷한 차이 없음"
