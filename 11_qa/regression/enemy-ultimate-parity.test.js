const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('컴퓨터도 궁극기 장착과 발동 카드를 플레이어에게 공개한다', () => {
  assert.ok(html.includes('function showEnemyUltimateEquip(spec)'));
  assert.ok(html.includes('ENEMY ULTIMATE EQUIP'));
  assert.ok(html.includes('function showEnemyUltimateActivation(spec)'));
  assert.ok(html.includes('ENEMY ULTIMATE · LIMIT BREAK'));
});

test('컴퓨터 궁극기도 전장 제물과 0/1 소진자 및 전역 도발을 사용한다', () => {
  assert.ok(html.includes('function sendEnemyUltimateToGraveyard(spec)'));
  assert.ok(html.includes("effect:'ultimate-spent'"));
  assert.ok(html.includes("unit.dataset.ultimateAggro='true'"));
  assert.ok(html.includes('sendEnemyUltimateToGraveyard(spec);'));
  assert.ok(html.includes('unit[data-ultimate-aggro="true"]'));
});

test('컴퓨터도 최후의 저항에서 추가 드로우와 복수자를 얻는다', () => {
  assert.ok(html.includes("if(desperateActive('enemy')){enemyDraw();"));
  assert.ok(html.includes('function queueEnemyUltimateAvenger(delay=0)'));
  assert.ok(html.includes('function summonEnemyUltimateAvenger()'));
  assert.ok(html.includes("effect:'ultimate-avenger'"));
  assert.ok(html.includes('setTimeout(()=>resolveEnemyAvengerArrivalDamage(partner),3050)'));
  assert.ok(html.includes("else{ensureEnemyAvengerSource();queueEnemyUltimateAvenger(0);}"));
});

test('상대가 궁극기를 쓰기 전이어도 체력 40 이하에서 복수 기준을 확보해 강림한다', () => {
  assert.ok(html.includes('function ensureEnemyAvengerSource()'));
  assert.ok(html.includes('const pool=[...enemyHand,...enemyDeck].filter(card=>!card.spell&&card.art)'));
  assert.ok(html.includes('if(!ensureEnemyAvengerSource())return null'));
  assert.ok(html.includes("else{ensureEnemyAvengerSource();queueEnemyUltimateAvenger(0);}"));
});
