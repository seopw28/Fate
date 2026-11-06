const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');

test('초보자 난이도는 설명 UI를 기본으로 켜고 상단 토글로 제어한다', () => {
  assert.ok(html.includes("beginnerHelpEnabled=key==='normal'"));
  assert.ok(html.includes("document.querySelector('.top-actions')?.prepend(toggle)"));
  assert.ok(html.includes('function toggleBeginnerHelp'));
  for (const label of ['남은 마나 확인', '비용이 낮은 챔프 선택', '준비가 끝나면 턴 종료']) {
    assert.ok(html.includes(label));
  }
});

test('난이도 선택지는 세로 3단 선택 박스다', () => {
  assert.ok(html.includes('grid-template-columns:minmax(0,1fr);gap:11px'));
  assert.ok(html.includes("['normal','초보자','설명과 함께 천천히','72%'"));
  assert.ok(html.includes("['nightmare','나이트메어','전술 대응','24%'"));
  assert.ok(html.includes("['hell','헬','최선수 탐색','4%'"));
});
