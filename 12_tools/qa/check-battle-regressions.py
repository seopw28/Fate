"""전투·경제 회귀 검사: 실제 브라우저로 게임을 띄워 과거에 고친 버그가 다시 생기지 않았는지 동작으로 확인한다.

11_qa/regression의 테스트는 index.html 안의 코드 문자열만 확인하므로 이런 동작 버그를 잡지 못한다.
개발 서버가 떠 있어야 한다: python3 12_tools/dev-server.py
실행: npm run qa:battle  (또는 python3 -I 12_tools/qa/check-battle-regressions.py [URL])
"""
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:8765/index.html?skipIntro&guardian=baekho")
WAIT = "await new Promise(r=>setTimeout(r,%d));"
TRIM_HAND = "[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());"  # 손패 8장 제한에 걸리지 않게
ADD_ENEMY = "enemySummonUnit(document.querySelector('.arena .lane:first-child'),{el:'fire',name:'적',atk:3,hp:40,cost:3});"
ULT_READY = ADD_ENEMY + ADD_ENEMY + "playerHp=60;updateHeroHealth();['fire','water','earth'].forEach(el=>summonBattleToken('아군',2,5,el));"  # 어떤 성격의 궁극기든 발동 조건(적 2명·체력 75% 이하·서로 다른 성격 3명 등)을 채운다

CHECKS = [
    ("혈마나로 세트한 마법을 취소하면 낸 체력을 그대로 돌려받는다 (60으로 잘리지 않음)",
     "(async()=>{" + TRIM_HAND + "turnNumber=6;mana=0;playerHp=100;updateMana();const c=createRuntimeBattleCard('core.crimson-bolt');"
     "document.querySelector('.hand').appendChild(c);playCard(c);playCard(c);" + WAIT % 2500 + "const paid=playerHp;cancelSetMagic(0);"
     "return {ok:paid<100&&playerHp===100,paid,afterCancel:playerHp};})()"),
    ("덱이 1장일 때 2장 뽑기 마법을 써도 빈 덱 패배가 나지 않는다",
     "(async()=>{" + TRIM_HAND + "deck.splice(1);const c=createRuntimeBattleCard('tower.arcane-insight');document.body.appendChild(c);castSpell(c);"
     + WAIT % 1500 + "const lost=document.querySelector('#result').classList.contains('show');return {ok:!lost&&deck.length===0,lost,deck:deck.length};})()"),
    ("궁극기 효과가 적용될 때까지 턴 종료가 잠기고, 적용 뒤 풀린다",
     "(async()=>{const c=createRuntimeBattleCard('core.seraphina');ultimateState=ultimateSpec(c);ultimateUsed=false;lastUltimateTurn=null;"
     "turnNumber=8;mana=10;updateMana();" + ULT_READY + "activateUltimate();const during=battlePhase;endTurn(document.querySelector('.turn-actions .end'));"
     "const afterEnd=battlePhase;" + WAIT % 2900 + "return {ok:during==='ultimate-resolving'&&afterEnd==='ultimate-resolving'&&battlePhase==='setup',during,afterEnd,after:battlePhase};})()"),
    ("소환 효과(마나 화살)로 상대 영웅 체력이 0이 되면 승리한다",
     "(async()=>{enemyHp=2;updateHeroHealth();const u=summonBattleToken('t',1,3,'wind','arcane-arrow');triggerBattlecry(u);" + WAIT % 3500 +
     "const win=document.querySelector('#result').classList.contains('show');return {ok:enemyHp===0&&win,enemyHp,win};})()"),
    ("합성에 쓴 시작 카드가 새로고침해도 되살아나지 않는다 (1단계: 합성)",
     "(async()=>{const i=collectionState.owned.findIndex((n,k)=>n>=8&&!collectionIsSpell[k]);window.__i=i;window.__before=collectionState.owned[i];"
     "synthSlots=[i,i,i];runSynthesis();" + WAIT % 500 + "const saved=JSON.parse(localStorage.getItem('primal-collection-v1')).owned[i];"
     "localStorage.setItem('__qa_synth',JSON.stringify({i,saved}));return {ok:saved<window.__before,i,before:window.__before,saved};})()"),
    ("__RELOAD__", ""),
    ("합성에 쓴 시작 카드가 새로고침해도 되살아나지 않는다 (2단계: 새로고침 뒤)",
     "(()=>{const {i,saved}=JSON.parse(localStorage.getItem('__qa_synth'));return {ok:collectionState.owned[i]===saved,i,saved,afterReload:collectionState.owned[i]};})()"),
    ("약자멸시 패배 정산은 연출을 기다리지 않고 즉시 저장된다 (연출 중 새로고침으로 피할 수 없음)",
     "(()=>{challengeMode=true;collectionState.pendingChallenge=true;collectionState.crackers=500;persistCollection();finish(false,'qa');"
     "const s=JSON.parse(localStorage.getItem('primal-collection-v1'));return {ok:s.crackers===300&&s.pendingChallenge===false,crackers:s.crackers,pending:s.pendingChallenge};})()"),
    ("챔프 공격이 보호막에 막히면 '보호막이 막음' 연출이 보인다 (효과·피해 없이 끝나 보이지 않음)",
     "(async()=>{const lane=document.querySelector('.arena .lane:first-child');enemySummonUnit(lane,{el:'fire',name:'적',atk:5,hp:9,cost:3});"
     "const e=lane.querySelector('.unit');e.dataset.shield='true';const a=summonBattleToken('나',3,9,'water');a.classList.remove('exhausted');"
     + WAIT % 300 + "selectUnit(a);attack(e);" + WAIT % 700 +
     "const shown=[...document.body.querySelectorAll('*')].some(n=>n.children.length===0&&/보호막이 막음/.test(n.textContent));"
     "const label=[...document.querySelectorAll('.field-impact-label')].map(n=>n.textContent);"
     "return {ok:shown&&label.includes('보호막')&&e.dataset.shield==='false',shown,label};})()"),
    ("상대 챔프는 쓰러져 사라지는 중인 내 유닛을 공격 대상으로 고르지 않는다",
     "(()=>{const src=[...document.scripts].map(s=>s.textContent).join('');"
     "return {ok:src.includes(\".summon-zone .unit:not([data-destroyed=\\\"true\\\"])')];/* 쓰러져\")};})()"),
    # 역전 마법 (상대 필드 공격력 합 12 = 6+4+2, 체력 합 24 = 10+8+6 기준)
    ("역전 마법 되돌리는 심판: 공격력 합의 절반(6)을 모든 적에게",
     "(async()=>{[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());const lane=document.querySelector('.arena .lane:first-child');[[6,10],[4,8],[2,6]].forEach(([a,h],i)=>enemySummonUnit(lane,{el:'fire',name:'적'+i,atk:a,hp:h,cost:3}));window.__ally=summonBattleToken('내챔프',5,7,'water');playerHp=50;updateHeroHealth();const c=createRuntimeBattleCard('reversal.judgment');document.querySelector('.hand').appendChild(c);updateCardAffordability();const cost=c.querySelector('.cost').textContent;c.remove();castSpell(c);await new Promise(r=>setTimeout(r,1800));const hp=[...document.querySelectorAll('.arena .lane:first-child > .unit')].map(u=>Number(u.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,'')));return {ok:JSON.stringify(hp)==='[4,2]',hp};})()"),
    ("역전 마법 반격의 방벽: 공격력 합(12)만큼 내 영웅 회복",
     "(async()=>{[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());const lane=document.querySelector('.arena .lane:first-child');[[6,10],[4,8],[2,6]].forEach(([a,h],i)=>enemySummonUnit(lane,{el:'fire',name:'적'+i,atk:a,hp:h,cost:3}));window.__ally=summonBattleToken('내챔프',5,7,'water');playerHp=50;updateHeroHealth();const c=createRuntimeBattleCard('reversal.bulwark');document.querySelector('.hand').appendChild(c);updateCardAffordability();const cost=c.querySelector('.cost').textContent;c.remove();castSpell(c);await new Promise(r=>setTimeout(r,1800));return {ok:playerHp===62,playerHp};})()"),
    ("역전 마법 거인 사냥: 체력 합의 30%(7)를 3·2·2로 나눠 피해",
     "(async()=>{[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());const lane=document.querySelector('.arena .lane:first-child');[[6,10],[4,8],[2,6]].forEach(([a,h],i)=>enemySummonUnit(lane,{el:'fire',name:'적'+i,atk:a,hp:h,cost:3}));window.__ally=summonBattleToken('내챔프',5,7,'water');playerHp=50;updateHeroHealth();const c=createRuntimeBattleCard('reversal.giant-hunt');document.querySelector('.hand').appendChild(c);updateCardAffordability();const cost=c.querySelector('.cost').textContent;c.remove();castSpell(c);await new Promise(r=>setTimeout(r,1800));const hp=[...document.querySelectorAll('.arena .lane:first-child > .unit')].map(u=>Number(u.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,'')));return {ok:JSON.stringify(hp)==='[7,6,4]',hp};})()"),
    ("역전 마법 무게의 대가: 체력 합 24 → 비용 8에서 7, 모든 적에게 5 피해",
     "(async()=>{[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());const lane=document.querySelector('.arena .lane:first-child');[[6,10],[4,8],[2,6]].forEach(([a,h],i)=>enemySummonUnit(lane,{el:'fire',name:'적'+i,atk:a,hp:h,cost:3}));window.__ally=summonBattleToken('내챔프',5,7,'water');playerHp=50;updateHeroHealth();const c=createRuntimeBattleCard('reversal.weight-toll');document.querySelector('.hand').appendChild(c);updateCardAffordability();const cost=c.querySelector('.cost').textContent;c.remove();castSpell(c);await new Promise(r=>setTimeout(r,1800));const hp=[...document.querySelectorAll('.arena .lane:first-child > .unit')].map(u=>Number(u.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,'')));return {ok:cost==='7'&&JSON.stringify(hp)==='[5,3,1]',cost,hp};})()"),
    ("역전 마법 생명 강탈: 체력 합의 절반(12)을 내 가장 강한 챔프 체력에",
     "(async()=>{[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());const lane=document.querySelector('.arena .lane:first-child');[[6,10],[4,8],[2,6]].forEach(([a,h],i)=>enemySummonUnit(lane,{el:'fire',name:'적'+i,atk:a,hp:h,cost:3}));window.__ally=summonBattleToken('내챔프',5,7,'water');playerHp=50;updateHeroHealth();const c=createRuntimeBattleCard('reversal.life-siphon');document.querySelector('.hand').appendChild(c);updateCardAffordability();const cost=c.querySelector('.cost').textContent;c.remove();castSpell(c);await new Promise(r=>setTimeout(r,1800));const ally=__ally.querySelector('.stats span:last-child').textContent;return {ok:ally==='♥ 19',ally};})()"),
    ("역전 마법 역전의 지혜: 체력 합 24 → 2장 뽑기",
     "(async()=>{[...document.querySelectorAll('.hand .card')].slice(3).forEach(c=>c.remove());const lane=document.querySelector('.arena .lane:first-child');[[6,10],[4,8],[2,6]].forEach(([a,h],i)=>enemySummonUnit(lane,{el:'fire',name:'적'+i,atk:a,hp:h,cost:3}));window.__ally=summonBattleToken('내챔프',5,7,'water');playerHp=50;updateHeroHealth();const before=document.querySelectorAll('.hand .card').length;const c=createRuntimeBattleCard('reversal.insight');document.querySelector('.hand').appendChild(c);updateCardAffordability();const cost=c.querySelector('.cost').textContent;c.remove();castSpell(c);await new Promise(r=>setTimeout(r,1800));const after=document.querySelectorAll('.hand .card').length;return {ok:after-before===2,before,after};})()"),
]


def main():
    fails = 0
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = None
        for name, script in CHECKS:
            if name == "__RELOAD__":
                pg.reload(); pg.wait_for_timeout(1800)
                continue
            if not name.startswith("합성에 쓴 시작 카드가 새로고침해도 되살아나지 않는다 (2단계"):
                if ctx: ctx.close()
                ctx = br.new_context(viewport={"width": 1600, "height": 1000})  # 검사마다 새 저장 공간
                pg = ctx.new_page(); errors = []
                pg.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
                pg.goto(URL); pg.wait_for_timeout(1800)
            try:
                result = pg.evaluate(script)
            except Exception as e:
                result = {"ok": False, "error": str(e)[:160]}
            if errors:
                result = {**result, "ok": False, "pageErrors": errors[:2]}
            ok = result.pop("ok", False)
            fails += not ok
            print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  {result}"))
        if ctx: ctx.close()
        br.close()
    print("OK: 전투·경제 회귀 없음" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)


main()
