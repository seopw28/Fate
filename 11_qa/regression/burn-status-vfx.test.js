const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('일반 화상은 부여 순간부터 카드 하단의 지속 불꽃을 표시한다', () => {
  assert.match(html, /\.unit\[data-aura-burn\],\.unit\[data-burn\]/);
  assert.match(html, /function applyBurn\(target\).*?syncAuraBurnVfx\(target\)/s);
  assert.match(html, /function applyEternalBlackFlame\(target.*?syncAuraBurnVfx\(target\).*?꺼지지 않는 불꽃/s);
  assert.match(html, /bottom:-15px/);
});

test('화상 정산과 양쪽 정화는 지속 불꽃을 상태와 함께 제거한다', () => {
  assert.match(html, /function clearBurn\(target\).*?delete target\.dataset\.burn.*?syncAuraBurnVfx\(target\)/s);
  assert.match(html, /function resolveBurns\(\).*?clearBurn\(unit\)/s);
  assert.ok((html.match(/clearBurn\(unit\);clearAuraBurn\(unit\)/g) || []).length >= 2);
});

test('움직임 줄이기 환경에서도 정적인 화상 상태 표시는 남는다', () => {
  assert.match(html, /prefers-reduced-motion:reduce.*?\.unit\[data-burn\].*?animation:none/s);
  assert.doesNotMatch(html, /prefers-reduced-motion:reduce[^}]*aura-burn-vfx[^}]*display:none/s);
});
