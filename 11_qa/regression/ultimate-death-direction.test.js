import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');

test('복수 시작 카드의 절단선과 분리 방향은 칼빛 사선과 일치한다', () => {
  assert.ok(html.includes('rotate(-18deg) scaleX(0)'), '주 절단 칼빛은 우상향 사선이어야 한다');
  assert.ok(html.includes('clip-path:polygon(0 0,72% 0,63% 26%,55% 50%,45% 74%,34% 100%,0 100%)'));
  assert.ok(html.includes('transform:translate(-240px,120px)'));
  assert.ok(html.includes('transform:translate(250px,-120px)'));
});
