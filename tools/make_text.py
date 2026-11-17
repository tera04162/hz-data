#!/usr/bin/env python3
"""블로그 원고(blogger/**/*.html)에서 자동 갱신 구간을 뽑아 docs/data/text/<id>.json 으로 낸다.

블로그에 올라간 글은 한 번 붙여 넣으면 그대로 굳는다. 날짜와 숫자가 낡지 않도록, 원고에서
<div data-ar="text" data-id="..."> ... </div><!--/ar-text--> 로 감싼 구간을 매일 다시 만들어 저장소에 두고,
위젯이 글을 열 때 그 구간을 최신 문장으로 바꿔 끼운다. 불러오지 못하면 붙여 넣은 원문이 그대로 보인다.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "data" / "text"
PAT = re.compile(r'<div data-ar="text" data-id="([a-z0-9_]+)">(.*?)</div><!--/ar-text-->', re.S)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted((ROOT / "blogger").rglob("*.html")):
        for tid, body in PAT.findall(f.read_text(encoding="utf-8")):
            (OUT / f"{tid}.json").write_text(json.dumps({"html": body.strip()}, ensure_ascii=False), encoding="utf-8")
            n += 1
    print(n, "구간 저장")


if __name__ == "__main__":
    main()
