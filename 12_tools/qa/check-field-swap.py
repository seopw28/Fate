#!/usr/bin/env python3
"""필드 챔프 교체가 '5장에서 5장, 같은 칸'으로 보이는지(2026-11-08 PM 피드백) 실제 브라우저에서 확인한다.

세 경로(유저 수동 교체, 궁극기 소진자 제물, 복수자 강림 제물)와 컴퓨터 교체를 재현하고,
매 프레임 필드의 유닛 수(소멸 연출 중인 카드 포함 DOM 수)와 교체 칸 밖 카드들의 가로 위치를 기록한다.
기준: 한 번도 6장이 되지 않고, 다른 카드의 위치가 한 번도 움직이지 않는다.
스크린샷은 SWAP_SHOTS 폴더(기본 /tmp/swapshots)에 남긴다.
실행: npm run build && python3 -I 12_tools/qa/check-field-swap.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

SHOTS = os.environ.get("SWAP_SHOTS", "/tmp/swapshots")
URL_Q = "/index.html?skipIntro&difficulty=normal&guardian=jujak&seed=777"

PRELUDE = """
window.__s={
  wait:ms=>new Promise(r=>setTimeout(r,ms)),
  lane:side=>document.querySelector(side==='enemy'?'.arena .lane:first-child':'.summon-zone'),
  fillPlayer:()=>{const lane=__s.lane('player');lane.innerHTML='';for(let i=0;i<5;i++){const u=summonBattleToken('약졸'+i,2,3,'earth','');u.querySelector('h4').textContent='약졸'+i;}return lane.querySelectorAll(':scope > .unit').length;},
  fillEnemy:()=>{const lane=__s.lane('enemy'),proto=enemyOriginalDeck.find(d=>!d.spell);lane.innerHTML='';for(let i=0;i<5;i++)enemySummonUnit(lane,{name:'약졸'+i,art:proto.art,el:'earth',atk:1,hp:1,cost:1,grade:{key:'c',label:'C급'}});document.querySelectorAll('.arena .lane:first-child > .unit').forEach(u=>u.style.visibility='');return lane.querySelectorAll(':scope > .unit').length;},
  /* 프레임마다 DOM 유닛 수와 칸별 가로 위치를 기록한다. */
  rec:[],
  start:side=>{const lane=__s.lane(side);__s.rec=[];__s.t0=performance.now();__s.run=true;const snap=()=>{const units=[...lane.querySelectorAll(':scope > .unit')];__s.rec.push({t:-1,dom:units.length,live:units.filter(u=>!u.classList.contains('unit-dying')).length,pos:units.map(u=>u.querySelector('h4').textContent+'@'+Math.round(u.getBoundingClientRect().left)+','+Math.round(u.getBoundingClientRect().top))});};snap();const tick=()=>{if(!__s.run)return;const units=[...lane.querySelectorAll(':scope > .unit')];__s.rec.push({t:Math.round(performance.now()-__s.t0),dom:units.length,live:units.filter(u=>!u.classList.contains('unit-dying')).length,pos:units.map(u=>u.querySelector('h4').textContent+'@'+Math.round(u.getBoundingClientRect().left)+','+Math.round(u.getBoundingClientRect().top))});requestAnimationFrame(tick);};requestAnimationFrame(tick);},
  stop:()=>{__s.run=false;return __s.rec;}
};
"""

SCENARIOS = {
 "manual": ("player", """(()=>{const lane=__s.lane('player');const target=lane.children[2];
  const def=collectionCardDefs.find(d=>d.cardType==='champion');const card=createRuntimeBattleCard(def.cardId);document.querySelector('.hand').appendChild(card);
  mana=10;maxMana=10;playerHp=100;battlePhase='setup';__s.start('player');replaceFieldUnit(card,target);return 'ok';})()"""),
 "spent": ("player", """(()=>{const proto=enemyOriginalDeck.find(d=>!d.spell);__s.start('player');
  const u=sendUltimateToGraveyard({name:'소진자',art:proto.art,element:'fire',baseAttack:3,baseHp:3});return u?'ok':'null';})()"""),
 "avenger": ("player", """(()=>{const proto=enemyOriginalDeck.find(d=>!d.spell);__s.start('player');
  const u=summonUltimateAvenger('player',{name:'쓰러진 영웅',art:proto.art,element:'fire',baseAttack:3,baseHp:3});return u?'ok':'null';})()"""),
 "enemy": ("enemy", """(()=>{const lane=__s.lane('enemy');const strong=enemyOriginalDeck.find(d=>!d.spell);
  const data={...strong,cost:3,atk:9,atkFinal:9,hp:9,name:'강자',grade:{key:'a',label:'A급'}};enemyMana=9;enemyHp=100;
  __s.start('enemy');replaceEnemyUnit(lane,data,lane.children[2]);return 'ok';})()"""),
 "enemy-spent": ("enemy", """(()=>{const proto=enemyOriginalDeck.find(d=>!d.spell);__s.start('enemy');
  const u=sendEnemyUltimateToGraveyard({name:'소진자',art:proto.art,element:'fire',baseAttack:3,baseHp:3});return u?'ok':'null';})()"""),
}


def far(a, b, tol=2):
    """'x,y' 두 좌표가 tol(px)보다 벌어졌는가. 반올림 오차 1px 는 움직임으로 치지 않는다."""
    ax, ay = map(int, a.split(',')); bx, by = map(int, b.split(','))
    return abs(ax - bx) > tol or abs(ay - by) > tol


def main():
    os.makedirs(SHOTS, exist_ok=True)
    fails = 0
    with serve_own_tree() as base, sync_playwright() as p:
        br = p.chromium.launch()
        for name, (side, script) in SCENARIOS.items():
            ctx = br.new_context(viewport={"width": 1366, "height": 768})
            pg = ctx.new_page(); errors = []
            pg.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
            pg.goto(base + URL_Q); pg.wait_for_function("typeof battlePhase!=='undefined'&&battlePhase==='setup'", timeout=15000)
            pg.evaluate(PRELUDE)
            pg.wait_for_timeout(1500)  # 시작 연출이 끝나길 기다린다
            pg.evaluate("__s.fill%s()" % ('Enemy' if side == 'enemy' else 'Player'))
            pg.wait_for_timeout(1200)  # 채운 카드의 등장 연출이 끝나길 기다린다
            res = pg.evaluate(script)
            for i in range(7):
                pg.screenshot(path=f"{SHOTS}/{name}-{i}.png")
                pg.wait_for_timeout(80)
            pg.wait_for_timeout(1500)
            rec = pg.evaluate("__s.stop()")
            replaced_name = '약졸2' if name in ('manual', 'enemy') else '약졸4'
            max_dom = max((r["dom"] for r in rec), default=0)
            max_live = max((r["live"] for r in rec), default=0)
            # 교체 칸 밖 카드 위치: 교체되지 않은 '약졸' 카드는 교체 구간(0.8초) 동안 처음 위치에서 한 번도 안 움직여야 한다.
            moved = set()
            def rel(r):
                # 착지 충격 등으로 화면 전체가 흔들리는 것은 교체와 무관하므로 맨 왼쪽 카드(약졸0, 교체 대상이 아님) 기준 상대 위치로 잰다.
                pos = {x.split('@')[0]: tuple(map(int, x.split('@')[1].split(','))) for x in r["pos"]}
                ox, oy = pos.get('약졸0', (0, 0))
                return {n: f"{x - ox},{y - oy}" for n, (x, y) in pos.items()}
            first = rel(rec[0]) if rec else {}
            for r in rec:
                if r["t"] > 800:
                    break  # 교체는 0.56초 안에 끝난다. 그 뒤의 복수자 착지 흔들림 등은 교체와 무관하다.
                for n, xy in rel(r).items():
                    if n in first and far(xy, first[n]) and n != replaced_name:
                        moved.add(n)
            # 새 카드는 원래 카드가 있던 칸에 서야 한다(소진자·복수자는 맨 오른쪽 칸).
            replaced = '약졸2' if name in ('manual', 'enemy') else '약졸4'
            fin = rel(rec[-1]) if rec else {}
            newcomer = [n for n in fin if n not in first]
            same_cell = len(newcomer) == 1 and not far(fin[newcomer[0]], first.get(replaced), 40)  # 130% 소진자는 겉보기 폭만큼 왼쪽 끝이 어긋난다
            samples = [(r["t"], r["dom"]) for r in rec[:: max(1, len(rec) // 14)]]
            ok = res == 'ok' and max_dom == 5 and max_live <= 5 and not moved and same_cell and not errors
            fails += not ok
            print(("PASS " if ok else "FAIL ") + f"{name}: 프레임 {len(rec)}개, DOM 유닛 수 최대 {max_dom} / 살아있는 카드 최대 {max_live}, 움직인 옆 카드 {sorted(moved) or '없음'}, 새 카드가 원래 칸에 섬 {same_cell} {errors[:2] if errors else ''}")
            print("   t(ms),DOM수:", samples)
            ctx.close()
        br.close()
    print("OK: 교체 중 6장 없음" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)


main()
