const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('10회 뽑기 예약 슬롯과 실제 결과는 같은 5열 카드 폭을 사용한다', () => {
  assert.ok(html.includes('.gacha-results { grid-template-columns:repeat(5,minmax(0,1fr))'));
  assert.ok(html.includes('.gacha-placeholder .ghosts { width:100%; display:grid; grid-template-columns:repeat(5,minmax(0,1fr))'));
  assert.ok(!html.includes('.gacha-results { grid-template-columns:repeat(auto-fill'));
});

test('작은 화면에서는 예약 슬롯과 결과가 모두 2열로 전환된다', () => {
  assert.ok(html.includes('.gacha-results{grid-template-columns:repeat(2,1fr)}'));
  assert.ok(html.includes('.gacha-placeholder .ghosts{grid-template-columns:repeat(2,minmax(0,1fr))}'));
});
