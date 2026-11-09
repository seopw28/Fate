const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('상대 전장도 5장을 넘지 않는다: 부활, 사령, 연속 소환이 겹쳐도 6번째는 소환되지 않는다 (2026-11-09 버그)', () => {
  assert.ok(html.includes("if(!slot&&lane&&lane.querySelectorAll(':scope > .unit:not(.unit-dying)').length>=FIELD_CARD_LIMIT)return null;"), 'enemySummonUnit 자체가 5칸을 지킨다');
  assert.ok(html.includes("if(lane.querySelectorAll(':scope > .unit:not(.unit-dying)').length>=FIELD_CARD_LIMIT){enemyHand.push(data);continue;}"), '계획 뒤에 전장이 차면 내지 않고 손패로 돌린다');
  assert.ok(html.includes('if(!enemySummonUnit(lane,data)){enemyMana+=data.cost;enemyHand.push(data);}'), '소환이 막히면 마나와 카드를 돌려준다');
});
