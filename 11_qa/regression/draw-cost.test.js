const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

/* 뽑기 비용이 2^n(2·4·8·16…)이라 4번째는 사실상 못 쓰는 선택지였고 상한이 없었다.
   3/6/9 고정 + 턴당 3회로 바꿨다 (2026-11-07). */

test('뽑기 비용은 3 / 6 / 9 고정이고 턴당 3번까지다', () => {
  assert.ok(html.includes('const DRAW_COSTS=[3,6,9]'), '비용표가 3/6/9 여야 한다');
  assert.ok(html.includes('DRAW_MAX_PER_TURN=DRAW_COSTS.length'), '상한은 표 길이에서 와야 둘이 어긋나지 않는다');
  assert.ok(!html.includes('DRAW_BASE_COST*2**drawActionsUsed'), '2^n 지수 비용으로 되돌리지 말 것');
});

test('상한은 버튼과 실행 양쪽에서 막힌다 (버튼만 막으면 우회된다)', () => {
  assert.ok(/reason=battlePhase!=='setup'\?'전투 진행 중':drawActionsUsed>=DRAW_MAX_PER_TURN\?'이번 턴 뽑기 모두 사용'/.test(html),
    '버튼에 사유가 떠야 한다');
  const use = html.slice(html.indexOf('function useDrawAction()'));
  assert.ok(use.slice(0, 300).includes('drawActionsUsed>=DRAW_MAX_PER_TURN'),
    '실행 경로에도 상한이 있어야 한다');
});

test('물 오라 각성은 첫 뽑기만 싸게 하고 6·9 는 그대로 둔다', () => {
  /* 전체를 깎으면 무한 드로우가 된다 — 첫 장만 내려가야 '싸게 한 장 더'에 머문다. */
  assert.ok(html.includes('function drawCostTable()'), '비용표를 고르는 함수가 있어야 한다');
  assert.ok(/return \[first,DRAW_COSTS\[1\],DRAW_COSTS\[2\]\]/.test(html), '두 번째·세 번째는 기본값을 그대로 쓴다');
  assert.ok(html.includes("playerGuardian==='cheongryong'"), '물 오라에만 적용된다');
  /* 폴백 코드에도 '...drawFirstCost:0' 이라는 같은 글자가 있어 그것만 보면 변이를 놓친다.
     선택지 정의부에 붙어 있는 값으로 고정한다. */
  assert.ok(/name:'범람'[^}]*drawFirstCost:0,/.test(html), '범람은 0 마나');
  assert.ok(/name:'순환'[^}]*drawFirstCost:1,/.test(html), '순환은 1 마나');
});

test('각성 선택지 설명이 실제 효과와 같은 숫자를 말한다', () => {
  /* 설명과 동작이 어긋나면 플레이어가 속는다. */
  assert.ok(html.includes("desc:'이번 턴 첫 카드 뽑기가 0 마나 (이후 6 · 9)'"), '범람 설명');
  assert.ok(/순환[^}]*첫 카드 뽑기가 1 마나/.test(html), '순환 설명');
  assert.ok(!html.includes("desc:'비용 2 이상 카드 사용 시 4.5% 확률로 마나 7 회복'"), '옛 범람 설명이 남으면 안 된다');
});

test('비용표를 못 읽어도 뽑기가 멈추지 않는다 (모듈 로드 순서)', () => {
  /* 각성 상태는 02 모듈의 const 라 01 로드 시점엔 TDZ 다. TDZ 는 typeof 조차 던진다. */
  assert.ok(/function drawCostTable\(\)\{try\{/.test(html), 'TDZ 를 try 로 감싸야 한다');
  assert.ok(/catch\(e\)\{return DRAW_COSTS;\}\}/.test(html), '닿지 않으면 기본 표로 돌아가야 한다');
});
