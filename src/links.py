"""발행된 통계 글 주소 찾기 — 블로거 공개 피드에서 제목이 같은 글의 주소를 찾아 docs/data/links.json 에 적는다.

글을 블로거에서 발행하기만 하면 다음 자동 갱신 때 연구소 페이지와 홈 위젯이 그 글로 연결된다. 손으로 주소를 옮길 필요가 없다.
피드를 못 읽으면 기존 links.json 을 그대로 둔다.
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG_ID = "117098118623371434"
OUT = ROOT / "docs" / "data" / "links.json"


def published() -> dict[str, str]:
    found: dict[str, str] = {}
    start = 1
    while start < 2000:
        url = f"https://www.blogger.com/feeds/{BLOG_ID}/posts/default?alt=json&max-results=150&start-index={start}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            feed = json.loads(r.read().decode("utf-8")).get("feed", {})
        entries = feed.get("entry") or []
        for e in entries:
            title = (e.get("title") or {}).get("$t", "")
            href = next((l.get("href") for l in e.get("link", []) if l.get("rel") == "alternate"), None)
            if title and href:
                found[title] = href
        if len(entries) < 150:
            break
        start += 150
    return found


def main() -> int:
    index = []
    for name in ("index.json", "index_signals.json"):
        p = ROOT / "blogger" / "posts" / name
        if p.exists():
            index += json.loads(p.read_text(encoding="utf-8"))
    try:
        pub = published()
    except Exception as e:  # noqa: BLE001
        print("피드를 읽지 못해 links.json 을 그대로 둡니다:", e)
        return 0
    links = {}
    for p in index:
        href = pub.get(p["title"])
        if href:
            # 같은 블로그 안에서 쓰므로 경로만 남긴다(도메인이 바뀌어도 그대로 동작)
            links[p["id"]] = "/" + href.split("/", 3)[3] if href.count("/") >= 3 else href
    OUT.write_text(json.dumps(links, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"발행된 통계 글 {len(links)}편 연결 (피드 글 {len(pub)}편)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
