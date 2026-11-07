const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('내 세트 마법은 발동 카드를 먼저 보여준 뒤 효과를 적용한다', () => {
  assert.ok(html.includes("global.className='global-spell owner-player'"), '내 마법은 소유자가 나임을 클래스로 드러내야 한다');
  assert.ok(html.includes("fxPresent('magic:'+magic.name"), '마법 공개는 연출 큐를 거쳐야 한다');
  assert.ok(html.includes('hold:MAGIC_REVEAL_MS'), '공개 시간은 MAGIC_REVEAL_MS 동안 점유한다');
  assert.ok(html.includes('.then(()=>{castSpell(card);'), '공개가 끝난 뒤에 효과를 적용해야 한다');
  assert.ok(!html.includes('castSpell(card);global.classList.add(\'resolved\')'));
});

test('마법·함정 공개 카드는 궁극기 등 필드 조작부보다 앞에 표시된다', () => {
  assert.ok(html.includes('.field-action-dock{position:absolute;z-index:13;'));
  assert.ok(html.includes('.global-spell { z-index:30; }'));
});

test('상대 마법도 중앙 발동 안내 후 실제 효과를 적용한다', () => {
  assert.ok(html.includes('function showEnemyMagicActivation(card,onResolve)'));
  assert.ok(html.includes("global.className='global-spell enemy-magic-activation owner-enemy'"), '상대 마법은 소유자가 상대임을 클래스로 드러내야 한다');
  assert.ok(html.includes("fxPresent('enemy-magic:'+card.name"), '상대 마법도 연출 큐를 거쳐야 한다');
  assert.ok(html.includes('.then(()=>{onResolve();'), '공개가 끝난 뒤에 효과를 적용해야 한다');
  assert.ok(html.includes('resolveEnemySpell=function(card){return showEnemyMagicActivation(card,()=>resolveEnemySpellEffect(card));}'));
});

test('동시에 준비된 상대 마법은 발동 연출이 겹치지 않게 순차 처리한다', () => {
  assert.ok(html.includes('async function resolveEnemySetMagic()'));
  assert.ok(html.includes('await resolveEnemySpell(card)'));
  assert.ok(!html.includes('setTimeout(()=>resolveEnemySpell(card),order*COMBAT_TIMING.spellGap)'));
});

test('동시에 준비된 내 마법은 각 카드의 최소 노출시간이 끝난 뒤 다음 카드를 공개한다', () => {
  assert.ok(html.includes('const MAGIC_REVEAL_MS=1500,MAGIC_EFFECT_SETTLE_MS=900,MAGIC_SEQUENCE_GAP_MS=250'));
  assert.ok(html.includes('return new Promise(resolve=>'));
  assert.ok(html.includes('async function resolveNextFieldMagic()'));
  assert.ok(html.includes('await activateSetMagic(index,true)'));
  assert.ok(html.includes('await new Promise(resolve=>setTimeout(resolve,MAGIC_SEQUENCE_GAP_MS))'));
  assert.ok(!html.includes("due.forEach((magic,order)=>setTimeout(()=>{const index=setMagicCards.indexOf(magic);if(index>=0)activateSetMagic(index,true);},order*COMBAT_TIMING.spellGap)"));
});

test('마법 공개 레이어가 사라지고 효과 정산이 끝날 때까지 다른 진행을 멈춘다', () => {
  assert.ok(html.includes('.then(()=>{castSpell(card);'));
  assert.ok(html.includes('setTimeout(()=>resolve(true),MAGIC_EFFECT_SETTLE_MS)'));
  assert.ok(html.includes('enemyTurn=function(done)'));
  assert.ok(html.includes('(async()=>{'));
  assert.ok(html.includes('await resolveEnemySetMagic();if(resultPending)'));
  assert.ok(html.includes('setTimeout(resolve,ENEMY_MAGIC_EFFECT_SETTLE_MS)'));
  assert.ok(html.includes('hold:ENEMY_MAGIC_REVEAL_MS'));
});

test('내 함정과 상대 함정은 발동 시 카드 이름과 일러스트를 중앙에 공개한다', () => {
  assert.ok(html.includes("function showTrapActivation(trap,side='player')"));
  assert.ok(html.includes("global.className='global-spell trap-activation '+side"));
  assert.ok(html.includes("showTrapActivation(trap,'player')"));
  assert.ok(html.includes("showTrapActivation(trap,'enemy')"));
  assert.ok(html.includes("fxPresent('trap:'+name"), '함정 공개도 연출 큐를 거쳐야 한다');
  assert.ok(html.includes("setTimeout(()=>global.classList.add('resolved'),900)"));
  assert.ok(html.includes('hold:2300'), '함정 공개는 2300ms 동안 화면을 점유한다');
});

test('상대 함정은 세트 시 정체를 숨기고 발동 시에만 공개한다', () => {
  assert.ok(html.includes('상대</strong>가 함정 카드를 뒤집어 세트했습니다.'));
  assert.ok(!html.includes("(card.trap?'함정':'마법')+' <strong>'+card.name+'</strong>을(를) 세트했습니다."));
});

test('세팅 슬롯은 함정 1칸뿐이고, 칸이 차면 손패의 함정 카드만 비활성 시각화한다 (2026-11-07)', () => {
  assert.ok(html.includes("const MAGIC_SLOT_KINDS=['reaction'];"), '함정 전용 1칸');
  assert.ok(html.includes('id="magic-slot-0"') && !html.includes('id="magic-slot-1"'), '함정 칸 하나만 화면에 있어야 한다');
  assert.ok(html.includes('slotIndex=freeMagicSlot(kind)'), '세트는 카드 종류에 맞는 빈 칸에만 들어가야 한다');
  assert.ok(html.includes('.command-rail .card.magic-slot-blocked'), '비활성 카드 스타일이 있어야 한다');
  assert.ok(html.includes('function syncMagicHandSlotAvailability()'), '손패 비활성 동기화 함수가 있어야 한다');
  const sync = html.slice(html.indexOf('function syncMagicHandSlotAvailability()'), html.indexOf('const renderMagicSlotsBeforeHandBlock'));
  assert.ok(sync.includes("const fullByKind = {active: freeMagicSlot('active') < 0, reaction: freeMagicSlot('reaction') < 0}"), '카드 종류별로 칸이 모두 찼을 때만 막아야 한다');
  assert.ok(sync.includes("cardCategory(card)!=='spell'||magicKindOfCard(card)!=='reaction'"), '캐릭터와 마법 카드는 칸 비활성 대상이 아니어야 한다');
  assert.ok(sync.includes("card.classList.toggle('magic-slot-blocked', full)"), '슬롯이 비면 비활성 표시를 해제해야 한다');
  assert.ok(sync.includes("card.setAttribute('aria-disabled','true')"), '보조 기술에도 비활성을 알려야 한다');
  assert.ok(!sync.includes("card.title=''"), '해제 시 빈 title 대신 속성을 제거해야 한다');
  assert.ok(html.includes('renderMagicSlots = function(){ renderMagicSlotsBeforeHandBlock(); syncMagicHandSlotAvailability(); }'), '슬롯 상태가 바뀌면 손패도 갱신해야 한다');
  assert.ok(html.includes('updateCardAffordability = function(...args){ const result = updateCardAffordabilityBeforeMagicBlock.apply(this,args); syncMagicHandSlotAvailability(); return result; }'), '손패 재정렬 후에도 비활성 표시가 유지돼야 한다');
  assert.ok(!html.includes("content:'슬롯 2/2 · 세팅 불가'"), '공격력·체력을 가리는 글자 띠는 쓰지 않는다');
});

test('마법은 손패에서 더블클릭하면 마나로만 즉시 발동하고, 궁극기는 세팅 다음 턴부터 발동한다 (2026-11-07)', () => {
  assert.ok(html.includes('function castHandSpell(card)'), '손패 마법 즉시 발동 함수가 있어야 한다');
  assert.ok(html.includes("document.addEventListener('dblclick'"), '더블클릭으로 발동해야 한다');
  assert.ok(html.includes("if(isSpell&&!isTrap){if(!card.classList.contains('selected'))selectCard(card);"), '한 번 클릭은 선택과 안내만 해야 한다');
  assert.ok(html.includes('blocked=spellOnly?mana<cost:!quote.affordable'), '마법은 혈마나 없이 마나로만 쓸 수 있어야 한다');
  const turn = html.slice(html.indexOf('enemyTurnMaxMana=enemyMana;'));
  const setAt = turn.indexOf('await beat(()=>setEnemyMagic())'), resolveAt = turn.indexOf('await resolveEnemySetMagic()');
  assert.ok(resolveAt > setAt && resolveAt < turn.indexOf('let placedBefore=lane.querySelectorAll'), '상대 마법은 쓰는 즉시 발동해야 한다');
  assert.ok(html.includes("(event==='field_state'&&magic.effect==='global-destroy')"), '대재앙은 대기 턴이 찬 내 턴 시작에 발동하는 함정이다');
  assert.ok(html.includes("if(ultimateJustEquipped('player',ultimateState))return '다음 턴부터 발동';"), '세팅한 턴에는 궁극기를 발동할 수 없어야 한다');
  assert.ok(html.includes("ultimateJustEquipped('enemy',spec))return false;"), '컴퓨터도 세팅한 턴에는 궁극기를 발동하지 않는다');
});

test('소환을 막거나 되돌리는 카드는 쓴 쪽과 관계없이 양쪽 영웅에게 1 피해를 준다 (2026-11-08)', () => {
  assert.ok(html.includes('const SUMMON_DENY_RECOIL=1;'), '반동 피해 상수');
  assert.ok(html.includes("playerHp=Math.max(0,playerHp-SUMMON_DENY_RECOIL);enemyHp=Math.max(0,enemyHp-SUMMON_DENY_RECOIL);"), '양쪽 영웅 모두 피해');
  assert.ok(html.includes("을 상대 손패로 돌려보냈습니다.');summonDenyRecoil("), '내 되돌리기 마법');
  assert.ok(html.includes("의 소환을 무효화했습니다.');summonDenyRecoil("), '내 소환 무효 함정');
  assert.ok(html.includes("setTimeout(()=>strongest.remove(),350);summonDenyRecoil(card.name);"), '컴퓨터 되돌리기 마법');
  assert.ok(html.includes("summonDenyRecoil(trap.name);return {prevented:true};"), '컴퓨터 소환 무효 함정');
});
