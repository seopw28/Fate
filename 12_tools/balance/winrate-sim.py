"""승률 시뮬레이터 — 실제 게임을 타이머 가속으로 돌려 승률만 센다.

규칙을 다시 구현하지 않는다. 다시 구현하면 승률이 아니라 내 모델을 재게 된다.
대신 페이지 로드 '전에' setTimeout/animate 를 압축해 연출 대기를 없애고,
게임 자신의 전투·AI 코드로 판정한다.

사용: python3 -I 12_tools/balance/winrate-sim.py --games 400 --guardian cheongryong
"""
import time, json, argparse
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/"

# 게임 코드가 타이머를 잡아두기 전에 갈아끼운다.
FAST = """
(() => {
  const F = 40;                      // 시간을 F 배 빠르게 흐르게 한다
  const st = window.setTimeout, si = window.setInterval;
  window.setTimeout  = (fn, ms, ...a) => st(fn, Math.max(0, Math.floor((ms||0)/F)), ...a);
  window.setInterval = (fn, ms, ...a) => si(fn, Math.max(1, Math.floor((ms||0)/F)), ...a);

  // 전투 진행은 performance.now() 를 combatBusyUntil 과 비교해 기다린다.
  // setTimeout 만 줄이면 이 실시간 마감은 그대로라 판당 수십 초가 걸린다.
  // 시계 자체를 F 배로 흐르게 해 그 마감도 같이 당긴다.
  const realNow = performance.now.bind(performance);
  const base = realNow();
  performance.now = () => base + (realNow() - base) * F;
  // Date 는 건드리지 않는다 — 프록시로 감싸면 내부 호출이 자기를 다시 불러
  // 스택이 터진다(실측). 전투 대기는 performance.now() 를 쓰므로 그것만으로 충분하다.
  // 드라이버 자신의 대기는 Date.now() 기준이라 실시간으로 남아 안전판이 된다.

  const ea = Element.prototype.animate;
  Element.prototype.animate = function(k, o) {
    o = (o && typeof o === 'object') ? Object.assign({}, o, {duration:1, delay:0}) : {duration:1};
    return ea.call(this, k, o);
  };
  window.matchMedia = q => ({matches:/reduce/.test(q), media:q,
    addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}});
})();
"""

DRIVE = r"""
async (opts) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const over = () => battlePhase === 'ended' || resultPending || playerHp <= 0 || enemyHp <= 0;
  try {
    pickGuardian(opts.guardian, {free:true});
    await sleep(40);
    if (opts.awaken) {
      try { playerGuardian = opts.guardian; guardianAwakenChoice = opts.awaken;
            guardianAwakenUsed = true; } catch(e) {}
    }
    let turns = 0, drew = 0, stalls = 0;
    for (let t = 0; t < opts.maxTurns; t++) {
      if (over()) break;
      const t0 = Date.now();
      while (battlePhase !== 'setup' && Date.now() - t0 < opts.waitMs) {
        if (over()) break;
        await sleep(3);
      }
      if (over()) break;
      // 아직 내 차례가 아니면 포기하지 말고 다음 바퀴에 다시 본다. 여기서 break 하면
      // 상대 턴이 조금 길어진 판이 전부 '미결판'으로 버려진다 (실측으로 잡힌 버그).
      if (battlePhase !== 'setup') { stalls++; if (stalls > opts.maxStalls) break; continue; }
      stalls = 0;
      turns++;
      for (let d = 0; d < 3; d++) {
        const b = document.querySelector('#draw-action');
        if (!b || b.disabled) break;
        if (mana < opts.keepMana) break;        // 낼 카드 몫은 남긴다
        b.click(); drew++; await sleep(2);
      }
      for (let i = 0; i < 8; i++) {
        const c = [...document.querySelectorAll('.hand .card')]
          .map(x => ({el:x, cost:Number((x.querySelector('.cost')?.textContent||'99').replace(/[^0-9]/g,''))||0}))
          .filter(x => x.cost <= mana).sort((a,b) => b.cost - a.cost)[0];
        if (!c) break;
        try { playCard(c.el); } catch(e) { break; }
        await sleep(2);
      }
      const e = [...document.querySelectorAll('button.end')].find(x => /턴 종료/.test(x.textContent));
      if (e && !e.disabled) e.click();
      await sleep(4);
    }
    const decided = over();
    return {ok:true, playerHp, enemyHp, turns, drew, decided,
            win: decided ? (enemyHp <= 0 ? 1 : (playerHp <= 0 ? 0 : (enemyHp < playerHp ? 1 : 0))) : null};
  } catch (e) { return {ok:false, error:String(e).slice(0,160)}; }
}
"""

def run(games, guardian, awaken, max_turns, wait_ms, keep_mana, quiet=False):
    t0 = time.time(); res = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio"])
        ctx = b.new_context(viewport={'width':900,'height':700})
        ctx.add_init_script(FAST)
        pg = ctx.new_page(); pg.set_default_timeout(0)
        for i in range(games):
            try:
                pg.goto(f"{URL}?seed=sim-{guardian}-{awaken}-{i}", wait_until='load')
                pg.wait_for_timeout(80)
                res.append(pg.evaluate(DRIVE, {"guardian":guardian, "awaken":awaken,
                    "maxTurns":max_turns, "waitMs":wait_ms, "keepMana":keep_mana, "maxStalls":60}))
            except Exception as e:
                res.append({"ok":False, "error":str(e)[:120]})
            if not quiet and (i+1) % 25 == 0:
                d=[r for r in res if r.get('decided')]
                print(f"  {i+1}/{games} 결판 {len(d)} 승 {sum(r['win'] for r in d)}", flush=True)
        b.close()
    el = time.time()-t0
    dec = [r for r in res if r.get('decided')]
    errs = [r.get('error') for r in res if not r.get('ok')]
    return {"games":games, "elapsed":round(el,1), "perGame":round(el/games,3),
            "decided":len(dec), "wins":sum(r['win'] for r in dec),
            "winrate": round(sum(r['win'] for r in dec)/len(dec)*100, 2) if dec else None,
            "avgTurns": round(sum(r.get('turns',0) for r in res)/len(res),1),
            "avgDraws": round(sum(r.get('drew',0) for r in res)/len(res),2),
            "errors": errs[:2]}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=100)
    ap.add_argument("--guardian", default="cheongryong")
    ap.add_argument("--awaken", default="")
    ap.add_argument("--max-turns", type=int, default=200)
    ap.add_argument("--wait-ms", type=int, default=120000)
    ap.add_argument("--keep-mana", type=int, default=3)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    print(json.dumps(run(a.games, a.guardian, a.awaken or None, a.max_turns,
                         a.wait_ms, a.keep_mana, a.quiet), ensure_ascii=False))
