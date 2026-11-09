#!/usr/bin/env python3
"""턴 타이밍 규칙 브라우저 검사 (2026-11-07 PM 결정).

1. 마법은 손패에서 더블클릭하면 마나로만 즉시 발동한다. 함정은 폐지돼 세팅 자리는 묘지 회수 1칸이고, 대재앙은 더블클릭하면 5턴 대기 마법으로 걸린다 (2026-11-09).
2. 궁극기는 세팅한 턴에는 '다음 턴부터 발동'으로 잠기고, 내 다음 턴에 열린다. 컴퓨터도 같다.
3. 오라 각성은 체력 85 이하에서 열린다.
4. 중앙 스킬 소개가 있는 마법은 소개가 끝난 뒤 피해와 효과가 들어간다 (2026-11-08).
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
 ("마법: 한 번 클릭은 선택만, 더블클릭하면 마나만 써서 즉시 발동한다(슬롯을 거치지 않음)",
  """(async()=>{battlePhase='setup';maxMana=mana=10;updateMana();setHandFilter('spell');const c=__card('core.spring-of-restoration');const cost=Number(c.querySelector('.cost').textContent);
  playCard(c);const selectedOnly=c.isConnected&&c.classList.contains('selected')&&setMagicCards.length===0&&mana===10;
  c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));const gone=!c.isConnected,paid=mana===10-cost;
  for(let i=0;i<60&&battlePhase!=='setup';i++)await __wait(100);const log=__logs.join(' ');
  return {ok:selectedOnly&&gone&&paid&&battlePhase==='setup'&&setMagicCards.length===0&&log.includes('발동했습니다'),selectedOnly,gone,paid,phase:battlePhase};})()"""),
 ("마법: 마나가 모자라면 혈마나로 대신 내지 못하고 발동하지 않는다",
  """(async()=>{battlePhase='setup';turnNumber=9;maxMana=10;mana=1;playerHp=100;updateMana();setHandFilter('spell');const c=__card('core.crimson-bolt');updateCardAffordability();
  const dim=c.classList.contains('unaffordable')&&!c.classList.contains('blood-option');c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await __wait(300);
  return {ok:dim&&c.isConnected&&mana===1&&playerHp===100,dim,still:c.isConnected,mana,hp:playerHp};})()"""),
 ("세팅 슬롯 자리는 묘지 회수 1칸뿐이다 (함정 슬롯 폐지, 2026-11-09)",
  """(()=>{const slots=[...document.querySelectorAll('.set-slot')].map(s=>s.id);return {ok:slots.length===1&&slots[0]==='grave-recall'&&MAGIC_SLOT_KINDS.length===0,slots};})()"""),
 ("대재앙: 손패에서 더블클릭하면 숨은 대기 마법으로 5턴을 세고, 대기 턴이 찬 내 턴 시작에 양쪽 하수인을 모두 파괴한다 (함정 폐지 뒤, 2026-11-09)",
  """(async()=>{battlePhase='setup';maxMana=mana=10;updateMana();summonBattleToken('아군',2,5,'earth');setHandFilter('spell');const c=__card('storm.great-ruin');const cost=Number(c.querySelector('.cost').textContent);
  c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));for(let i=0;i<40&&battlePhase!=='setup';i++)await __wait(100);await __wait(300);
  const m=setMagicCards.find(x=>x.effect==='global-destroy'),paid=mana===10-cost,wait=m?m.readyTurn-turnNumber:null;const early=triggerTrap('field_state');const stillSet=setMagicCards.includes(m);
  turnNumber=m.readyTurn;triggerTrap('field_state');await __wait(5000);/* 안내 → 중앙 소개 1.7초 → 파괴 */const left=document.querySelectorAll('.summon-zone .unit:not([data-destroyed="true"])').length;
  return {ok:!!m&&paid&&wait===5&&stillSet&&!setMagicCards.includes(m)&&left===0,found:!!m,paid,wait,stillSet,left};})()"""),
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
 ("컴퓨터 마법: 칸 제한 없이 마나 안에서 쓰고 그 자리에서 바로 발동한다",
  """(async()=>{const spell=enemyDeck.find(d=>d.spell&&!d.trap&&(d.delay||1)===1)||enemyOriginalDeck.find(d=>d.spell&&!d.trap&&(d.delay||1)===1);
  if(!spell)return {ok:false,error:'no enemy spell'};enemySetMagic.length=0;enemySetMagic.push({...spell,readyTurn:turnNumber+1,fireAt:ultimateLedger.enemy.turns});
  const n=await resolveEnemySetMagic();
  const s2=enemyOriginalDeck.filter(d=>d.spell&&!d.trap).slice(0,3);enemyHand.length=0;s2.forEach(d=>enemyHand.push({...d,cost:1}));enemyMana=10;setEnemyMagic();const queued=enemySetMagic.filter(x=>!x.trap).length;const n2=await resolveEnemySetMagic();
  return {ok:n===1&&queued===s2.length&&n2===s2.length&&enemySetMagic.length===0,n,queued,n2,left:enemySetMagic.length};})()"""),
 ("마법: 중앙 스킬 소개가 있는 모든 마법은 소개가 한 번 나오고 내려간 뒤에 피해와 효과가 들어간다",
  """(async()=>{const ids=collectionCardDefs.filter(d=>d.cardType==='spell').map(d=>d.cardId).filter(id=>spellCinematicFor(createRuntimeBattleCard(id)));const bad=[];
  const lane=document.querySelector('.arena .lane:first-child');
  for(const id of ids){document.querySelectorAll('.arena .unit').forEach(u=>u.remove());summonBattleToken('아군',2,30,'earth');enemySummonUnit(lane,{el:'fire',name:'적',atk:3,hp:40,cost:3});enemySummonUnit(lane,{el:'fire',name:'적2',atk:2,hp:40,cost:3});
  playerHp=enemyHp=80;updateHeroHealth();await __wait(300);const ev=[];const t0=performance.now(),T=()=>performance.now()-t0;
  const mo=new MutationObserver(ms=>ms.forEach(m=>{m.addedNodes.forEach(n=>{if(n.classList?.contains('cinematic-skill-fx'))ev.push(['in',T()]);});m.removedNodes.forEach(n=>{if(n.classList?.contains('cinematic-skill-fx'))ev.push(['out',T()]);});}));mo.observe(document.body,{childList:true});
  const dU=damageUnit;damageUnit=function(){ev.push(['dmg',T()]);return dU.apply(this,arguments);};const hp0=[playerHp,enemyHp];const iv=setInterval(()=>{if(playerHp!==hp0[0]||enemyHp!==hp0[1]){ev.push(['hero',T()]);clearInterval(iv);}},20);
  battlePhase='setup';maxMana=mana=20;updateMana();const c=__card(id);await castHandSpell(c);await __wait(800);mo.disconnect();damageUnit=dU;clearInterval(iv);
  const ins=ev.filter(e=>e[0]==='in'),out=ev.find(e=>e[0]==='out'),hit=ev.find(e=>e[0]==='dmg'||e[0]==='hero');if(ins.length!==1||!out||(hit&&hit[1]<out[1]))bad.push({id,ev:ev.map(e=>e[0]+Math.round(e[1])).join(' ')});}
  return {ok:ids.length>=20&&bad.length===0,count:ids.length,bad};})()"""),
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
