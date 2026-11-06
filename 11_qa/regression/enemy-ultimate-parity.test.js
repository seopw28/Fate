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
});

test('복수자는 궁극기 소진자가 쓰러진 뒤에만 강림한다 (체력 40 진입만으로는 오지 않는다)', () => {
  // 소진자가 전장에 살아 있는 동안에는 체력이 40 이하여도 강림을 보류한다.
  assert.ok(html.includes('function summonEnemyUltimateAvenger(){if(enemyAvengerSummoned)return null;if(!enemyFirstUltimateSpentFallen)return null;'), '상대 복수자는 소진자 사망 전에는 소환되지 않아야 한다');
  assert.ok(html.includes('function summonFirstUltimateAvenger(){if(avengerSummoned)return null;if(!firstUltimateSpentFallen)return null;'), '내 복수자도 같은 규칙을 따라야 한다');
  // 사망 플래그는 전용 사망 컷(최초 소진자 한정)에서만 세워진다.
  assert.ok(html.includes("if(avengerSide==='player')firstUltimateSpentFallen=true;else enemyFirstUltimateSpentFallen=true;"), '사망 시점에 복수 자격이 생겨야 한다');
  // 체력 40 진입이 이미 지났어도 사망 시점에 다시 강림을 시도한다.
  assert.ok(html.includes('queueEnemyUltimateAvenger(4200)'), '사망 컷이 끝난 뒤 이어서 강림해야 한다');
  assert.ok(html.includes('function ensureEnemyAvengerSource()'), '동료 후보 확정 로직은 유지한다');
  assert.ok(html.includes('if(!ensureEnemyAvengerSource())return null'));
});
