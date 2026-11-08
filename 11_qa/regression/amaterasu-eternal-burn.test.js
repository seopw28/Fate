const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('아마테라스는 적 한 명에게 99턴 지속 화상을 부여한다', () => {
  assert.ok(html.includes("target.dataset.eternalBurn='3'"));
  assert.ok(html.includes("target.dataset.eternalBurnTurns='99'"));
  assert.ok(html.includes("if(result.hp>0)applyEternalBlackFlame(target,'아마테라스')"));
  /* 99턴은 내부 지속값일 뿐 화면에는 보이지 않는다 (2026-11-08 PM) */
  assert.ok(html.includes("eternalDamage&&eternalTurns?'꺼지지 않는 불꽃 −'+eternalDamage:"));
  assert.ok(!html.includes("꺼지지 않는 불꽃 · 99턴"));
});

test('꺼지지 않는 불꽃은 매 대상 턴 시작에 피해를 주며 정화로 제거되지 않는다', () => {
  assert.ok(html.includes("label=eternal?'꺼지지 않는 불꽃'"));
  assert.ok(html.includes("unit.dataset[eternal?'eternalBurnTurns':'auraBurnTurns']=String(remaining)"));
  assert.ok(!html.includes('clearBurn(unit);clearAuraBurn(unit);delete unit.dataset.eternalBurn'));
});

test('상대 아마테라스도 같은 99턴 화상을 사용한다', () => {
  assert.ok(html.includes("applyEternalBlackFlame(strongest,'상대 아마테라스')"));
});
