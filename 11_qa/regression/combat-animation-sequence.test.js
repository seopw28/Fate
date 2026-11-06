const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('공격·반격·추가 효과·다음 교전은 공통 타임라인 순서로 실행된다', () => {
  assert.ok(html.includes('counterDelay:1050,guardianReaction:2150,followUpDelay:2850,duelGap:3900'));
  assert.ok(html.includes('},COMBAT_TIMING.counterDelay);'));
  assert.ok(html.includes('},COMBAT_TIMING.followUpDelay);'));
  assert.ok(html.includes('},COMBAT_TIMING.guardianReaction);'));
  assert.ok(html.includes('const PLAYER_AUTO_ATTACK_INTERVAL = COMBAT_TIMING.duelGap;'));
  assert.ok(html.includes('combatMs(i*COMBAT_TIMING.duelGap)'));
});

test('죽거나 사라진 방어 카드는 예약 반격을 실행하지 않는다', () => {
  assert.ok(html.includes("!defender.isConnected||defender.dataset.destroyed==='true'"));
});

test('여러 세트 마법은 한 연출이 끝난 뒤 다음 마법을 시작한다', () => {
  assert.ok(html.includes('spellGap:3400'));
  assert.ok(html.includes('order*COMBAT_TIMING.spellGap'));
});
