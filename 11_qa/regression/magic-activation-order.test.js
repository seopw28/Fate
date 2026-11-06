const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('내 세트 마법은 발동 카드를 먼저 보여준 뒤 효과를 적용한다', () => {
  assert.ok(html.includes("global.className='global-spell'"));
  assert.ok(html.includes('setTimeout(()=>{castSpell(card);global.classList.add(\'resolved\')'));
  assert.ok(html.includes('},MAGIC_EFFECT_AT_MS)'));
});

test('마법·함정 공개 카드는 궁극기 등 필드 조작부보다 앞에 표시된다', () => {
  assert.ok(html.includes('.field-action-dock{position:absolute;z-index:13;'));
  assert.ok(html.includes('.global-spell { z-index:30; }'));
});

test('상대 마법도 중앙 발동 안내 후 실제 효과를 적용한다', () => {
  assert.ok(html.includes('function showEnemyMagicActivation(card,onResolve)'));
  assert.ok(html.includes("global.className='global-spell enemy-magic-activation'"));
  assert.ok(html.includes("setTimeout(()=>{global.classList.add('resolved');onResolve();},900)"));
  assert.ok(html.includes('resolveEnemySpell=function(card){showEnemyMagicActivation(card,()=>resolveEnemySpellEffect(card));}'));
});

test('동시에 준비된 상대 마법은 발동 연출이 겹치지 않게 순차 처리한다', () => {
  assert.ok(html.includes('setTimeout(()=>resolveEnemySpell(card),order*COMBAT_TIMING.spellGap)'));
  assert.ok(html.includes('due.length*COMBAT_TIMING.spellGap'));
});

test('동시에 준비된 내 마법은 각 카드의 최소 노출시간이 끝난 뒤 다음 카드를 공개한다', () => {
  assert.ok(html.includes('const MAGIC_REVEAL_MIN_MS=2800,MAGIC_EFFECT_AT_MS=1100,MAGIC_SEQUENCE_GAP_MS=450'));
  assert.ok(html.includes('return new Promise(resolve=>'));
  assert.ok(html.includes('async function resolveNextFieldMagic()'));
  assert.ok(html.includes('await activateSetMagic(index,true)'));
  assert.ok(html.includes('await new Promise(resolve=>setTimeout(resolve,MAGIC_SEQUENCE_GAP_MS))'));
  assert.ok(!html.includes("due.forEach((magic,order)=>setTimeout(()=>{const index=setMagicCards.indexOf(magic);if(index>=0)activateSetMagic(index,true);},order*COMBAT_TIMING.spellGap)"));
});

test('내 함정과 상대 함정은 발동 시 카드 이름과 일러스트를 중앙에 공개한다', () => {
  assert.ok(html.includes("function showTrapActivation(trap,side='player')"));
  assert.ok(html.includes("global.className='global-spell trap-activation '+side"));
  assert.ok(html.includes("showTrapActivation(trap,'player')"));
  assert.ok(html.includes("showTrapActivation(trap,'enemy')"));
  assert.ok(html.includes("setTimeout(()=>global.classList.add('resolved'),900)"));
  assert.ok(html.includes("setTimeout(()=>global.remove(),2300)"));
});

test('상대 함정은 세트 시 정체를 숨기고 발동 시에만 공개한다', () => {
  assert.ok(html.includes('상대</strong>가 함정 카드를 뒤집어 세트했습니다.'));
  assert.ok(!html.includes("(card.trap?'함정':'마법')+' <strong>'+card.name+'</strong>을(를) 세트했습니다."));
});
