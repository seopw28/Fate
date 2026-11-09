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
  assert.equal((html.match(/recordBloodManaUse\(\);/g) || []).length, 2, '카드 사용과 카드 뽑기 모두 같은 기록 함수를 쓴다');
});

test('배틀 첫 혈마나 사용 횟수는 턴이 바뀌어도 초기화하지 않고 세팅 취소 시에만 되돌린다', () => {
  assert.ok(html.includes('let bloodManaBattleUses = 0;'));
  assert.ok(!html.includes('bloodManaBattleUses=0'));
  assert.ok(html.includes('bloodManaBattleUses = Math.max(0, bloodManaBattleUses - (refund.battleBlood||0));'));
});

test('카드 뽑기를 혈마나로 낼 때마다 배틀 안에서 횟수가 쌓여, 다음 혈마나 카드 뽑기는 체력을 횟수 x 2 더 낸다 (2026-11-09 PM, 컴퓨터 동일)', () => {
  assert.ok(html.includes('const BLOOD_DRAW_STEP=2;let bloodDrawUses=0,enemyBloodDrawUses=0;'));
  assert.ok(html.includes('surcharge=base.shortage?bloodDrawUses*BLOOD_DRAW_STEP:0,healthCost=base.healthCost+surcharge'), '유저 카드 뽑기 견적');
  assert.ok(html.includes('surcharge=base.shortage?enemyBloodDrawUses*BLOOD_DRAW_STEP:0,healthCost=base.healthCost+surcharge'), '컴퓨터 카드 뽑기 견적');
  assert.ok(html.includes('recordBloodManaUse();bloodDrawUses++;'), '유저 혈마나 카드 뽑기마다 누적');
  assert.ok(html.includes('recordEnemyBloodManaUse();enemyBloodDrawUses++;'), '컴퓨터 혈마나 카드 뽑기마다 누적');
});
