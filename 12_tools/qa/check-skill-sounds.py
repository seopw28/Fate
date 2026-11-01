#!/usr/bin/env python3
"""스킬별 소리 구성 검사: "스킬 고유 소리만 나는가"를 실제 브라우저에서 확인한다.

사용: python3 -I 12_tools/qa/check-skill-sounds.py
전제: dist를 http.server로 띄운 상태 (기본 http://localhost:8765). 실패하면 exit 1.

규칙
  - 아주르 썬더폴(내 물 속성 공격의 번개 연출): 번개 소리만. 물 피격음·일반 공격음·휘두르는 소리가 섞이면 안 된다.
  - 빙결 계열(프로스트 노바·빙결 사슬): 빙결(얼음) 소리만. 번개·물 피격음·일반 마법 시전음이 섞이면 안 된다.
  - 바람 연출(실피드 템페스트): 칼바람이 \"슈류륙\" 3연속으로 지나가는 소리(playGust)만 난다.
  - 그 외 공격(불 공격, 상대의 물 공격)은 평소 소리가 그대로 나야 하고, 스킬이 끝나면 음소거가 풀려야 한다.

감시 대상: 소리 엔진(playHit/playFrost/playLightning/playSwing)과 기존 합성음 경로(tone/noise/playAudio).
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765"
fails = []

SETUP = """() => {
  window.__log = [];
  if (!window.__spied) { // 감시 함수는 한 번만 감싼다 (여러 번 감싸면 호출이 중복으로 집계된다)
    window.__spied = true;
    const wrap = (obj, name) => { const orig = obj[name]; obj[name] = function (...a) { window.__log.push(name + (typeof a[0] === 'string' ? ':' + a[0] : '')); return orig.apply(this, a); }; };
    ['playHit', 'playFrost', 'playLightning', 'playGust', 'playSwing'].forEach((n) => wrap(fateSfx, n));
    const legacy = (name, fn) => { const orig = fn; return function (...a) { window.__log.push('legacy:' + name); return orig.apply(this, a); }; };
    tone = legacy('tone', tone); noise = legacy('noise', noise); playAudio = legacy('playAudio', playAudio);
  }
  const art = 'assets/characters/collected/sdaca-marie.webp';
  window.__art = art;
  const lane = document.querySelector('.arena .lane:first-child');
  lane.querySelectorAll(':scope > .unit').forEach((u) => u.remove());
  document.querySelector('.summon-zone').querySelectorAll(':scope > .unit').forEach((u) => u.remove());
  for (let i = 0; i < 2; i++) enemySummonUnit(lane, { el: 'fire', art, name: '적' + i, cost: 1, atk: 2, atkFinal: 2, hp: 30, effect: '' });
  for (const el of ['water', 'fire']) document.querySelector('.summon-zone').appendChild(createOpeningFieldUnit({ el, art, name: '아군' + el, cost: 1, atk: 4, atkFinal: 4, hp: 9, effect: '' }, false));
  mana = 10; maxMana = 10; updateMana(); battlePhase = 'setup';
}"""


def counts(pg):
    log = pg.evaluate("window.__log")
    c = {}
    for item in log:
        c[item] = c.get(item, 0) + 1
    return c


def check(name, cond, detail):
    print(("OK   " if cond else "FAIL ") + name + "  " + str(detail))
    if not cond:
        fails.append(name)


def reset(pg):
    pg.evaluate("window.__log = []")


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    pg = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    override = os.environ.get("INDEX_OVERRIDE")  # 이전 버전의 index.html 로 검사가 실제로 문제를 잡아내는지 확인할 때 쓴다
    if override:
        body = open(override, encoding="utf-8").read()
        pg.route("**/index.html*", lambda route: route.fulfill(body=body, content_type="text/html; charset=utf-8"))
    pg.goto(f"{BASE}/index.html?skipIntro&guardian=baekho")
    pg.wait_for_timeout(700)
    pg.mouse.click(700, 400)
    pg.wait_for_timeout(2500)  # 샘플 로딩
    pg.evaluate(SETUP)
    pg.wait_for_timeout(200)

    # 1. 아주르 썬더폴: 내 물 챔프가 상대 챔프를 공격
    reset(pg)
    pg.evaluate("""() => { const w = document.querySelector('.summon-zone .unit.water'), e = document.querySelector('.arena .lane:first-child > .unit'); w.classList.remove('exhausted'); resolveDuel(w, e, { playerAttack: true }); }""")
    pg.wait_for_timeout(1700)
    c = counts(pg)
    check("썬더폴: 번개 소리가 난다", c.get("playLightning:", 0) + c.get("playLightning", 0) == 1, c)
    check("썬더폴: 물 피격음이 나지 않는다", c.get("playHit:water", 0) == 0, c.get("playHit:water", 0))
    check("썬더폴: 휘두르는 소리·기존 합성음이 섞이지 않는다", sum(v for k, v in c.items() if k.startswith("playSwing")) == 0 and not any(k.startswith("legacy:") for k in c), c)

    # 2. 같은 물 챔프의 연속 공격에서도 마찬가지, 그리고 시간이 지나면 음소거가 풀린다
    pg.wait_for_timeout(1500)
    reset(pg)
    pg.evaluate("impact(document.querySelector('.arena .lane:first-child > .unit'), 5, 'water')")
    pg.wait_for_timeout(300)
    c = counts(pg)
    check("썬더폴 뒤 1.2초가 지나면 물 피격음이 다시 난다 (음소거 해제)", c.get("playHit:water", 0) == 1, c)

    # 3. 불 속성 공격: 평소 소리 그대로
    reset(pg)
    pg.evaluate("""() => { const f = document.querySelector('.summon-zone .unit.fire'), e = document.querySelector('.arena .lane:first-child > .unit'); f.classList.remove('exhausted'); resolveDuel(f, e, { playerAttack: true }); }""")
    pg.wait_for_timeout(1700)
    c = counts(pg)
    check("불 공격: 불 피격음과 휘두르는 소리가 평소처럼 난다", c.get("playHit:fire", 0) == 1 and sum(v for k, v in c.items() if k.startswith("playSwing")) == 1, c)
    check("불 공격: 번개는 나지 않는다", c.get("playLightning", 0) == 0, c)

    # 4. 상대의 물 공격: 번개 연출이 없으니 평소 소리
    pg.wait_for_timeout(1300)
    reset(pg)
    pg.evaluate("""() => { const lane = document.querySelector('.arena .lane:first-child'); enemySummonUnit(lane, { el: 'water', art: window.__art, name: '적물', cost: 1, atk: 2, atkFinal: 2, hp: 30, effect: '' });
      const e = [...lane.querySelectorAll(':scope > .unit')].pop(), t = document.querySelector('.summon-zone .unit.fire'); resolveDuel(e, t, { playerAttack: false }); }""")
    pg.wait_for_timeout(1500)
    c = counts(pg)
    check("상대 물 공격: 평소 물 피격음이 난다 (번개 없음)", c.get("playHit:water", 0) == 1 and c.get("playLightning", 0) == 0, c)

    # 5. 빙결 사슬 / 프로스트 노바: 빙결 소리만
    for label, card_id in (("빙결 사슬", "core.frozen-chain"), ("프로스트 노바", "tower.frost-nova")):
        pg.wait_for_timeout(2000)
        pg.evaluate(SETUP)
        pg.wait_for_timeout(200)
        reset(pg)
        pg.evaluate(f"""() => {{ const card = createRuntimeBattleCard('{card_id}'); castSpell(card); }}""")
        pg.wait_for_timeout(2200)
        c = counts(pg)
        check(f"{label}: 빙결(얼음) 소리가 난다", c.get("playFrost:cast", 0) == 1 and c.get("playFrost:shatter", 0) == 1, {k: v for k, v in c.items() if "Frost" in k})
        check(f"{label}: 물 피격음이 나지 않는다", c.get("playHit:water", 0) == 0, c.get("playHit:water", 0))
        check(f"{label}: 번개 소리가 나지 않는다", c.get("playLightning", 0) == 0, c.get("playLightning", 0))
        check(f"{label}: 일반 마법 시전음(기존 합성음)이 섞이지 않는다", not any(k.startswith("legacy:") for k in c), c)

    # 6. 실피드 템페스트(바람 연출): 칼바람 3연속 소리 1세트, 기존 일반 공격음은 섞이지 않는다
    pg.wait_for_timeout(1500)
    reset(pg)
    pg.evaluate("registerChain('wind')")
    pg.wait_for_timeout(300)
    c = counts(pg)
    check("실피드 템페스트: 칼바람 소리가 난다", c.get("playGust", 0) == 1, c)
    check("실피드 템페스트: 일반 공격음이 섞이지 않는다", not any(k.startswith("legacy:") for k in c), c)

    check("페이지 오류 없음", not errors, errors)
    browser.close()

if fails:
    print(f"\nFAIL: {len(fails)}건 — {', '.join(fails)}")
    sys.exit(1)
print("\nOK: 스킬별 소리 구성 이상 없음")
