const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require('node:path').resolve(__dirname, '../../dist/index.html'), 'utf8');

test('배틀 첫 혈마나 1번은 마나 1당 체력 1, 이후는 2에서 시작해 같은 턴 사용마다 1씩 오른다', () => {
  assert.ok(html.includes('const BLOOD_MANA_FIRST_RATE = 1, BLOOD_MANA_BASE_RATE = 2, BLOOD_MANA_RATE_STEP = 1;'));
  assert.ok(html.includes('const bloodManaRate=()=>bloodManaBattleUses===0?BLOOD_MANA_FIRST_RATE:BLOOD_MANA_BASE_RATE+bloodManaUses*BLOOD_MANA_RATE_STEP;'));
  assert.ok(html.includes('function recordBloodManaUse(){if(bloodManaBattleUses++===0)return;bloodManaUses++;}'), '배틀 첫 사용은 턴 사용 횟수에 넣지 않는다');
  assert.ok(!html.includes('rate=4+bloodManaUses'), '예전 비용 4가 남아 있으면 안 된다');
  assert.equal((html.match(/rate=bloodManaRate\(\)/g) || []).length, 2, '비용 계산과 마나 HUD 표시가 같은 값을 써야 한다');
  assert.equal((html.match(/recordBloodManaUse\(\);/g) || []).length, 1, '카드 사용만 이 기록 함수를 쓴다. 카드 뽑기 혈마나는 따로 센다 (2026-11-09)');
});

test('배틀 첫 혈마나 사용 횟수는 턴이 바뀌어도 초기화하지 않고 세팅 취소 시에만 되돌린다', () => {
  assert.ok(html.includes('let bloodManaBattleUses = 0;'));
  assert.ok(!html.includes('bloodManaBattleUses=0'));
  assert.ok(html.includes('bloodManaBattleUses = Math.max(0, bloodManaBattleUses - (refund.battleBlood||0));'));
});

test('카드 뽑기 혈마나는 따로 센다: 배틀에서 n번째 혈마나 카드 뽑기는 모자란 마나 1당 체력 n, 배틀 동안 누적 (2026-11-09 PM 개정, 컴퓨터 동일)', () => {
  assert.ok(html.includes('const BLOOD_DRAW_RATE_START=1,BLOOD_DRAW_RATE_STEP=1;let bloodDrawUses=0,enemyBloodDrawUses=0;'));
  assert.ok(html.includes('rate=bloodDrawRate(bloodDrawUses),healthCost=base.shortage*rate'), '유저 카드 뽑기 견적');
  assert.ok(html.includes('rate=bloodDrawRate(enemyBloodDrawUses),healthCost=base.shortage*rate'), '컴퓨터 카드 뽑기 견적');
  assert.ok(html.includes('if(healthCost){playerHp-=healthCost;bloodDrawUses++;'), '유저 혈마나 뽑기는 카드 사용 혈마나 횟수에 넣지 않는다');
  assert.ok(html.includes('if(healthCost){enemyHp-=healthCost;enemyBloodDrawUses++;'), '컴퓨터도 같다');
  assert.ok(!html.includes('BLOOD_DRAW_STEP=2'), '이전 x2 누적은 없다');
});
