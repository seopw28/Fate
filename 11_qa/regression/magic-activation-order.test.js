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

test('마법 2칸과 함정 1칸을 종류별로 고정하고, 찬 종류의 손패 카드만 비활성 시각화한다', () => {
  assert.ok(html.includes("const MAGIC_SLOT_KINDS=['active','active','reaction'];"), '마법 전용 2칸 + 함정 전용 1칸');
  assert.ok(html.includes('id="magic-slot-2"'), '세 번째 칸(함정)이 화면에 있어야 한다');
  assert.ok(html.includes('slotIndex=freeMagicSlot(kind)'), '세트는 카드 종류에 맞는 빈 칸에만 들어가야 한다');
  assert.ok(html.includes('.command-rail .card.magic-slot-blocked'), '비활성 카드 스타일이 있어야 한다');
  assert.ok(html.includes('function syncMagicHandSlotAvailability()'), '손패 비활성 동기화 함수가 있어야 한다');
  const sync = html.slice(html.indexOf('function syncMagicHandSlotAvailability()'), html.indexOf('const renderMagicSlotsBeforeHandBlock'));
  assert.ok(sync.includes("const fullByKind = {active: freeMagicSlot('active') < 0, reaction: freeMagicSlot('reaction') < 0}"), '카드 종류별로 칸이 모두 찼을 때만 막아야 한다');
  assert.ok(sync.includes("cardCategory(card)!=='spell'"), '캐릭터 카드는 비활성 대상이 아니어야 한다');
  assert.ok(sync.includes("card.classList.toggle('magic-slot-blocked', full)"), '슬롯이 비면 비활성 표시를 해제해야 한다');
  assert.ok(sync.includes("card.setAttribute('aria-disabled','true')"), '보조 기술에도 비활성을 알려야 한다');
  assert.ok(!sync.includes("card.title=''"), '해제 시 빈 title 대신 속성을 제거해야 한다');
  assert.ok(html.includes('renderMagicSlots = function(){ renderMagicSlotsBeforeHandBlock(); syncMagicHandSlotAvailability(); }'), '슬롯 상태가 바뀌면 손패도 갱신해야 한다');
  assert.ok(html.includes('updateCardAffordability = function(...args){ const result = updateCardAffordabilityBeforeMagicBlock.apply(this,args); syncMagicHandSlotAvailability(); return result; }'), '손패 재정렬 후에도 비활성 표시가 유지돼야 한다');
  assert.ok(!html.includes("content:'슬롯 2/2 · 세팅 불가'"), '공격력·체력을 가리는 글자 띠는 쓰지 않는다');
});
