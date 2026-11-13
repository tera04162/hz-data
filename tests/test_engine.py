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
    def test_fred(self):
        txt = "observation_date,DGS10\n2026-11-10,4.21\n2026-11-11,.\n2026-11-12,\n2026-11-13,4.3\n"
        self.assertEqual(fetch.parse_fred_csv(txt), {"2026-11-10": 4.21, "2026-11-13": 4.3})

    def test_yahoo(self):
        txt = json.dumps({"chart": {"result": [{"meta": {"gmtoffset": 32400}, "timestamp": [1763078400, 1763164800],
                                                  "indicators": {"quote": [{"close": [4000.5, None]}]}}]}})
        out = fetch.parse_yahoo_chart(txt)
        self.assertEqual(list(out.values()), [4000.5])
        self.assertRegex(list(out)[0], r"^2025-11-1\d$")

    def test_naver(self):
        txt = '[["날짜","시가","고가","저가","종가","거래량"],\n["20261112", 4000.1, 4010, 3990, 4005.5, 1],\n["20261113", 4005, 4020, 4000, 4012.25, 2]]'
        self.assertEqual(fetch.parse_naver_index(txt), {"2026-11-12": 4005.5, "2026-11-13": 4012.25})


if __name__ == "__main__":
    unittest.main()
