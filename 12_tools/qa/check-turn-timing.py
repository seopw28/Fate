#!/usr/bin/env python3
"""턴 타이밍 규칙 브라우저 검사 (2026-11-07 PM 결정).

1. 세팅한 마법은 그 턴에 턴 종료를 누르는 즉시 발동하고, 정산이 끝난 뒤 내 챔프가 공격한다.
2. 궁극기는 세팅한 턴에는 '다음 턴부터 발동'으로 잠기고, 내 다음 턴에 열린다. 컴퓨터도 같다.
3. 오라 각성은 체력 85 이하에서 열린다.
자기 트리의 dist 를 serve_own_tree 로 띄운다(남의 번들을 재지 않는다).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

URL_Q = "/index.html?skipIntro&difficulty=normal&guardian=jujak&seed=777"

PRELUDE = """
window.__phases=[];const __sp=setBattlePhase;setBattlePhase=function(p){__phases.push(p);return __sp.apply(this,arguments);};
window.__card=(id)=>{const c=createRuntimeBattleCard(id);document.querySelector('.hand').appendChild(c);return c;};
window.__wait=ms=>new Promise(r=>setTimeout(r,ms));
window.__logs=[];const __wl=writeLog;writeLog=function(m){__logs.push(String(m));return __wl.apply(this,arguments);};
"""

CHECKS = [
 ("마법: 세팅한 턴에 턴 종료를 누르면 내 챔프 공격보다 먼저 발동하고 슬롯이 비워진다",
  """(async()=>{battlePhase='setup';maxMana=mana=10;updateMana();const c=__card('core.spring-of-restoration');setHandFilter('spell');playCard(c);if(!setMagicCards.length)playCard(c);
  const setOk=setMagicCards.length===1&&setMagicCards[0].kind==='active';const slotText=document.querySelector('#magic-slot-0')?.textContent||'';
  __phases.length=0;endTurn(document.querySelector('.turn-actions .end'));
  for(let i=0;i<100&&!__phases.includes('player-combat');i++)await __wait(100);
  const firedAt=__phases.indexOf('magic-resolving'),combatAt=__phases.indexOf('player-combat');
  const log=__logs.join(' ');
  return {ok:setOk&&/턴 종료 시 자동 발동/.test(slotText)&&setMagicCards.length===0&&firedAt>=0&&combatAt>firedAt&&log.includes('턴 종료와 함께 자동 발동'),setOk,slotText,phases:__phases.slice(0,4),left:setMagicCards.length};})()"""),
 ("마법: 대기 턴이 지정된 카드(대재앙 5턴)는 세팅한 턴 종료에는 발동하지 않고 남은 턴을 표시한다",
  """(async()=>{battlePhase='setup';maxMana=mana=10;updateMana();const c=__card('storm.great-ruin');setHandFilter('spell');playCard(c);if(!setMagicCards.length)playCard(c);
  const m=setMagicCards[0];const slotText=document.querySelector('#magic-slot-0')?.textContent||'';
  const due=setMagicCards.filter(x=>x.kind==='active'&&(x.fireTurn??turnNumber)<=turnNumber).length;
  return {ok:!!m&&m.fireTurn===turnNumber+4&&due===0&&/발동까지 4턴/.test(slotText),fireTurn:m?.fireTurn,turnNumber,slotText,due};})()"""),
 ("궁극기: 세팅한 턴에는 '다음 턴부터 발동'으로 잠기고 발동 버튼도 막힌다. 내 다음 턴에는 열린다",
  """(async()=>{battlePhase='setup';playerHp=70;awakenGateOpened.player=true;maxMana=mana=10;updateMana();
  const id=collectionCardDefs.find(d=>d.cardType==='champion'&&d.aura!=='fire').cardId;const c=__card(id);setUltimate(c);renderUltimate();
  const same=ultimateLockReason(),btn=document.querySelector('#field-ultimate-action'),btnDisabled=btn?btn.disabled:null;
  const fired=fireUltimateAction();const still=!!ultimateState;
  advanceUltimateLedger('player');mana=maxMana;const next=ultimateLockReason();
  return {ok:same==='다음 턴부터 발동'&&btnDisabled===true&&fired===false&&still&&next==='',same,btnDisabled,fired,still,next};})()"""),
 ("컴퓨터 궁극기: 장착한 턴에는 발동하지 않고, 다음 상대 턴에 발동한다",
  """(async()=>{const proto=enemyDeck.find(d=>!d.spell);enemyHand.length=0;enemyHand.push({...proto,atkFinal:proto.atk});
  enemyHp=70;awakenGateOpened.enemy=true;enemyUltimate=null;equipEnemyUltimate();const equipped=!!enemyUltimate;
  enemyTurnMaxMana=maxMana=7;enemyMana=7;const first=castEnemyUltimate();advanceUltimateLedger('enemy');enemyMana=7;const second=castEnemyUltimate();
  return {ok:equipped&&first===false&&second===true,equipped,first,second};})()"""),
 ("컴퓨터 마법: 세팅한 상대 턴이 끝날 때(교전 직전) 발동한다",
  """(async()=>{const spell=enemyDeck.find(d=>d.spell&&!d.trap&&(d.delay||1)===1)||enemyOriginalDeck.find(d=>d.spell&&!d.trap&&(d.delay||1)===1);
  if(!spell)return {ok:false,error:'no enemy spell'};enemySetMagic.length=0;enemySetMagic.push({...spell,readyTurn:turnNumber+1,fireAt:ultimateLedger.enemy.turns});
  const n=await resolveEnemySetMagic();return {ok:n===1&&enemySetMagic.length===0,n,left:enemySetMagic.length};})()"""),
 ("오라 각성: 체력 86에서는 잠기고 85에서 열린다",
  """(()=>{playerHp=86;const r86=guardianAwakenLockReason();playerHp=85;const r85=guardianAwakenLockReason();
  return {ok:GUARDIAN_AWAKEN_HP===85&&r86==='체력 85 이하에서 각성'&&r85==='',r86,r85};})()"""),
]


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
    print("OK: 턴 타이밍 규칙 확인" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)


main()
