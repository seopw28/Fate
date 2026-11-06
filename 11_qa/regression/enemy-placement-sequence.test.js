const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('상대 카드 세팅은 같은 프레임에 나타나지 않고 사용 순서대로 공개된다', () => {
  assert.ok(html.includes('function revealEnemyPlacementInOrder(unit)'));
  assert.ok(html.includes('enemyPlacementRevealAt=Math.max(now,enemyPlacementRevealAt)+combatMs(220)'));
  assert.ok(html.includes("unit.style.visibility='hidden'"));
  assert.ok(html.includes('revealEnemyPlacementInOrder(unit)'));
});
