"""핵심 계산 검증. 실행: python -m unittest discover -s tests"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import build  # noqa: E402
import fetch  # noqa: E402


class Percentile(unittest.TestCase):
    def test_uses_only_past(self):
        xs = [float(i) for i in range(10)]
        out = build.rolling_pct(xs, window=100, min_obs=3)
        self.assertEqual(out[:3], [None, None, None])
        self.assertEqual(out[3], 1.0)          # 과거 3개보다 모두 큼
        out2 = build.rolling_pct(xs[:5] + [-1.0], window=100, min_obs=3)
        self.assertEqual(out2[5], 0.0)         # 과거보다 모두 작음

    def test_ties_and_window(self):
        out = build.rolling_pct([1, 1, 1, 1], window=100, min_obs=3)
        self.assertEqual(out[3], 0.5)
        out = build.rolling_pct([100, 1, 2, 3, 50], window=3, min_obs=3)
        self.assertEqual(out[4], 1.0)          # 창 밖으로 나간 100과는 비교하지 않음

    def test_none_skipped(self):
        out = build.rolling_pct([None, 1, 2, None, 3, 4], window=10, min_obs=2)
        self.assertIsNone(out[0]); self.assertIsNone(out[3]); self.assertEqual(out[4], 1.0)


class Detectors(unittest.TestCase):
    def test_daily_move(self):
        self.assertEqual(build.det_daily_move([100, 96, 97, 101], -3), [1])
        self.assertEqual(build.det_daily_move([100, 96, 97, 101], 3), [3])

    def test_cross(self):
        self.assertEqual(build.det_cross([28, 31, 35, 29, 30], 30, True), [1, 4])
        self.assertEqual(build.det_cross([0.2, -0.1, 0.3], 0, False), [1])

    def test_extreme_and_streak(self):
        self.assertEqual(build.det_extreme([1, 2, 3, 2, 5], window=3, high=True), [4])
        self.assertEqual(build.det_streak([5, 4, 3, 2, 3, 2, 1, 0], 3), [3, 7])

    def test_drawdown_first_cross_only(self):
        v = [100] * 5 + [95, 89, 85, 92, 88]
        self.assertEqual(build.det_drawdown(v, 10, window=5), [6])

    def test_ma_cross(self):
        v = [10, 10, 10, 5, 5, 4, 20]
        self.assertEqual(build.det_ma_cross(v, ma=3, up=False), [3])
        self.assertEqual(build.det_ma_cross(v, ma=3, up=True), [6])

    def test_cooldown(self):
        self.assertEqual(build.cooldown([1, 3, 20, 25, 40], 10), [1, 20, 40])


class Forward(unittest.TestCase):
    def test_forward_and_incomplete(self):
        td = [f"2020-01-{d:02d}" for d in range(1, 11)]
        tv = [100 + i for i in range(10)]
        old = build.HORIZONS
        build.HORIZONS = [1, 5, 20]
        try:
            rows = build.forward_returns(["2020-01-03"], td, tv)
            self.assertEqual(rows, [["2020-01-03", round((103 / 102 - 1) * 100, 2), round((107 / 102 - 1) * 100, 2), None]])
            # 대상 시장이 쉬는 날이면 직전 종가를 기준가로 쓴다
            rows = build.forward_returns(["2020-01-03"], ["2020-01-02", "2020-01-06"], [50, 55])
            self.assertEqual(rows[0][1], 10.0)
        finally:
            build.HORIZONS = old

    def test_stats(self):
        s = build.stats([-2, 0, 2, 4])
        self.assertEqual((s["n"], s["mean"], s["median"], s["win"], s["min"], s["max"]), (4, 1.0, 1.0, 50.0, -2, 4))
        self.assertIsNone(build.stats([]))


class Align(unittest.TestCase):
    def test_ffill_with_gap_limit(self):
        out = build.align(["2020-01-01", "2020-01-02"], [1, 2], ["2020-01-01", "2020-01-05", "2020-01-20"], max_gap=10)
        self.assertEqual(out, [1, 2, None])


class Store(unittest.TestCase):
    def test_merge_append_and_revise_window(self):
        store = {"2020-01-01": 1.0, "2026-11-10": 5.0}
        fresh = {"2020-01-01": 9.0, "2026-11-10": 6.0, "2026-11-12": 7.0, "2099-01-01": 1.0, "2026-11-11": -3.0}
        out, changed = fetch.merge_into_store(store, fresh, "2026-11-13", "price")
        self.assertEqual(out["2020-01-01"], 1.0)      # 오래된 값은 덮어쓰지 않음
        self.assertEqual(out["2026-11-10"], 6.0)      # 최근 값은 정정 반영
        self.assertEqual(out["2026-11-12"], 7.0)
        self.assertNotIn("2099-01-01", out)           # 미래 날짜 거부
        self.assertNotIn("2026-11-11", out)           # 0 이하 가격 거부
        self.assertEqual(changed, 2)

    def test_combine_priority(self):
        self.assertEqual(fetch.combine_sources([{"a": 1.0}, {"a": 2.0, "b": 3.0}]), {"a": 1.0, "b": 3.0})

    def test_empty_fetch_keeps_store(self):
        out, changed = fetch.merge_into_store({"2020-01-01": 1.0}, {}, "2026-11-13")
        self.assertEqual((out, changed), ({"2020-01-01": 1.0}, 0))


class Parsers(unittest.TestCase):
    def test_naver_index(self):
        txt = '[["날짜","시가","고가","저가","종가","거래량"],\n["20261112", 4000.1, 4010, 3990, 4005.5, 1],\n["20261113", 4005, 4020, 4000, 4012.25, 2]]'
        self.assertEqual(fetch.parse_naver_index(txt), {"2026-11-12": 4005.5, "2026-11-13": 4012.25})

    def test_naver_rows(self):
        txt = json.dumps([{"localTradedAt": "2026-11-12T16:58:23-05:00", "closePrice": "7,592.40"},
                          {"localTradedAt": "2026-11-13", "closePrice": "1,337.50"}, {"localTradedAt": "", "closePrice": "1"}])
        self.assertEqual(fetch.parse_naver_rows(txt), {"2026-11-12": 7592.4, "2026-11-13": 1337.5})

    def test_cboe(self):
        self.assertEqual(fetch.parse_cboe_csv("DATE,OPEN,HIGH,LOW,CLOSE\n01/02/1990,17.24,17.3,17.1,17.2\n"), {"1990-01-02": 17.2})
        self.assertEqual(fetch.parse_cboe_csv("DATE,SPX\n11/12/2026,7592.400000\n"), {"2026-11-12": 7592.4})

    def test_dbnomics(self):
        txt = json.dumps({"series": {"docs": [{"period": ["2026-11-10", "2026-11-11", "2026-11-12"], "value": [4.98, "NA", 5.1]}]}})
        self.assertEqual(fetch.parse_dbnomics(txt), {"2026-11-10": 4.98, "2026-11-12": 5.1})

    def test_treasury(self):
        txt = 'Date,"1 Mo","2 Yr","10 Yr"\n11/12/2026,4.1,3.9,4.25\n11/10/2026,4.1,N/A,4.2\n'
        self.assertEqual(fetch.parse_treasury_csv(txt, "10 Yr"), {"2026-11-12": 4.25, "2026-11-10": 4.2})
        self.assertEqual(fetch.parse_treasury_csv(txt, "2 Yr"), {"2026-11-12": 3.9})

    def test_coinbase_drops_unfinished_day(self):
        txt = json.dumps([[1794528000, 1, 2, 3, 69389.42, 5], [1794441600, 1, 2, 3, 71369.9, 5]])
        self.assertEqual(fetch.parse_coinbase(txt, "2026-11-13"), {"2026-11-12": 71369.9})

    def test_paged_stops_at_known_history(self):
        pages = {1: {"2026-11-13": 1.0, "2026-11-12": 1.0}, 2: {"2026-10-01": 1.0}, 3: {"2026-09-01": 1.0}}
        calls = []
        old = fetch.http_get
        fetch.http_get = lambda u: (calls.append(u), u)[1]
        try:
            out = fetch.paged(lambda p: p, lambda p: pages.get(p, {}), "2026-11-12")
        finally:
            fetch.http_get = old
        self.assertEqual(calls, [1, 2])                # 이미 가진 구간에 닿으면 3쪽은 받지 않는다
        self.assertEqual(len(out), 3)


if __name__ == "__main__":
    unittest.main()
