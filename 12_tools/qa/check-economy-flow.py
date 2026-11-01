#!/usr/bin/env python3
"""크래커 경제 흐름 검사 (실제 브라우저에서 화면 흐름을 돌려 확인).

사용: python3 12_tools/qa/check-economy-flow.py
전제: dist를 http.server로 띄운 상태 (기본 http://localhost:8765). 실패하면 exit 1.

검사 항목
  1. 약자멸시에서 기권 → 패배(−200)만 차감, 전달분 이중 차감 없음
  2. 일반 수호신에서 기권 → 선불(−100) + 패배(−200)
  3. 약자멸시를 끝내지 않고 새로고침 → 다음 접속에서 패배(−200)
  4. 약자멸시를 정상 종료(승리/패배) 후 새로고침 → 추가 차감 없음
  5. 개발 환경이 아닌 주소에서는 ?crackers / ?guardian이 무시됨
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765"
fails = []


def check(name, actual, expected):
    ok = actual == expected
    print(("OK   " if ok else "FAIL ") + name + f": {actual}" + ("" if ok else f" (기대 {expected})"))
    if not ok:
        fails.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch()

    def new_page(start=1000):
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        pg.goto(f"{BASE}/index.html?skipIntro&crackers={start}")
        pg.wait_for_timeout(900)
        pg.goto(f"{BASE}/index.html?skipIntro")  # 옵션이 지워진 상태로 다시 열어 저장값을 확인
        pg.wait_for_timeout(900)
        return pg

    def crackers(pg):
        return pg.evaluate("collectionState.crackers")

    def surrender(pg):
        pg.evaluate("const b=document.querySelector('#surrender-action');surrenderBattle(b);surrenderBattle(b)")
        pg.wait_for_timeout(3500)

    # 1. 약자멸시 기권
    pg = new_page()
    pg.evaluate("pickGuardian('none')")
    pg.wait_for_timeout(300)
    surrender(pg)
    check("약자멸시 기권 = 패배 200만 차감", crackers(pg), 800)

    # 2. 일반 수호신 기권
    pg = new_page()
    pg.evaluate("pickGuardian('baekho')")
    pg.wait_for_timeout(300)
    check("수호신 선불 100", crackers(pg), 900)
    surrender(pg)
    check("수호신 기권 = 패배 200", crackers(pg), 700)

    # 3. 약자멸시 이탈 (새로고침)
    pg = new_page()
    pg.evaluate("pickGuardian('none')")
    pg.wait_for_timeout(300)
    check("약자멸시 선택 직후 선불 없음", crackers(pg), 1000)
    pg.goto(f"{BASE}/index.html?skipIntro")
    pg.wait_for_timeout(900)
    check("약자멸시 이탈 = 다음 접속에서 패배 200", crackers(pg), 800)

    # 4. 정상 종료 후에는 이탈 처리 없음
    pg = new_page()
    pg.evaluate("pickGuardian('none')")
    pg.wait_for_timeout(300)
    pg.evaluate("finish(false,'테스트 패배')")
    pg.wait_for_timeout(3500)
    check("약자멸시 패배 200 차감", crackers(pg), 800)
    pg.goto(f"{BASE}/index.html?skipIntro")
    pg.wait_for_timeout(900)
    check("정상 종료 후 새로고침은 추가 차감 없음", crackers(pg), 800)

    # 5. 개발 환경이 아닌 주소에서는 URL 옵션 무시 (fate.test를 로컬 서버로 대신 연결)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.route("http://fate.test/**", lambda route: route.fulfill(
        response=route.fetch(url=route.request.url.replace("http://fate.test", BASE))))
    pg = ctx.new_page()
    pg.goto("http://fate.test/index.html?skipIntro&crackers=999999&guardian=baekho")
    pg.wait_for_timeout(1200)
    state = pg.evaluate("({hostname:location.hostname,crackers:collectionState.crackers,guardian:playerGuardian,chosen:guardianChosen})")
    check("배포 주소에서 ?crackers 무시", state["crackers"], 300)
    check("배포 주소에서 ?guardian 무시 (선택 화면이 열림)", (state["guardian"], state["chosen"]), (None, False))

    browser.close()

if fails:
    print(f"\nFAIL: {len(fails)}건 — {', '.join(fails)}")
    sys.exit(1)
print("\nOK: 경제 흐름 이상 없음")
