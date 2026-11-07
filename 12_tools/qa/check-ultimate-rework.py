#!/usr/bin/env python3
"""궁극기·복수자·묘지 재사용 규칙(2026-11-07 PM 확정)을 실제 브라우저에서 동작으로 확인한다.

11_qa/regression 의 테스트는 번들 문자열만 보므로, 세팅 잠금·소진자 수치·복수자 T+2 강림·추가 드로우·묘지 재사용은
여기서 게임 함수를 직접 불러 확인한다. 자기 트리의 dist 를 serve_own_tree 로 띄운다(남의 번들을 재지 않는다).
실행: npm run build && npm run qa:ultimate
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

WAIT = "await new Promise(r=>setTimeout(r,%d));"
# 공통 준비: 손패 정리, 궁극기용 카드 생성기, 전장 제물
PRELUDE = """
window.__q={
  card:(id)=>{const c=createRuntimeBattleCard(id);document.querySelector('.hand').appendChild(c);return c;},
  fireId:collectionCardDefs.find(d=>d.cardType==='champion'&&d.aura==='fire').cardId,
  notFireId:collectionCardDefs.find(d=>d.cardType==='champion'&&d.aura!=='fire').cardId,
  atk:u=>Number(u.querySelector('.stats span:first-child').textContent.replace(/[^0-9]/g,'')),
  hp:u=>Number(u.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,'')),
  endBtn:()=>document.querySelector('.turn-actions .end'),
  trim:()=>[...document.querySelectorAll('.hand .card')].slice(2).forEach(c=>c.remove()),
  spent:()=>document.querySelector('.summon-zone .unit[data-effect="ultimate-spent"]'),
  avenger:()=>document.querySelector('.summon-zone .unit[data-effect="ultimate-avenger"]'),
  wait:ms=>new Promise(r=>setTimeout(r,ms)),
  // 각성 버튼이 열린 상태 + 제물 챔프 + 마나 가득
  ready:()=>{playerHp=70;ultimateAwakenGateOpen('player');summonBattleToken('제물',2,5,'earth');mana=maxMana;updateMana();},
};
"""

CHECKS = [
 ("각성 전(체력 80 초과)에는 궁극기를 세팅할 수 없고, 사유가 패널에 표시된다",
  "(()=>{const c=__q.card(__q.notFireId);playerHp=100;setUltimate(c);const blocked=!ultimateState&&c.isConnected;const reason=ultimateSettingLockReason();"
  "renderUltimate();const btn=document.querySelector('#ultimate-panel .ultimate-slot-empty');"
  "return {ok:blocked&&reason==='오라 각성 후 세팅 가능'&&btn.disabled&&btn.textContent.includes(reason),blocked,reason,btn:btn.textContent};})()"),
 ("체력 81은 닫혀 있고 80에서 열린다. 한 번 열리면 체력을 회복해도 계속 열려 있다",
  "(()=>{playerHp=81;const at81=ultimateAwakenGateOpen('player');playerHp=80;const at80=ultimateAwakenGateOpen('player');playerHp=100;const healed=ultimateAwakenGateOpen('player');"
  "const c=__q.card(__q.notFireId);setUltimate(c);return {ok:!at81&&at80&&healed&&!!ultimateState,at81,at80,healed};})()"),
 ("세팅하면 대전 덱의 같은 카드를 모두 묘지로 보낸다. 취소해도 손패로 돌아올 뿐 덱 사본은 돌아오지 않는다",
  "(()=>{playerHp=70;const c=__q.card(__q.notFireId),art=cardArtwork(c),proto=deck.find(d=>!d.spell);deck.push({...proto,art},{...proto,art});const before=deck.filter(d=>d.art===art).length,gy0=allyGraveyard.length;"
  "setUltimate(c);const after=deck.filter(d=>d.art===art).length,gy=allyGraveyard.filter(d=>d.art===art).length;const handBefore=document.querySelectorAll('.hand .card').length;cancelUltimate();"
  "const back=document.querySelectorAll('.hand .card').length===handBefore+1&&!ultimateState;return {ok:before===2&&after===0&&gy===2&&allyGraveyard.length===gy0+2&&back&&deck.filter(d=>d.art===art).length===0,before,after,gy,back};})()"),
 ("사용 가능 턴·강한 카드 분류가 없다: 1턴에도 마나만 맞으면 발동되고, 비용은 내 최대 마나다",
  "(async()=>{playerHp=70;turnNumber=1;__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);const cost=ultimateState.cost,max=maxMana,lock=ultimateLockReason();mana=max-1;const short=ultimateLockReason();mana=max;"
  "return {ok:cost===max&&lock===''&&short==='마나 '+max+' 필요'&&!('minTurn' in ultimateState)&&!('strong' in ultimateState),cost,max,lock,short};})()"),
 ("혈마나는 궁극기에 쓸 수 없다(마나가 모자라면 체력을 내도 발동 불가)",
  "(()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);turnNumber=20;mana=maxMana-1;const hp=playerHp;fireUltimateAction();return {ok:!!ultimateState&&playerHp===hp&&!__q.spent(),hp:playerHp};})()"),
 ("소진자: 카드 기본 공격력 +15 / 체력 1 / 110% / 즉시 공격 가능 / 맨 오른쪽 고정 / 전역 도발",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);const base=ultimateState.baseAttack;fireUltimateAction();setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();const lane=document.querySelector('.summon-zone');"
  "const r={atk:u&&__q.atk(u),hp:u&&__q.hp(u),exhausted:u?.classList.contains('exhausted'),last:u===lane.lastElementChild,scale:u&&getComputedStyle(u).scale,locked:u?.dataset.orderLocked,aggro:u?.dataset.ultimateAggro,base};"
  "return {ok:!!u&&r.atk===base+15&&r.hp===1&&r.exhausted===false&&r.last&&r.scale==='1.1'&&r.locked==='true'&&r.aggro==='true'&&battlePhase==='setup',...r};})()"),
 ("오라 공명(카드 성격 = 내 오라 불): 비용 −2, 소진자 공격 +2 · 체력 +2",
  "(async()=>{__q.ready();maxMana=6;mana=6;const c=__q.card(__q.fireId);setUltimate(c);const base=ultimateState.baseAttack,cost=ultimateState.cost,res=auraUltimateMatch(ultimateState);fireUltimateAction();setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();return {ok:res&&cost===4&&mana===2&&__q.atk(u)===base+15+2&&__q.hp(u)===3,res,cost,mana,atk:__q.atk(u),hp:__q.hp(u),base};})()"),
 ("소진자가 안 죽으면 다음 궁극기를 세팅할 수 없고 잠금 사유가 표시된다",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);fireUltimateAction();setBattlePhase('setup');" + (WAIT % 50) +
  "const c2=__q.card(__q.notFireId);turnNumber+=10;setUltimate(c2);const reason=ultimateSettingLockReason();renderUltimate();const btn=document.querySelector('#ultimate-panel .ultimate-slot-empty');"
  "return {ok:!ultimateState&&reason==='소진자 생존 중'&&btn.disabled&&btn.textContent.includes('소진자 생존 중'),reason,btn:btn.textContent};})()"),
 ("복수자: 소진자가 쓰러진 뒤 내 턴 시작 2번째에 강림한다(+7 공격 / +15 체력, 110%), 그 전에는 세팅 잠금 · 강림 후 해제",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);const base=ultimateState.baseAttack,baseHp=ultimateState.baseHp;fireUltimateAction();setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();damageUnit(u,99,'fire');u.dataset.destroyed='true';" + (WAIT % 60) + "setTimeout(()=>u.remove(),0);const turns0=ultimateLedger.player.turns,due=ultimateLedger.player.pending[0]?.due;"
  "const lock0=ultimateSettingLockReason();fxClear?.();const btn=__q.endBtn();"
  "startPlayerTurn(btn);const afterOne={avenger:!!__q.avenger(),lock:ultimateSettingLockReason()};fxClear?.();"
  "startPlayerTurn(btn);" + (WAIT % 400) + "const a=__q.avenger();"
  "const r={due,turns0,lock0,afterOne,atk:a&&__q.atk(a),hp:a&&__q.hp(a),scale:a&&getComputedStyle(a).scale,lockAfter:ultimateSettingLockReason(),arrived:ultimateLedger.player.arrived,base,baseHp};"
  "return {ok:due===turns0+2&&lock0==='복수자 강림까지 2턴'&&afterOne.avenger===false&&afterOne.lock==='복수자 강림까지 1턴'&&!!a&&r.atk===base+7&&r.hp===baseHp+15&&r.scale==='1.1'&&r.lockAfter===''&&r.arrived===1,...r};})()"),
 ("복수자의 외형은 덱 구성에서 빌려 오며 덱에서 카드를 빼지 않는다(턴 시작 기본 드로우 1장만 줄어든다)",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);fireUltimateAction();setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();damageUnit(u,99,'fire');u.dataset.destroyed='true';" + (WAIT % 60) + "u.remove();const btn=__q.endBtn();"
  "__q.trim();startPlayerTurn(btn);fxClear?.();const d1=deck.length;__q.trim();startPlayerTurn(btn);const d2=deck.length;" + (WAIT % 60) +
  "const a=__q.avenger(),names=new Set(collectionState.deck.map(i=>collectionCards[i][2]));return {ok:!!a&&d1-d2===1&&names.has(a.querySelector('h4').textContent),d1,d2,name:a?.querySelector('h4').textContent};})()"),
 ("복수자가 두 번째로 등장한 뒤부터 내 턴 시작에 1장 추가 드로우(손패 8장·덱 비면 생략)",
  "(()=>{const btn=__q.endBtn();const draw=(arrived,handTrim)=>{ultimateLedger.player.arrived=arrived;__q.trim();if(handTrim)while(document.querySelectorAll('.hand .card').length<7)__q.card(__q.notFireId);const d=deck.length;startPlayerTurn(btn);return d-deck.length;};"
  "const one=draw(1,false),two=draw(2,false),full=draw(2,true);const e=deck.splice(0,deck.length-1);__q.trim();ultimateLedger.player.arrived=2;const lastDeck=deck.length;startPlayerTurn(btn);"
  "return {ok:one===1&&two===2&&full<=1,one,two,full,lastDeck};})()"),
 ("묘지 재사용: 덱이 비면 체력 10을 내고 묘지(소진자·복수자 제외)를 섞어 새 덱으로 쓴다",
  "(()=>{__q.trim();const protos=deck.filter(d=>!d.spell).slice(0,3);allyGraveyard.length=0;protos.forEach(p=>allyGraveyard.push(graveRecordFromDeckCard(p)));allyGraveyard.push({name:'소진자',art:protos[0].art,element:'fire',attack:20,maxHp:1,effect:'ultimate-spent'},{name:'복수자',art:protos[1].art,element:'fire',attack:9,maxHp:20,effect:'ultimate-avenger'});"
  "deck.length=0;playerHp=50;drawCard();const left=allyGraveyard.map(x=>x.effect);return {ok:playerHp===40&&deck.length===2&&left.length===2&&left.every(e=>/ultimate-(spent|avenger)/.test(e)),hp:playerHp,deck:deck.length,left};})()"),
 ("묘지 재사용 체력 경계: 11이면 가능(→1), 10 이하면 불가(드로우 없이 종료), 묘지가 비면 불가",
  "(()=>{__q.trim();const p=deck.find(d=>!d.spell);const seed=()=>{allyGraveyard.length=0;allyGraveyard.push(graveRecordFromDeckCard(p),graveRecordFromDeckCard(p));deck.length=0;};"
  "seed();playerHp=11;drawCard();const at11={hp:playerHp,deck:deck.length};seed();playerHp=10;drawCard();const at10={hp:playerHp,deck:deck.length};allyGraveyard.length=0;deck.length=0;playerHp=60;drawCard();const empty={hp:playerHp,deck:deck.length};"
  "return {ok:at11.hp===1&&at11.deck===1&&at10.hp===10&&at10.deck===0&&empty.hp===60&&empty.deck===0,at11,at10,empty};})()"),
 ("컴퓨터도 같은 묘지 재사용을 한다(체력 10 초과일 때만, 소진자·복수자 제외)",
  "(()=>{const p=enemyDeck.find(d=>!d.spell);enemyGraveyard.length=0;enemyGraveyard.push(graveRecordFromDeckCard(p),graveRecordFromDeckCard(p),{name:'소진자',art:p.art,effect:'ultimate-spent'});enemyDeck.length=0;enemyHand.length=0;enemyHp=50;enemyDraw();"
  "const a={hp:enemyHp,deck:enemyDeck.length,hand:enemyHand.length};enemyGraveyard.length=0;enemyGraveyard.push(graveRecordFromDeckCard(p));enemyDeck.length=0;enemyHp=10;enemyDraw();"
  "return {ok:a.hp===40&&a.deck===1&&a.hand===1&&enemyHp===10&&enemyDeck.length===0&&enemyHand.length===1,a,hp:enemyHp};})()"),
 ("BGM: 체력 40 이하만으로는 바뀌지 않고, 어느 쪽이든 복수자가 처음 등장하면 각성곡으로 바뀌어 유지된다",
  "(async()=>{playerHp=30;enemyHp=30;" + (WAIT % 700) + "const before=bgm===bgmTracks.main;__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);fireUltimateAction();setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();damageUnit(u,99,'fire');u.dataset.destroyed='true';" + (WAIT % 60) + "u.remove();const btn=__q.endBtn();startPlayerTurn(btn);fxClear?.();const mid=bgm===bgmTracks.main;startPlayerTurn(btn);" + (WAIT % 60) +
  "const after=bgm===bgmTracks.awakening;startPlayerTurn(btn);return {ok:before&&mid&&after&&bgm===bgmTracks.awakening,before,mid,after};})()"),
("체력 40% 기준 장치 삭제: 40 이하에도 게이지·안내·추가 드로우·역전 돌진·회복 잠금이 없고, 카드의 돌진 효과는 남는다",
  "(async()=>{playerHp=35;updateHeroHealth();" + (WAIT % 800) + "const gauge=document.querySelector('#player-health').parentElement,toast=document.querySelector('.desperate-toast');"
  "const btn=__q.endBtn();__q.trim();const d=deck.length;startPlayerTurn(btn);const drew=d-deck.length;const healed=healPlayerHero(5);"
  "const u=summonBattleToken('일반',2,2,'fire');triggerBattlecry(u);const r=summonBattleToken('돌진',2,2,'fire','rush');triggerBattlecry(r);"
  "return {ok:!gauge.classList.contains('desperate')&&!toast&&drew===1&&healed===5&&u.dataset.rush!=='true'&&typeof comebackRushActive==='undefined'&&typeof playerHeroHealingLocked==='undefined',drew,healed,rush:u.dataset.rush};})()"),
 ("복수자 착지 뒤 상대 영웅에게 7 피해(내 복수자), 컴퓨터 복수자는 내 영웅에게 7 피해",
  "(async()=>{const rec={name:'소진',art:deck.find(d=>!d.spell).art,element:'fire',baseAttack:3,baseHp:4};"
  "const e0=enemyHp,p0=playerHp;ultimateLedger.player.pending.push({rec,due:ultimateLedger.player.turns+1});advanceUltimateLedger('player');"
  "for(let i=0;i<100&&enemyHp===e0;i++)await __q.wait(100);const mine={enemy:e0-enemyHp,playerUntouched:playerHp===p0};"
  "const e1=enemyHp;ultimateLedger.enemy.pending.push({rec,due:ultimateLedger.enemy.turns+1});advanceUltimateLedger('enemy');"
  "for(let i=0;i<100&&playerHp===p0;i++)await __q.wait(100);const theirs={player:p0-playerHp,enemyUntouched:enemyHp===e1};"
  "return {ok:mine.enemy===7&&mine.playerUntouched&&theirs.player===7&&theirs.enemyUntouched,mine,theirs};})()"),
 ("복수자 착지 피해로 상대 영웅 체력이 0이 되면 즉시 승리, 내 영웅이 0이 되면 즉시 패배",
  "(async()=>{const rec={name:'소진',art:deck.find(d=>!d.spell).art,element:'fire',baseAttack:3,baseHp:4};const shown=()=>document.querySelector('#result').classList.contains('show');"
  "enemyHp=7;updateHeroHealth();ultimateLedger.player.pending.push({rec,due:ultimateLedger.player.turns+1});advanceUltimateLedger('player');"
  "for(let i=0;i<100&&!shown();i++)await __q.wait(100);const win=shown()&&enemyHp===0&&!document.querySelector('#result').classList.contains('lose');return {ok:win,win,enemyHp};})()"),
 ("컴퓨터 복수자의 착지 피해로 내 영웅이 0이 되면 즉시 패배",
  "(async()=>{const rec={name:'소진',art:deck.find(d=>!d.spell).art,element:'fire',baseAttack:3,baseHp:4};const shown=()=>document.querySelector('#result').classList.contains('show');"
  "playerHp=7;updateHeroHealth();ultimateLedger.enemy.pending.push({rec,due:ultimateLedger.enemy.turns+1});advanceUltimateLedger('enemy');"
  "for(let i=0;i<100&&!shown();i++)await __q.wait(100);const lose=shown()&&playerHp===0&&document.querySelector('#result').classList.contains('lose');return {ok:lose,lose,playerHp};})()"),
 ("컴퓨터 대칭: 각성 전 세팅 불가 → 열리면 장착(덱 사본 처리) → 비용 = 최대 마나 → 소진자 +15/1 → 쓰러지면 2번째 턴에 +7/+15 복수자",
  "(async()=>{const proto=enemyDeck.find(d=>!d.spell);const base=baseCardStatsByArt(proto.art);enemyHand.length=0;enemyHand.push({...proto,atkFinal:proto.atk});enemyDeck.push({...proto},{...proto});"
  "enemyHp=100;enemyUltimate=null;equipEnemyUltimate();const closed=!enemyUltimate;enemyHp=70;ultimateAwakenGateOpen('enemy');equipEnemyUltimate();const equipped=!!enemyUltimate,left=enemyDeck.filter(d=>d.art===proto.art).length;"
  "enemyTurnMaxMana=maxMana=7;enemyMana=7;summonBattleToken;const lane=document.querySelector('.arena .lane:first-child');enemySummonUnit(lane,{name:'제물',art:proto.art,el:'earth',atk:2,hp:5,cost:1});"
  "const cost=enemyUltimateManaCost(enemyUltimate),res=enemyAuraUltimateMatch(enemyUltimate);castEnemyUltimate();" + (WAIT % 200) +
  "const s=lane.querySelector('.unit[data-effect=\"ultimate-spent\"]');const sAtk=__q.atk(s),sHp=__q.hp(s),ex=s.classList.contains('exhausted');"
  "const mana=enemyMana;damageUnit(s,99,'fire');s.dataset.destroyed='true';" + (WAIT % 60) + "s.remove();const pend=ultimateLedger.enemy.pending[0]?.due-ultimateLedger.enemy.turns;const lock=ultimateSettingLockReason('enemy');"
  "advanceUltimateLedger('enemy');const noneYet=!lane.querySelector('.unit[data-effect=\"ultimate-avenger\"]');advanceUltimateLedger('enemy');" + (WAIT % 60) +
  "const a=lane.querySelector('.unit[data-effect=\"ultimate-avenger\"]');"
  "const ex2={closed,equipped,left,cost,res,mana,sAtk,sHp,ex,pend,lock,noneYet,aAtk:a&&__q.atk(a),aHp:a&&__q.hp(a),base};"
  "return {ok:closed&&equipped&&left===0&&cost===(res?5:7)&&mana===7-cost&&sAtk===base.atk+15+(res?2:0)&&sHp===(res?3:1)&&ex===false&&pend===2&&lock==='복수자 강림까지 2턴'&&noneYet&&!!a&&ex2.aAtk===base.atk+7&&ex2.aHp===base.hp+15,...ex2};})()"),
 ("컴퓨터 턴 흐름: 강림 시점의 enemyTurn 이 오류 없이 복수자를 내려놓고 공격 목록에 포함한다",
  "(async()=>{const proto=enemyDeck.find(d=>!d.spell);ultimateLedger.enemy.pending.push({rec:{name:proto.name,art:proto.art,element:proto.el,baseAttack:3,baseHp:4},due:ultimateLedger.enemy.turns+1});"
  "let finished=false;enemyTurn(()=>{finished=true;});for(let i=0;i<120&&!finished;i++)await __q.wait(100);" + (WAIT % 100) + "const a=document.querySelector('.arena .lane:first-child .unit[data-effect=\"ultimate-avenger\"]');"
  "return {ok:!!a&&__q.atk(a)===10&&__q.hp(a)===19&&finished,finished,atk:a&&__q.atk(a),hp:a&&__q.hp(a)};})()"),
]

URL_Q = "/index.html?skipIntro&difficulty=normal&guardian=jujak&seed=777"


def main():
    fails = 0
    with serve_own_tree() as base, sync_playwright() as p:
        br = p.chromium.launch()
        for name, script in CHECKS:
            ctx = br.new_context(viewport={"width": 1366, "height": 768})
            pg = ctx.new_page(); errors = []
            pg.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
            pg.goto(base + URL_Q); pg.wait_for_function("typeof battlePhase!=='undefined'&&battlePhase==='setup'",timeout=15000)
            try:
                pg.evaluate(PRELUDE)
                result = pg.evaluate(script)
            except Exception as e:
                result = {"ok": False, "error": str(e)[:300]}
            if errors:
                result = {**result, "ok": False, "pageErrors": errors[:2]}
            ok = result.pop("ok", False)
            fails += not ok
            print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  {result}"))
            ctx.close()
        br.close()
    print("OK: 궁극기·복수자·묘지 재사용 규칙 확인" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)


main()
