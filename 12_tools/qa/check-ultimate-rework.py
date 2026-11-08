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
  // 궁극기는 세팅한 다음 턴부터 발동한다(2026-11-07). 검사에서 '다음 턴이 된 상태'를 만든다
  ripe:()=>{if(ultimateState)ultimateState.equippedLedgerTurn=ultimateLedger.player.turns-1;if(enemyUltimate)enemyUltimate.equippedLedgerTurn=ultimateLedger.enemy.turns-1;},
  ready:()=>{playerHp=70;awakenGateOpened.player=true;summonBattleToken('제물',2,5,'earth');mana=maxMana;updateMana();},
};
"""

CHECKS = [
 ("오라 각성 선택 전에는 궁극기를 세팅할 수 없고, 사유가 패널에 표시된다",
  "(()=>{const c=__q.card(__q.notFireId);playerHp=100;setUltimate(c);__q.ripe();const blocked=!ultimateState&&c.isConnected;const reason=ultimateSettingLockReason();"
  "renderUltimate();const btn=document.querySelector('#ultimate-panel .ultimate-slot-empty');"
  "return {ok:blocked&&reason==='오라 각성 후 세팅 가능'&&btn.disabled&&btn.textContent.includes(reason),blocked,reason,btn:btn.textContent};})()"),
 ("체력이 85 이하여도 각성 선택 전에는 닫혀 있고, 오라 각성 선택을 마치면 열린다(체력을 회복해도 유지)",
  "(()=>{playerHp=70;const before=ultimateSettingLockReason();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();const blocked=!ultimateState;chooseGuardianAwakening('A');playerHp=100;const after=ultimateSettingLockReason();setUltimate(c);__q.ripe();"
  "return {ok:before==='오라 각성 후 세팅 가능'&&blocked&&after===''&&!!ultimateState,before,blocked,after};})()"),
 ("세팅하면 대전 덱의 같은 카드를 모두 묘지로 보낸다. 취소해도 손패로 돌아올 뿐 덱 사본은 돌아오지 않는다",
  "(()=>{playerHp=70;awakenGateOpened.player=true;const c=__q.card(__q.notFireId),art=cardArtwork(c),proto=deck.find(d=>!d.spell);deck.push({...proto,art},{...proto,art});const before=deck.filter(d=>d.art===art).length,gy0=allyGraveyard.length;"
  "setUltimate(c);__q.ripe();const after=deck.filter(d=>d.art===art).length,gy=allyGraveyard.filter(d=>d.art===art).length;const handBefore=document.querySelectorAll('.hand .card').length;cancelUltimate();"
  "const back=document.querySelectorAll('.hand .card').length===handBefore+1&&!ultimateState;return {ok:before>=2&&after===0&&gy===before&&allyGraveyard.length===gy0+before&&back&&deck.filter(d=>d.art===art).length===0,before,after,gy,back};})()"),
 ("세팅한 턴에는 잠기고(다음 턴부터 발동) 그 뒤로는 마나만 맞으면 발동된다. 강한 카드 분류는 없고 비용은 내 최대 마나다",
  "(async()=>{playerHp=70;turnNumber=1;__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);const sameTurn=ultimateLockReason();__q.ripe();const cost=ultimateState.cost,max=maxMana,lock=ultimateLockReason();mana=max-1;const short=ultimateLockReason();mana=max;"
  "return {ok:sameTurn==='다음 턴부터 발동'&&cost===max&&lock===''&&short==='마나 '+max+' 필요'&&!('minTurn' in ultimateState)&&!('strong' in ultimateState),sameTurn,cost,max,lock,short};})()"),
 ("혈마나는 궁극기에 쓸 수 없다(마나가 모자라면 체력을 내도 발동 불가)",
  "(()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();turnNumber=20;mana=maxMana-1;const hp=playerHp;fireUltimateAction();return {ok:!!ultimateState&&playerHp===hp&&!__q.spent(),hp:playerHp};})()"),
 ("제물 조건: 전장 0장·3장이면 제물 없이 맨 오른쪽 빈 자리에 배치, 5장(가득 참)일 때만 맨 오른쪽 챔프가 제물로 묘지행",
  "(async()=>{playerHp=70;awakenGateOpened.player=true;const lane=document.querySelector('.summon-zone');const run=async(n)=>{lane.innerHTML='';allyGraveyard.length=0;ultimateLedger.player.spent=null;ultimateState=null;const names=[];for(let i=0;i<n;i++){summonBattleToken('아군'+i,2,5,'earth');names.push('아군'+i);}mana=maxMana;const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();const reasonBefore=ultimateLockReason();fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);setBattlePhase('setup');const units=[...lane.querySelectorAll(':scope > .unit:not(.unit-dying)')];return {n,reasonBefore,count:units.length,lastSpent:units.at(-1)?.dataset.effect==='ultimate-spent',names:units.map(u=>u.querySelector('h4').textContent),grave:allyGraveyard.map(g=>g.name)};};"
  "const r0=await run(0),r3=await run(3),r6=await run(5);"
  "return {ok:r0.reasonBefore===''&&r0.count===1&&r0.lastSpent&&r3.reasonBefore===''&&r3.count===4&&r3.lastSpent&&r3.names.slice(0,3).join()==='아군0,아군1,아군2'&&!r3.grave.includes('아군2')&&r6.count===5&&r6.lastSpent&&!r6.names.includes('아군4')&&r6.grave.includes('아군4'),r0,r3,r6};})()"),
 ("컴퓨터도 같은 제물 조건: 전장 0장이어도 발동, 3장이면 제물 없이 4번째, 5장(가득 참)이면 맨 오른쪽 제물",
  "(async()=>{const proto=enemyDeck.find(d=>!d.spell);const lane=document.querySelector('.arena .lane:first-child');awakenGateOpened.enemy=true;enemyHp=70;enemyTurnMaxMana=maxMana=5;const run=async(n)=>{lane.innerHTML='';enemyGraveyard.length=0;ultimateLedger.enemy.spent=null;for(let i=0;i<n;i++)enemySummonUnit(lane,{name:'적'+i,art:proto.art,el:'earth',atk:2,hp:5,cost:1});enemyMana=5;enemyUltimate=enemyUltimateSpec({...proto,atkFinal:proto.atk});const ok=castEnemyUltimate();await enemyUltimateCasting;const units=[...lane.querySelectorAll(':scope > .unit:not(.unit-dying)')];return {n,ok,count:units.length,lastSpent:units.at(-1)?.dataset.effect==='ultimate-spent',grave:enemyGraveyard.length};};"
  "const r0=await run(0),r3=await run(3),r6=await run(5);"
  "return {ok:r0.ok&&r0.count===1&&r0.lastSpent&&r0.grave===0&&r3.ok&&r3.count===4&&r3.lastSpent&&r3.grave===0&&r6.ok&&r6.count===5&&r6.lastSpent&&r6.grave===1,r0,r3,r6};})()"),
 ("소진자: 카드 기본 공격력 +7 / 체력 1 / 130% / 즉시 공격 가능 / 맨 오른쪽 고정 / 전역 도발",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();const base=ultimateState.baseAttack;fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();const lane=document.querySelector('.summon-zone');"
  "const r={atk:u&&__q.atk(u),hp:u&&__q.hp(u),exhausted:u?.classList.contains('exhausted'),last:u===lane.lastElementChild,scale:u&&getComputedStyle(u).scale,locked:u?.dataset.orderLocked,aggro:u?.dataset.ultimateAggro,base};"
  "return {ok:!!u&&r.atk===base+7&&r.hp===1&&r.exhausted===false&&r.last&&r.scale==='1.3'&&r.locked==='true'&&r.aggro==='true'&&battlePhase==='setup',...r};})()"),
 ("오라 공명(카드 성격 = 내 오라 불): 비용 −2, 소진자는 +7/1로 내려온 뒤 오라 강하 연출에서 +5/+3을 받아 기본 공격력 +12 / 체력 4",
  "(async()=>{__q.ready();maxMana=6;mana=6;const c=__q.card(__q.fireId);setUltimate(c);__q.ripe();const base=ultimateState.baseAttack,cost=ultimateState.cost,res=auraUltimateMatch(ultimateState);fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);"
  "const u=__q.spent(),before={atk:__q.atk(u),hp:__q.hp(u)},locked=battlePhase==='ultimate-resolving';await __q.wait(RESONANCE_DESCENT_MS+150);"
  "return {ok:res&&cost===4&&mana===2&&before.atk===base+7&&before.hp===1&&locked&&__q.atk(u)===base+12&&__q.hp(u)===4&&u.dataset.maxHp==='4'&&battlePhase==='setup',res,cost,mana,before,locked,atk:__q.atk(u),hp:__q.hp(u),base};})()"),
 ("소진자가 안 죽으면 다음 궁극기를 세팅할 수 없고 잠금 사유가 표시된다",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);setBattlePhase('setup');" + (WAIT % 50) +
  "const c2=__q.card(__q.notFireId);turnNumber+=10;setUltimate(c2);__q.ripe();const reason=ultimateSettingLockReason();renderUltimate();const btn=document.querySelector('#ultimate-panel .ultimate-slot-empty');"
  "return {ok:!ultimateState&&reason==='소진자 생존 중'&&btn.disabled&&btn.textContent.includes('소진자 생존 중'),reason,btn:btn.textContent};})()"),
 ("복수자: 소진자가 쓰러진 뒤 내 턴 시작 3번째에 강림한다(+7 공격 / +15 체력, 130%), 그 전에는 세팅 잠금 · 강림 후 해제",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();const base=ultimateState.baseAttack,baseHp=ultimateState.baseHp;fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();damageUnit(u,99,'fire');u.dataset.destroyed='true';" + (WAIT % 60) + "setTimeout(()=>u.remove(),0);const turns0=ultimateLedger.player.turns,due=ultimateLedger.player.pending[0]?.due;"
  "const lock0=ultimateSettingLockReason();fxClear?.();const btn=__q.endBtn();"
  "startPlayerTurn(btn);const afterOne={avenger:!!__q.avenger(),lock:ultimateSettingLockReason()};fxClear?.();"
  "startPlayerTurn(btn);const afterTwo={avenger:!!__q.avenger(),lock:ultimateSettingLockReason()};fxClear?.();startPlayerTurn(btn);" + (WAIT % 400) + "const a=__q.avenger();"
  "const sc=getComputedStyle(a).scale,aa=__q.atk(a),ah=__q.hp(a);const lockAlive=ultimateSettingLockReason();damageUnit(a,99,'fire');a.dataset.destroyed='true';" + (WAIT % 60) + "a.remove();const c0=ultimateLedger.player.cooldownUntil-ultimateLedger.player.turns,lockDead=ultimateSettingLockReason();startPlayerTurn(btn);fxClear?.();const lockDead1=ultimateSettingLockReason();startPlayerTurn(btn);const lockOpen=ultimateSettingLockReason();"
  "const r={afterTwo,lockAlive,lockDead,lockDead1,lockOpen,due,turns0,lock0,afterOne,atk:aa,hp:ah,scale:sc,lockAfter:lockAlive,arrived:ultimateLedger.player.arrived,base,baseHp};"
  "return {ok:due===turns0+3&&lock0==='복수자 강림까지 3턴'&&afterOne.avenger===false&&afterOne.lock==='복수자 강림까지 2턴'&&afterTwo.avenger===false&&afterTwo.lock==='복수자 강림까지 1턴'&&!!a&&r.atk===base+7&&r.hp===baseHp+15&&r.scale==='1.3'&&r.lockAfter==='복수자 생존 중'&&lockAlive==='복수자 생존 중'&&lockDead==='다음 세팅까지 2턴'&&lockDead1==='다음 세팅까지 1턴'&&lockOpen===''&&r.arrived===1,...r};})()"),
 ("복수자의 외형은 덱 구성에서 빌려 오며 덱에서 카드를 빼지 않는다(턴 시작 기본 드로우 1장만 줄어든다)",
  "(async()=>{__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();damageUnit(u,99,'fire');u.dataset.destroyed='true';" + (WAIT % 60) + "u.remove();const btn=__q.endBtn();"
  "__q.trim();startPlayerTurn(btn);fxClear?.();startPlayerTurn(btn);fxClear?.();const d1=deck.length;__q.trim();startPlayerTurn(btn);const d2=deck.length;" + (WAIT % 60) +
  "const a=__q.avenger(),names=new Set(collectionState.deck.map(i=>collectionCards[i][2]));return {ok:!!a&&d1-d2===1&&names.has(a.querySelector('h4').textContent),d1,d2,name:a?.querySelector('h4').textContent};})()"),
 ("복수자가 두 번째로 등장한 뒤부터 내 턴 시작에 1장 추가 드로우(손패 8장·덱 비면 생략)",
  "(()=>{const btn=__q.endBtn();const draw=(arrived,handTrim)=>{ultimateLedger.player.arrived=arrived;__q.trim();if(handTrim)while(document.querySelectorAll('.hand .card').length<7)__q.card(__q.notFireId);const d=deck.length;startPlayerTurn(btn);return d-deck.length;};"
  "const one=draw(1,false),two=draw(2,false),full=draw(2,true);const e=deck.splice(0,deck.length-1);__q.trim();ultimateLedger.player.arrived=2;const lastDeck=deck.length;startPlayerTurn(btn);"
  "return {ok:one===1&&two===2&&full<=1,one,two,full,lastDeck};})()"),
 ("자동 드로우는 묘지를 재사용하지 않는다(덱이 비면 그냥 건너뜀)",
  "(()=>{__q.trim();const p=deck.find(d=>!d.spell);allyGraveyard.length=0;allyGraveyard.push(graveRecordFromDeckCard(p),graveRecordFromDeckCard(p));deck.length=0;playerHp=50;drawCard();"
  "return {ok:playerHp===50&&deck.length===0&&allyGraveyard.length===2,hp:playerHp,deck:deck.length};})()"),
 ("카드 뽑기: 덱에 챔프가 없으면 예/아니오를 묻고, 예면 체력 10으로 묘지 챔프(소진자·복수자 제외)를 덱에 섞은 뒤 이어서 뽑는다",
  "(()=>{setBattlePhase('setup');[...document.querySelectorAll('.hand .card')].forEach(c=>c.remove());const protos=deck.filter(d=>!d.spell).slice(0,3),spells=deck.filter(d=>d.spell).slice(0,2);allyGraveyard.length=0;protos.forEach(p=>allyGraveyard.push(graveRecordFromDeckCard(p)));allyGraveyard.push({name:'소진자',art:protos[0].art,element:'fire',attack:20,maxHp:1,effect:'ultimate-spent'},{name:'복수자',art:protos[1].art,element:'fire',attack:9,maxHp:20,effect:'ultimate-avenger'});"
  "deck.length=0;deck.push(...spells);playerHp=50;drawActionsUsed=0;mana=10;updateMana();const modal=document.querySelector('#recycle-modal');useDrawAction();const asked=modal.classList.contains('show')&&playerHp===50&&mana===10;answerRecyclePrompt(true);"
  "const left=allyGraveyard.map(x=>x.effect);return {ok:asked&&!modal.classList.contains('show')&&playerHp===40&&deck.length===4&&mana===8&&document.querySelectorAll('.hand .summon-card').length===1&&left.length===2&&left.every(e=>/ultimate-(spent|avenger)/.test(e)),asked,hp:playerHp,deck:deck.length,mana,left};})()"),
 ("카드 뽑기: 아니오면 재사용 없이 남은 덱에서 뽑고, 덱이 비어 있으면 아무것도 하지 않는다(마나도 쓰지 않음)",
  "(()=>{setBattlePhase('setup');__q.trim();const p=deck.find(d=>!d.spell),spells=deck.filter(d=>d.spell).slice(0,2);allyGraveyard.length=0;allyGraveyard.push(graveRecordFromDeckCard(p));deck.length=0;deck.push(...spells);playerHp=50;drawActionsUsed=0;mana=10;updateMana();"
  "useDrawAction();answerRecyclePrompt(false);const a={hp:playerHp,deck:deck.length,mana};__q.trim();deck.length=0;drawActionsUsed=0;mana=10;useDrawAction();const asked=document.querySelector('#recycle-modal').classList.contains('show');answerRecyclePrompt(false);"
  "return {ok:a.hp===50&&a.deck===1&&a.mana===8&&asked&&playerHp===50&&deck.length===0&&mana===10&&allyGraveyard.length===1,a,asked,hp:playerHp,deck:deck.length,mana};})()"),
 ("묘지 재사용 체력 경계: 11이면 묻고 예→1, 10 이하면 묻지 않고 남은 덱에서 그냥 뽑는다",
  "(()=>{setBattlePhase('setup');const p=deck.find(d=>!d.spell),sp=deck.find(d=>d.spell);const seed=hp=>{__q.trim();allyGraveyard.length=0;allyGraveyard.push(graveRecordFromDeckCard(p),graveRecordFromDeckCard(p));deck.length=0;deck.push(sp);playerHp=hp;drawActionsUsed=0;mana=10;updateMana();};const modal=document.querySelector('#recycle-modal');"
  "seed(11);useDrawAction();const asked11=modal.classList.contains('show');answerRecyclePrompt(true);const at11={hp:playerHp,deck:deck.length};seed(10);useDrawAction();const asked10=modal.classList.contains('show');const at10={hp:playerHp,deck:deck.length};"
  "return {ok:asked11&&at11.hp===1&&at11.deck===2&&!asked10&&at10.hp===10&&at10.deck===0,asked11,at11,asked10,at10};})()"),
 ("컴퓨터도 카드 뽑기 행동에서만, 같은 조건(덱에 챔프 없음·체력 10 초과)이면 묘지 챔프를 덱에 섞는다(예). 자동 드로우는 재사용하지 않는다",
  "(()=>{const p=enemyDeck.find(d=>!d.spell),sp=enemyDeck.find(d=>d.spell);enemyGraveyard.length=0;enemyGraveyard.push(graveRecordFromDeckCard(p),graveRecordFromDeckCard(p),{name:'소진자',art:p.art,effect:'ultimate-spent'});enemyDeck.length=0;enemyDeck.push(sp);enemyHand.length=0;enemyHp=50;enemyMana=10;enemyDrawActionsUsed=0;enemyTurnsTaken=1;"
  "enemyAutoDraw();const auto={hp:enemyHp,deck:enemyDeck.length,yard:enemyGraveyard.length,hand:enemyHand.length};enemyHand.length=0;enemyDeck.length=0;enemyDeck.push(sp);performEnemyDrawAction();"
  "const a={hp:enemyHp,deck:enemyDeck.length,champ:enemyHand.filter(c=>!c.spell).length,mana:enemyMana};enemyGraveyard.length=0;enemyGraveyard.push(graveRecordFromDeckCard(p));enemyDeck.length=0;enemyHp=10;enemyHand.length=0;enemyMana=10;enemyDrawActionsUsed=0;const drew=performEnemyDrawAction();const b={hp:enemyHp,deck:enemyDeck.length,drew,mana:enemyMana};enemyHp=50;enemyDrawActionsUsed=0;"
  "return {ok:auto.hp===50&&auto.deck===0&&auto.yard===3&&auto.hand===1&&a.hp===40&&a.deck===2&&a.champ===1&&a.mana===8&&b.hp===10&&b.deck===0&&!b.drew&&b.mana===10,auto,a,b};})()"),
 ("BGM: 체력 40 이하만으로는 바뀌지 않고, 어느 쪽이든 복수자가 처음 등장하면 각성곡으로 바뀌어 유지된다",
  "(async()=>{playerHp=30;enemyHp=30;" + (WAIT % 700) + "const before=bgm===bgmTracks.main;__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();fireUltimateAction();await __q.wait(ULTIMATE_EFFECT_DELAY+80);setBattlePhase('setup');" + (WAIT % 50) +
  "const u=__q.spent();damageUnit(u,99,'fire');u.dataset.destroyed='true';" + (WAIT % 60) + "u.remove();const btn=__q.endBtn();startPlayerTurn(btn);fxClear?.();startPlayerTurn(btn);fxClear?.();const mid=bgm===bgmTracks.main;startPlayerTurn(btn);" + (WAIT % 60) +
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
 ("컴퓨터 대칭: 각성 전 세팅 불가 → 열리면 장착(덱 사본 처리) → 비용 = 최대 마나 → 소진자 +7/1(공명이면 +12/4) → 쓰러지면 2번째 턴에 +7/+15 복수자",
  "(async()=>{const proto=enemyDeck.find(d=>!d.spell);const base=baseCardStatsByArt(proto.art);enemyHand.length=0;enemyHand.push({...proto,atkFinal:proto.atk});enemyDeck.push({...proto},{...proto});"
  "enemyHp=100;enemyUltimate=null;equipEnemyUltimate();const closed=!enemyUltimate;enemyHp=70;awakenGateOpened.enemy=true;equipEnemyUltimate();const equipped=!!enemyUltimate,left=enemyDeck.filter(d=>d.art===proto.art).length;"
  "enemyTurnMaxMana=maxMana=7;enemyMana=7;summonBattleToken;const lane=document.querySelector('.arena .lane:first-child');enemySummonUnit(lane,{name:'제물',art:proto.art,el:'earth',atk:2,hp:5,cost:1});"
  "const cost=enemyUltimateManaCost(enemyUltimate),res=enemyAuraUltimateMatch(enemyUltimate);__q.ripe();castEnemyUltimate();await enemyUltimateCasting;" + (WAIT % 200) +
  "const s=lane.querySelector('.unit[data-effect=\"ultimate-spent\"]');const sAtk=__q.atk(s),sHp=__q.hp(s),ex=s.classList.contains('exhausted');"
  "const mana=enemyMana;damageUnit(s,99,'fire');s.dataset.destroyed='true';" + (WAIT % 60) + "s.remove();const pend=ultimateLedger.enemy.pending[0]?.due-ultimateLedger.enemy.turns;const lock=ultimateSettingLockReason('enemy');"
  "advanceUltimateLedger('enemy');advanceUltimateLedger('enemy');const noneYet=!lane.querySelector('.unit[data-effect=\"ultimate-avenger\"]');advanceUltimateLedger('enemy');" + (WAIT % 60) +
  "const a=lane.querySelector('.unit[data-effect=\"ultimate-avenger\"]');"
  "const ex2={closed,equipped,left,cost,res,mana,sAtk,sHp,ex,pend,lock,noneYet,aAtk:a&&__q.atk(a),aHp:a&&__q.hp(a),base};"
  "return {ok:closed&&equipped&&left===0&&cost===(res?5:7)&&mana===7-cost&&sAtk===base.atk+(res?12:7)&&sHp===(res?4:1)&&ex===false&&pend===3&&lock==='복수자 강림까지 3턴'&&noneYet&&!!a&&ex2.aAtk===base.atk+7&&ex2.aHp===base.hp+15,...ex2};})()"),
 ("5칸 가득 찬 전장(양쪽 130% 소진자·복수자 포함): 카드끼리·독(각성/궁극기 표시)·마나 바와 겹침 0, 전장 밖으로 안 나가고 카드 사이 간격이 있다",
  "(async()=>{const el=document.querySelector('.arena .lane:first-child'),zo=document.querySelector('.summon-zone');el.innerHTML='';zo.innerHTML='';const proto=enemyDeck.find(d=>!d.spell);"
  "const en=(name,effect)=>enemySummonUnit(el,{name,art:proto.art,el:'water',atk:20,hp:3,cost:1,effect});en('적1');en('적2');en('적3','ultimate-avenger');en('적4','ultimate-spent');en('적5');"
  "summonBattleToken('아군1',3,5,'fire');summonBattleToken('아군2',4,5,'water');summonBattleToken('복수자',13,20,'earth','ultimate-avenger');summonBattleToken('소진자',20,3,'fire','ultimate-spent');summonBattleToken('아군5',5,6,'wind');"
  "await __q.wait(2200);const R=e=>e.getBoundingClientRect(),U=[...document.querySelectorAll('.arena .unit:not(.unit-dying)')],ov=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));"
  "let pairs=0;for(let i=0;i<U.length;i++)for(let j=i+1;j<U.length;j++)if(ov(R(U[i]),R(U[j]))>0)pairs++;const dock=R(document.querySelector('.arena>.field-action-dock')),mana=R(document.querySelector('#mana-hud')),arena=R(document.querySelector('.stage-column .arena'));"
  "const dockO=U.filter(u=>ov(R(u),dock)>0).length,manaO=U.filter(u=>ov(R(u),mana)>0).length,out=U.filter(u=>R(u).left<arena.left||R(u).right>arena.right||R(u).top<arena.top||R(u).bottom>arena.bottom).length;"
  "const gaps=[];[el,zo].forEach(l=>{const us=[...l.querySelectorAll(':scope > .unit')].map(R).sort((a,b)=>a.left-b.left);for(let i=1;i<us.length;i++)gaps.push(us[i].left-us[i-1].right);});"
  "return {ok:U.length===10&&pairs===0&&dockO===0&&manaO===0&&out===0&&Math.min(...gaps)>=40,pairs,dockO,manaO,out,minGap:Math.min(...gaps)};})()"),
 ("소진자는 상대 챔프가 3장 있어도 상대 소환사를 공격한다(반격 없음). 상대 소진자(전역 도발)가 있어도 소환사를 공격한다 (2026-11-08 PM 확정)",
  "(async()=>{const el=document.querySelector('.arena .lane:first-child'),zo=document.querySelector('.summon-zone');el.innerHTML='';zo.innerHTML='';const proto=enemyDeck.find(d=>!d.spell);"
  "const hpOf=u=>__q.hp(u);const en=(n,e)=>enemySummonUnit(el,{name:n,art:proto.art,el:'water',atk:2,hp:9,cost:1,effect:e});const foes=[en('적1'),en('적2'),en('적3')];"
  "const mine=summonBattleToken('소진자',4,3,'fire','ultimate-spent');mine.dataset.ultimateSpent='true';mine.dataset.ultimateAggro='true';mine.classList.remove('exhausted');"
  "const e0=enemyHp,foeHp=foes.map(hpOf);selectUnit(mine);attack(foes[0]);for(let i=0;i<80&&enemyHp===e0;i++)await __q.wait(100);await __q.wait(300);"
  "const hero={dmg:e0-enemyHp,foesUntouched:foes.every((u,i)=>hpOf(u)===foeHp[i]),playerHp:playerHp};"
  "const es=en('적소진자','ultimate-spent');es.dataset.ultimateSpent='true';es.dataset.ultimateAggro='true';const m2=summonBattleToken('소진자2',4,3,'fire','ultimate-spent');m2.dataset.ultimateSpent='true';m2.classList.remove('exhausted');"
  "const e1=enemyHp,sHp=hpOf(es);selectUnit(m2);attackFace(document.querySelector('.duel-hud .enemy'));for(let i=0;i<80&&enemyHp===e1;i++)await __q.wait(100);await __q.wait(300);"
  "const taunt={heroDmg:e1-enemyHp,spentUntouched:hpOf(es)===sHp};"
  "return {ok:hero.dmg===4&&hero.foesUntouched&&taunt.heroDmg===4&&taunt.spentUntouched,hero,taunt};})()"),
 ("컴퓨터 소진자도 내 챔프가 있어도 내 소환사를 공격한다(내 소진자가 있어도 소환사). 일반 하수인은 내 소진자를 공격한다",
  "(async()=>{const el=document.querySelector('.arena .lane:first-child'),zo=document.querySelector('.summon-zone');el.innerHTML='';zo.innerHTML='';const proto=enemyDeck.find(d=>!d.spell);"
  "const sp=enemySummonUnit(el,{name:'적소진자',art:proto.art,el:'water',atk:6,hp:3,cost:0,effect:'ultimate-spent'});sp.dataset.ultimateSpent='true';sp.dataset.ultimateAggro='true';"
  "const mk=n=>summonBattleToken(n,2,9,'earth');const mine=[mk('아군1'),mk('아군2'),mk('아군3')];"
  "const noTaunt=chooseEnemyAttackTarget(sp,mine)===null;const my=mine[0];my.dataset.ultimateAggro='true';const ignoresSpent=chooseEnemyAttackTarget(sp,mine)===null;const normalTaunted=chooseEnemyAttackTarget(enemySummonUnit(el,{name:'적일반0',art:proto.art,el:'water',atk:1,hp:3,cost:0}),mine)===my;delete my.dataset.ultimateAggro;"
  "const normal=enemySummonUnit(el,{name:'적일반',art:proto.art,el:'water',atk:2,hp:3,cost:0});const normalTarget=chooseEnemyAttackTarget(normal,mine)!==null;"
  "const p0=playerHp,hp0=mine.map(u=>__q.hp(u));enemyHand.length=0;enemyMana=0;[...el.querySelectorAll(':scope > .unit')].forEach(u=>{if(u!==sp)u.remove();});"
  "let finished=false;enemyTurn(()=>{finished=true;});for(let i=0;i<150&&!finished;i++)await __q.wait(100);await __q.wait(200);"
  "const r={noTaunt,ignoresSpent,normalTaunted,normalTarget,heroDmg:p0-playerHp,minesUntouched:mine.every((u,i)=>__q.hp(u)===hp0[i])};"
  "return {ok:noTaunt&&ignoresSpent&&normalTaunted&&normalTarget&&r.heroDmg===6&&r.minesUntouched,...r};})()"),
 ("소진자가 쓰러지는 연출 순서(실제 enemyTurn·endTurn 경로): 적중 → 반격 → 죽음 컷씬 → 컷 종료 → 카드 제거. 다른 연출이 적중을 늦춰도 같은 순서",
  "(async()=>{const el=document.querySelector('.arena .lane:first-child'),zo=document.querySelector('.summon-zone');const proto=enemyDeck.find(d=>!d.spell);const ev=[];const s0=()=>performance.now();"
  "const obs=new MutationObserver(ms=>ms.forEach(m=>{m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;const c=String(n.className||'');if(/ultimate-spent-death/.test(c))ev.push('cut');if(n.parentElement===log&&/맞받아쳐/.test(n.textContent))ev.push('counter');if(n.parentElement===log&&/을\\(를\\) 공격해/.test(n.textContent))ev.push('hit');});m.removedNodes.forEach(n=>{if(n.nodeType!==1)return;if(/ultimate-spent-death/.test(String(n.className||'')))ev.push('cutend');if(n.classList?.contains('unit')&&n.dataset.ultimateSpent==='true')ev.push('removed');});}));obs.observe(document.body,{childList:true,subtree:true});"
  "const reset=async()=>{fxClear();combatPresentationUntil=0;combatPresentationSlot=0;document.querySelectorAll('.ultimate-spent-death').forEach(n=>n.remove());el.innerHTML='';zo.innerHTML='';ev.length=0;ultimateLedger.player.spent=null;ultimateLedger.enemy.spent=null;ultimateLedger.player.pending=[];ultimateLedger.enemy.pending=[];await __q.wait(300);};"
  "const wait=async(name)=>{for(let i=0;i<200&&!ev.includes(name);i++)await __q.wait(100);await __q.wait(200);};"
  "const mineSpent=()=>{const s=summonBattleToken('내 소진자',6,1,'fire','ultimate-spent');s.dataset.ultimateSpent='true';s.dataset.ultimateAggro='true';s.dataset.orderLocked='true';registerUltimateSpent('player',s,{name:'내 소진자',art:proto.art,element:'fire',baseAttack:3,baseHp:3});summonBattleToken('아군',3,5,'water');return s;};"
  "const want='hit,counter,cut,cutend,removed';const out={};"
  "await reset();mineSpent();const h=enemySummonUnit(el,{name:'적',art:proto.art,el:'water',atk:5,hp:30,cost:1});h.classList.remove('exhausted');enemyHand.length=0;enemyMana=0;enemyTurn(()=>{});await wait('removed');out.enemyTurn=ev.join();const pend1=ultimateLedger.player.pending.length;"
  "await reset();mineSpent();const h2=enemySummonUnit(el,{name:'적',art:proto.art,el:'water',atk:5,hp:30,cost:1});h2.classList.remove('exhausted');enemyHand.length=0;enemyMana=0;fxPresent('dummy-banner',()=>()=>{},{priority:FX_PRIORITY.banner,hold:2600});enemyTurn(()=>{});await wait('removed');out.enemyTurnBusyFx=ev.join();"
  "await reset();const es=enemySummonUnit(el,{name:'적 소진자',art:proto.art,el:'fire',atk:6,hp:1,cost:0,effect:'ultimate-spent'});es.dataset.ultimateSpent='true';es.dataset.ultimateAggro='true';es.dataset.orderLocked='true';registerUltimateSpent('enemy',es,{name:'적 소진자',art:proto.art,element:'fire',baseAttack:3,baseHp:3});const m=summonBattleToken('내 챔프',5,9,'water');m.classList.remove('exhausted');endTurn(document.querySelector('.turn-actions .end'));await wait('removed');out.playerAttack=ev.join();"
  "await reset();const sp=summonBattleToken('마법맞는소진자',6,1,'fire','ultimate-spent');sp.dataset.ultimateSpent='true';registerUltimateSpent('player',sp,{name:'x',art:proto.art,element:'fire',baseAttack:3,baseHp:3});damageUnit(sp,9,'fire');await __q.wait(400);out.noCounter=ev.join();obs.disconnect();"
  "return {ok:out.enemyTurn===want&&out.enemyTurnBusyFx===want&&out.playerAttack===want&&out.noCounter==='cut'&&pend1===1,pend1,...out};})()"),
 ("컴퓨터 턴 흐름: 강림 시점의 enemyTurn 이 오류 없이 복수자를 내려놓고 공격 목록에 포함한다",
  "(async()=>{const proto=enemyDeck.find(d=>!d.spell);ultimateLedger.enemy.pending.push({rec:{name:proto.name,art:proto.art,element:proto.el,baseAttack:3,baseHp:4},due:ultimateLedger.enemy.turns+1});"
  "let finished=false;enemyTurn(()=>{finished=true;});for(let i=0;i<120&&!finished;i++)await __q.wait(100);" + (WAIT % 100) + "const a=document.querySelector('.arena .lane:first-child .unit[data-effect=\"ultimate-avenger\"]');"
  "return {ok:!!a&&__q.atk(a)===10&&__q.hp(a)===19&&finished,finished,atk:a&&__q.atk(a),hp:a&&__q.hp(a)};})()"),
  ("소진자끼리 교전해 반격으로 둘 다 쓰러지면(교전 해결 경로, 내 쪽이 공격): 공격받은 적 소진자 컷 → 끝난 뒤 반격으로 쓰러진 내 소진자 컷. 컷이 겹치거나 중간에 지워지지 않고, 두 카드는 각자 컷 뒤에 제거된다 (2026-11-08)",
  "(async()=>{const el=document.querySelector('.arena .lane:first-child'),zo=document.querySelector('.summon-zone');const proto=enemyDeck.find(d=>!d.spell);const ev=[];let t0=0;"
  "const obs=new MutationObserver(ms=>ms.forEach(m=>{m.addedNodes.forEach(n=>{if(n.nodeType===1&&/ultimate-spent-death/.test(String(n.className||'')))ev.push(['cut',n.querySelector('.spent-death-copy b')?.textContent,Math.round(performance.now()-t0),document.querySelectorAll('.ultimate-spent-death').length]);});m.removedNodes.forEach(n=>{if(n.nodeType===1&&/ultimate-spent-death/.test(String(n.className||'')))ev.push(['end',n.querySelector('.spent-death-copy b')?.textContent,Math.round(performance.now()-t0)]);});}));obs.observe(document.body,{childList:true,subtree:true});"
  "const reset=async()=>{fxClear();combatPresentationUntil=0;document.querySelectorAll('.ultimate-spent-death').forEach(n=>n.remove());el.innerHTML='';zo.innerHTML='';ev.length=0;['player','enemy'].forEach(k=>{ultimateLedger[k].spent=null;ultimateLedger[k].pending=[];});await __q.wait(300);t0=performance.now();};"
  "const mine=(name)=>{const s=summonBattleToken(name,6,1,'fire','ultimate-spent');s.dataset.ultimateSpent='true';s.dataset.ultimateAggro='true';s.dataset.orderLocked='true';s.classList.remove('exhausted');registerUltimateSpent('player',s,{name,art:proto.art,element:'fire',baseAttack:3,baseHp:3});return s;};"
  "const theirs=(name)=>{const s=enemySummonUnit(el,{name,art:proto.art,el:'fire',atk:6,hp:1,cost:0,effect:'ultimate-spent'});s.dataset.ultimateSpent='true';s.dataset.ultimateAggro='true';s.dataset.orderLocked='true';s.classList.remove('exhausted');registerUltimateSpent('enemy',s,{name,art:proto.art,element:'fire',baseAttack:3,baseHp:3});return s;};"
  "const done=async()=>{for(let i=0;i<250&&ev.filter(e=>e[0]==='end').length<2;i++)await __q.wait(100);await __q.wait(300);return ev.map(e=>e.slice());};"
  "const judge=(log,first,second)=>{const cuts=log.filter(e=>e[0]==='cut'),ends=log.filter(e=>e[0]==='end');return cuts.length===2&&ends.length===2&&cuts[0][1]===first&&cuts[1][1]===second&&ends[0][1]===first&&cuts.every(c=>c[3]===1)&&cuts[1][2]>=ends[0][2]&&ends[0][2]-cuts[0][2]>=3500&&ends[1][2]-cuts[1][2]>=3500;};"
    "await reset();const a=mine('내 소진자'),b=theirs('적 소진자');resolveDuel(a,b,{playerAttack:true});const p=await done();await __q.wait(1500);const removed=!a.isConnected&&!el.querySelector('.unit[data-ultimate-spent]');obs.disconnect();"
  "return {ok:judge(p,'적 소진자','내 소진자')&&removed,p,removed};})()"),
  ("소진자끼리 교전해 반격으로 둘 다 쓰러지면(교전 해결 경로, 상대 쪽이 공격): 공격받은 내 소진자 컷 → 끝난 뒤 반격으로 쓰러진 적 소진자 컷 (2026-11-08)",
  "(async()=>{const el=document.querySelector('.arena .lane:first-child'),zo=document.querySelector('.summon-zone');const proto=enemyDeck.find(d=>!d.spell);const ev=[];let t0=0;"
  "const obs=new MutationObserver(ms=>ms.forEach(m=>{m.addedNodes.forEach(n=>{if(n.nodeType===1&&/ultimate-spent-death/.test(String(n.className||'')))ev.push(['cut',n.querySelector('.spent-death-copy b')?.textContent,Math.round(performance.now()-t0),document.querySelectorAll('.ultimate-spent-death').length]);});m.removedNodes.forEach(n=>{if(n.nodeType===1&&/ultimate-spent-death/.test(String(n.className||'')))ev.push(['end',n.querySelector('.spent-death-copy b')?.textContent,Math.round(performance.now()-t0)]);});}));obs.observe(document.body,{childList:true,subtree:true});"
  "const reset=async()=>{fxClear();combatPresentationUntil=0;document.querySelectorAll('.ultimate-spent-death').forEach(n=>n.remove());el.innerHTML='';zo.innerHTML='';ev.length=0;['player','enemy'].forEach(k=>{ultimateLedger[k].spent=null;ultimateLedger[k].pending=[];});await __q.wait(300);t0=performance.now();};"
  "const mine=(name)=>{const s=summonBattleToken(name,6,1,'fire','ultimate-spent');s.dataset.ultimateSpent='true';s.dataset.ultimateAggro='true';s.dataset.orderLocked='true';s.classList.remove('exhausted');registerUltimateSpent('player',s,{name,art:proto.art,element:'fire',baseAttack:3,baseHp:3});return s;};"
  "const theirs=(name)=>{const s=enemySummonUnit(el,{name,art:proto.art,el:'fire',atk:6,hp:1,cost:0,effect:'ultimate-spent'});s.dataset.ultimateSpent='true';s.dataset.ultimateAggro='true';s.dataset.orderLocked='true';s.classList.remove('exhausted');registerUltimateSpent('enemy',s,{name,art:proto.art,element:'fire',baseAttack:3,baseHp:3});return s;};"
  "const done=async()=>{for(let i=0;i<250&&ev.filter(e=>e[0]==='end').length<2;i++)await __q.wait(100);await __q.wait(300);return ev.map(e=>e.slice());};"
  "const judge=(log,first,second)=>{const cuts=log.filter(e=>e[0]==='cut'),ends=log.filter(e=>e[0]==='end');return cuts.length===2&&ends.length===2&&cuts[0][1]===first&&cuts[1][1]===second&&ends[0][1]===first&&cuts.every(c=>c[3]===1)&&cuts[1][2]>=ends[0][2]&&ends[0][2]-cuts[0][2]>=3500&&ends[1][2]-cuts[1][2]>=3500;};"
    "await reset();const b=theirs('적 소진자'),a=mine('내 소진자');resolveDuel(b,a);const e=await done();await __q.wait(1500);const removed=!zo.querySelector('.unit')&&!el.querySelector('.unit[data-ultimate-spent]');obs.disconnect();"
  "return {ok:judge(e,'내 소진자','적 소진자')&&removed,e,removed};})()"),
  ("궁극기 연출 순서(유저·컴퓨터 동일): 컷씬이 먼저 뜨고, 컷씬이 걷힌 뒤에 소진자가 필드에 내려온다 (2026-11-08)",
  "(async()=>{const ev=[],seen=(sel,k)=>{if(document.querySelector(sel)&&!ev.includes(k))ev.push(k);};const tick=setInterval(()=>{seen('.ultimate-overlay:not(.enemy-ultimate-overlay)','p-cut');seen('.summon-zone .unit[data-effect=\"ultimate-spent\"]','p-spent');seen('.enemy-ultimate-overlay','e-cut');seen('.arena .lane:first-child .unit[data-effect=\"ultimate-spent\"]','e-spent');},20);"
  "__q.ready();const c=__q.card(__q.notFireId);setUltimate(c);__q.ripe();fireUltimateAction();const pEarly=!__q.spent();await __q.wait(ULTIMATE_EFFECT_DELAY+120);"
  "const proto=enemyDeck.find(d=>!d.spell);awakenGateOpened.enemy=true;enemyHp=70;enemyTurnMaxMana=maxMana=5;enemyMana=5;enemyUltimate=enemyUltimateSpec({...proto,atkFinal:proto.atk});castEnemyUltimate();const eEarly=!document.querySelector('.arena .lane:first-child .unit[data-effect=\"ultimate-spent\"]');await enemyUltimateCasting;await __q.wait(60);clearInterval(tick);"
  "return {ok:pEarly&&eEarly&&ev.join(',')==='p-cut,p-spent,e-cut,e-spent',pEarly,eEarly,ev};})()"),
  ("컴퓨터 오라 공명: 소진자가 +7/1로 내려온 뒤 오라 강하 연출(프로필 오라 → 중앙 → 빛)에서 +5/+3을 받아 +12/4가 된다 (2026-11-08)",
  "(async()=>{const proto=enemyDeck.find(d=>!d.spell);const base=baseCardStatsByArt(proto.art);const lane=document.querySelector('.arena .lane:first-child');awakenGateOpened.enemy=true;enemyHp=70;enemyTurnMaxMana=maxMana=7;enemyMana=7;"
  "enemyUltimate={...enemyUltimateSpec({...proto,atkFinal:proto.atk}),personality:AURA_PERSONALITY_BY_GUARDIAN[enemyGuardian]};const res=enemyAuraUltimateMatch(enemyUltimate),cost=enemyUltimateManaCost(enemyUltimate);"
  "let before=null,orb=false,beam=false;const tick=setInterval(()=>{const s=lane.querySelector('.unit[data-effect=\"ultimate-spent\"]');if(s&&!before)before={atk:__q.atk(s),hp:__q.hp(s)};if(document.querySelector('.resonance-orb'))orb=true;if(document.querySelector('.resonance-beam'))beam=true;},20);"
  "castEnemyUltimate();await enemyUltimateCasting;clearInterval(tick);const s=lane.querySelector('.unit[data-effect=\"ultimate-spent\"]');"
  "return {ok:res&&cost===5&&!!before&&before.atk===base.atk+7&&before.hp===1&&orb&&beam&&__q.atk(s)===base.atk+12&&__q.hp(s)===4,res,cost,before,orb,beam,atk:s&&__q.atk(s),hp:s&&__q.hp(s),base:base.atk};})()"),
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
