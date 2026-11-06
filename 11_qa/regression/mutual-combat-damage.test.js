const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('카드 대 카드 교전은 양쪽이 상대 공격력만큼 피해를 받는다', () => {
  assert.ok(html.includes('const resolveDuelBeforeMutualDamage=resolveDuel'));
  assert.ok(html.includes('returnDamage=Math.max(0,defenderAttack)'));
  assert.ok(!html.includes('calculateDamageBeforeDuel(Math.max(0,(Number(base)||0)-1)'));
  assert.ok(html.includes('damageUnit(attacker,returnDamage,getElement(defender))'));
  assert.ok(html.includes("attacker.dataset.destroyed='true';triggerDeathrattle(attacker)"));
});
