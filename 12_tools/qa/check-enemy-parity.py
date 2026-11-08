#!/usr/bin/env python3
"""컴퓨터 상대가 유저와 같은 행동을 같은 비용·조건으로 쓰는지(2026-11-08 PM 지시) 실제 브라우저에서 확인한다.

11_qa/regression/enemy-parity.test.js 는 번들 문자열로 구조를 고정하고, 동작은 여기서 게임 함수를 직접 불러 확인한다.
실행: npm run build && npm run qa:enemy-parity
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

PRELUDE = """
window.__q={
  wait:ms=>new Promise(r=>setTimeout(r,ms)),
  lane:()=>document.querySelector('.arena .lane:first-child'),
  champ:(extra={})=>({...enemyOriginalDeck.find(d=>!d.spell),...extra}),
  fill:(n,atk=1,hp=1)=>{const lane=__q.lane(),proto=enemyOriginalDeck.find(d=>!d.spell);lane.innerHTML='';for(let i=0;i<n;i++)enemySummonUnit(lane,{name:'약졸'+i,art:proto.art,el:'earth',atk,hp,cost:1,atkFinal:atk});},
};
"""

CHECKS = [
 ("시작 손패: 컴퓨터도 시작 마나 이하 하수인 2장 이상을 보장받는다",
  "(()=>{const n=enemyHand.filter(c=>!c.spell&&c.cost<=STARTING_MANA).length;return {ok:n>=2&&enemyHand.length===OPENING_HAND_SIZE,n,size:enemyHand.length};})()"),
 ("첫 턴 자동 드로우: 컴퓨터도 자기 첫 턴에는 뽑지 않고, 둘째 턴부터 뽑으며, 손패 8장이면 뽑지 않는다",
  "(()=>{enemyTurnsTaken=0;enemyHand.length=0;const first=enemyAutoDraw(),h1=enemyHand.length;const second=enemyAutoDraw(),h2=enemyHand.length;while(enemyHand.length<8)enemyHand.push(enemyDeck[0]||__q.champ());const before=enemyDeck.length;enemyAutoDraw();"
  "return {ok:!first&&h1===0&&second&&h2===1&&enemyHand.length===8&&enemyDeck.length===before,first,h1,second,h2,hand:enemyHand.length};})()"),
 ("카드 뽑기 비용: 컴퓨터도 그 턴 n번째 2·4·8, 모자란 마나는 배틀 첫 혈마나 1번이 마나 1당 체력 1",
  "(()=>{enemyHand.length=0;enemyHp=100;enemyMana=10;enemyDrawActionsUsed=0;enemyBloodManaUses=0;enemyBloodManaBattleUses=0;turnNumber=3;"
  "while(enemyDeck.length<12)enemyDeck.push(...enemyOriginalDeck.slice(0,4));const r=[];performEnemyDrawAction();r.push(enemyMana);performEnemyDrawAction();r.push(enemyMana);performEnemyDrawAction();r.push(enemyMana,enemyHp,enemyBloodManaBattleUses,enemyBloodManaUses);"
  "return {ok:r.join()==='8,4,0,96,1,0'&&enemyDrawActionsUsed===3&&enemyHand.length===3,r,used:enemyDrawActionsUsed};})()"),
 ("혈마나 2번째 사용부터는 마나 1당 체력 2에서 시작해 같은 턴 사용마다 1씩 오른다(턴이 바뀌면 되돌아간다)",
  "(()=>{enemyHp=100;enemyMana=0;enemyBloodManaBattleUses=1;enemyBloodManaUses=0;turnNumber=3;const q1=enemyBloodManaQuote(3);recordEnemyBloodManaUse();const q2=enemyBloodManaQuote(3);enemyBloodManaUses=0;const q3=enemyBloodManaQuote(3);enemyHp=6;const q4=enemyBloodManaQuote(3);"
  "return {ok:q1.rate===2&&q1.healthCost===6&&q2.rate===3&&q3.rate===2&&!q4.affordable,q1:q1.rate,q2:q2.rate,q3:q3.rate,aff:q4.affordable};})()"),
 ("카드 뽑기 제한: 손패 8장이면 뽑지 않고, 지불 뒤 체력이 1 이상 남아야 한다(체력 == 혈마나 비용이면 불가)",
  "(()=>{enemyHand.length=0;for(let i=0;i<8;i++)enemyHand.push(__q.champ());enemyMana=10;enemyDrawActionsUsed=0;const full=performEnemyDrawAction();enemyHand.length=0;enemyMana=0;enemyHp=2;enemyBloodManaBattleUses=0;enemyDrawActionsUsed=0;const dead=performEnemyDrawAction();"
  "return {ok:!full&&!dead&&enemyMana===0&&enemyHp===2,full,dead};})()"),
 ("컴퓨터 AI 판단: 손패에 낼 하수인이 없고 마나가 남으면 뽑고, 하수인이 충분하면 뽑지 않는다",
  "(()=>{enemyMana=6;enemyDrawActionsUsed=0;enemyHp=100;enemyHand.length=0;const none=enemyWantsDraw();enemyHand.push(__q.champ(),__q.champ(),__q.champ(),__q.champ());const plenty=enemyWantsDraw();enemyHand.length=0;enemyMana=0;enemyBloodManaBattleUses=0;enemyHp=100;const blood=enemyWantsDraw();enemyHp=30;const poor=enemyWantsDraw();"
  "return {ok:none&&!plenty&&blood&&!poor,none,plenty,blood,poor};})()"),
 ("필드 교체: 가득 찬 전장에서 더 강한 손패 하수인으로 가장 약한 카드를 교체하고, 마나 + 소환사 체력(새 카드 비용)을 내고 원래 카드는 묘지로 간다",
  "(()=>{const lane=__q.lane();__q.fill(5,1,1);const strong=__q.champ({cost:3,atk:9,atkFinal:9,hp:9,name:'강자',grade:{key:'a',label:'A급'}});enemyHand.length=0;enemyHand.push(strong);enemyMana=5;enemyHp=100;enemyGraveyard.length=0;"
  "const plan=enemyPlanReplace(lane);if(!plan)return {ok:false,why:'no plan'};enemyHand.splice(plan.index,1);replaceEnemyUnit(lane,plan.card,plan.target);const names=[...lane.querySelectorAll(':scope > .unit:not(.unit-dying) h4')].map(h=>h.textContent);"
  "return {ok:names.length===5&&names.includes('강자')&&enemyMana===2&&enemyHp===97&&enemyGraveyard.length===1,names,mana:enemyMana,hp:enemyHp,yard:enemyGraveyard.length};})()"),
 ("필드 교체 기준: 비슷한 카드, 체력이 모자란 경우, 소진자는 교체하지 않는다",
  "(()=>{const lane=__q.lane();__q.fill(5,5,5);const weakHand=__q.champ({cost:2,atk:5,atkFinal:5,hp:5});enemyHand.length=0;enemyHand.push(weakHand);enemyMana=5;enemyHp=100;const similar=enemyPlanReplace(lane);"
  "__q.fill(5,1,1);const strong=__q.champ({cost:3,atk:9,atkFinal:9,hp:9});enemyHand.length=0;enemyHand.push(strong);enemyHp=42;const lowHp=enemyPlanReplace(lane);enemyHp=100;[...lane.children].forEach(u=>u.dataset.ultimateSpent='true');const spent=enemyPlanReplace(lane);"
  "return {ok:!similar&&!lowHp&&!spent,similar:!!similar,lowHp:!!lowHp,spent:!!spent};})()"),
 ("공격 대상: 컴퓨터도 난이도와 무관하게 맨 왼쪽 하수인, 일반 도발이 있으면 도발 하수인, 소진자는 소환사(소진자 도발이 있으면 그쪽)",
  "(()=>{const mk=(extra={})=>{const u=document.createElement('div');u.className='unit';Object.assign(u.dataset,extra);u.innerHTML='<h4>x</h4><div class=\"stats\"><span>⚔ 3</span><span>♥ 3</span></div>';return u;};"
  "const attacker=mk(),spent=mk({ultimateSpent:'true'}),a=mk(),b=mk(),c=mk({taunt:'true'});const res=[];for(const d of ['normal','nightmare','hell']){enemyDifficulty=d;res.push(chooseEnemyAttackTarget(attacker,[a,b])===a,chooseEnemyAttackTarget(attacker,[a,b,c])===c,chooseEnemyAttackTarget(spent,[a,b,c])===null);}"
  "return {ok:res.every(Boolean),res};})()"),
 ("물 오라: 컴퓨터도 비용 2 이상 카드를 낼 때 확률로 마나를 회복하고, 회복은 이번 턴 최대 마나를 넘지 않는다",
  "(()=>{enemyGuardian='cheongryong';guardianProc=()=>true;enemyTurnMaxMana=5;enemyMana=1;enemyCardPlayedHook(1);const cheap=enemyMana;enemyCardPlayedHook(2);const after=enemyMana;enemyMana=5;enemyCardPlayedHook(3);const capped=enemyMana;"
  "return {ok:cheap===1&&after>1&&after<=5&&capped===5,cheap,after,capped};})()"),
 ("컴퓨터 턴 흐름: 낼 하수인이 없으면 실제 턴에서 카드 뽑기(로그)와 소환을 한 박자씩 이어서 하고, 손패·덱 라벨이 갱신된다",
  "(async()=>{enemyTurnsTaken=1;enemyTurnMaxMana=maxMana=10;turnNumber=4;enemyHp=100;enemyBloodManaBattleUses=0;enemyBloodManaUses=0;enemySetMagic.length=0;enemyUltimate=null;__q.lane().innerHTML='';"
  "const champs=enemyOriginalDeck.filter(d=>!d.spell&&d.cost<=2).slice(0,8);enemyHand.length=0;enemyDeck.length=0;enemyDeck.push(...champs.map(d=>({...d})));"
  "let finished=false;enemyTurn(()=>{finished=true;});for(let i=0;i<200&&!finished;i++)await __q.wait(100);await __q.wait(200);"
  "const log=document.querySelector('.log').textContent;const units=__q.lane().querySelectorAll(':scope > .unit:not(.unit-dying)').length;const label=document.querySelector('#enemy-deck-label').textContent;"
  "return {ok:finished&&log.includes('상대가 카드 뽑기')&&units>=1&&label==='덱 '+enemyDeck.length+'장 · 손패 '+enemyHand.length+'장',finished,drew:log.includes('상대가 카드 뽑기'),units,label};})()"),
 ("유저 자동 드로우도 손패 8장이면 뽑지 않는다(양쪽 동일)",
  "(()=>{const hand=document.querySelector('.hand');while(hand.querySelectorAll('.card').length<8)hand.appendChild(createRuntimeBattleCard(collectionCardDefs.find(d=>d.cardType==='champion').cardId));const d=deck.length;startPlayerTurn(document.querySelector('.turn-actions .end'));"
  "return {ok:deck.length===d&&hand.querySelectorAll('.card').length===8,deck:deck.length,d};})()"),
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
            pg.goto(base + URL_Q); pg.wait_for_function("typeof battlePhase!=='undefined'&&battlePhase==='setup'", timeout=15000)
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
    print("OK: 컴퓨터 규칙 동일화 확인" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)


main()
