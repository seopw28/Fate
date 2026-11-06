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

test('초보자 안내는 최소 14px이며 조작부를 가리지 않고 애니메이션으로 노출된다', () => {
  assert.ok(html.includes('font-size:max(14px,.88rem)'));
  assert.ok(html.includes('.command-rail .hand-tabs[data-beginner-label]::after,.command-rail .hand[data-beginner-label]::after{left:auto;right:calc(100% + 14px)'));
  assert.ok(html.includes('.turn-actions [data-beginner-label]::after{left:auto;right:calc(100% + 14px)'));
  assert.ok(html.includes('.beginner-focus::after{display:block;animation:beginner-coach-in'));
  assert.ok(html.includes('function showBeginnerCoach'));
  assert.ok(html.includes('function startBeginnerGuideSequence'));
  assert.ok(html.includes('function showBeginnerEndTurnGuide'));
  assert.ok(html.includes("showBeginnerCoach('#beginner-help-toggle','설명이 필요할 때는 이 토글로 언제든 켜고 끌 수 있어요.'"));
  assert.ok(html.includes('.beginner-help-toggle[data-beginner-label]::after{left:auto;right:0;top:calc(100% + 9px)'));
  assert.ok(html.includes("showBeginnerEndTurnGuide(2800)"));
  assert.ok(html.includes('이제 턴 종료를 눌러 공격을 시작하세요.'));
  assert.ok(html.includes("event.target.closest('.hand .card')"));
});

test('첫 턴 요약 안내는 4.8초 뒤 자동으로 닫히고 조작을 시작하면 즉시 사라진다', () => {
  assert.ok(html.includes('beginnerOverviewTimer=setTimeout(hideBeginnerOverview,4800)'));
  assert.ok(html.includes('function hideBeginnerOverview()'));
  assert.ok(html.includes("if(card){hideBeginnerOverview()"));
  assert.ok(html.includes("if(tab){hideBeginnerOverview()"));
  assert.ok(html.includes("event.target.closest('#draw-action')){hideBeginnerOverview()"));
});
