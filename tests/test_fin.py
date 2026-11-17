import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from fetch_stocks import merge_fin


class MergeFin(unittest.TestCase):
    def test_keeps_old_periods_and_prefers_new(self):
        old = {"periods": [{"key": "202212", "isConsensus": "N"}, {"key": "202312", "isConsensus": "Y"}],
               "rows": [{"title": "매출액", "v": {"202212": "10", "202312": "12"}}]}
        new = {"periods": [{"key": "202312", "isConsensus": "N"}, {"key": "202412", "isConsensus": "Y"}],
               "rows": [{"title": "매출액", "v": {"202312": "11", "202412": "15"}}, {"title": "영업이익", "v": {"202412": "3"}}]}
        m = merge_fin(old, new)
        self.assertEqual([p["key"] for p in m["periods"]], ["202212", "202312", "202412"])
        self.assertEqual(m["periods"][1]["isConsensus"], "N")
        self.assertEqual(m["rows"][0]["v"], {"202212": "10", "202312": "11", "202412": "15"})
        self.assertEqual(m["rows"][1]["title"], "영업이익")

    def test_failure_keeps_old(self):
        old = {"periods": [{"key": "202212"}], "rows": []}
        self.assertIs(merge_fin(old, None), old)
        self.assertEqual(merge_fin(None, {"periods": [{"key": "1"}], "rows": []})["periods"][0]["key"], "1")


if __name__ == "__main__":
    unittest.main()
