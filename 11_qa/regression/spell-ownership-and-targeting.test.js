const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('마법·함정 공개 카드는 소유자를 클래스로 드러낸다', () => {
  /* 누구의 카드인지 모르는 연출이 뜨면 플레이어는 판을 읽을 수 없다. */
  assert.ok(html.includes("global.className='global-spell owner-player'"), '내 마법은 owner-player');
  assert.ok(html.includes("global.className='global-spell enemy-magic-activation owner-enemy'"), '상대 마법은 owner-enemy');
  assert.ok(html.includes("global.className='global-spell trap-activation '+side+' owner-'+side;"), '함정은 발동 측을 그대로 소유자로 쓴다');
});

test('소유자에 따라 카드가 들어오는 방향이 반대다 (상대=위, 나=아래)', () => {
  assert.ok(html.includes('.global-spell.owner-enemy .global-spell-card { animation:global-card-from-top'), '상대 카드는 위에서 내려온다');
  assert.ok(html.includes('.global-spell.owner-player .global-spell-card { animation:global-card-from-bottom'), '내 카드는 아래에서 올라온다');
  const top = html.slice(html.indexOf('@keyframes global-card-from-top'));
  assert.ok(top.slice(0, 200).includes('translateY(calc(var(--field-height,100vh) * -.55))'), '상대 카드 시작점은 필드 위쪽(음수)');
  const bottom = html.slice(html.indexOf('@keyframes global-card-from-bottom'));
  assert.ok(bottom.slice(0, 200).includes('translateY(calc(var(--field-height,100vh) * .55))'), '내 카드 시작점은 필드 아래쪽(양수)');
});

test('방향 애니메이션은 화면이 아니라 필드 높이를 기준으로 움직인다', () => {
  /* vh 기준으로 날아오면 필드 밖으로 새어나간다 (CLAUDE.md 필드 기준 규칙). */
  const block = html.slice(html.indexOf('@keyframes global-card-from-top'), html.indexOf('@keyframes global-card-from-bottom') + 400);
  assert.ok(!/translateY\(-?\d+vh\)/.test(block), '방향 이동에 vh 고정값을 쓰지 않는다');
  assert.ok(block.includes('var(--field-height'), '필드 높이 변수를 쓴다');
});

test('소유자 라벨을 한국어로 함께 표시한다', () => {
  assert.ok(html.includes('▼ 상대의 마법'), '상대 마법 라벨');
  assert.ok(html.includes('▲ 내 마법'), '내 마법 라벨');
  assert.ok(html.includes("'▼ 상대의 함정':'▲ 내 함정'"), '함정도 소유자를 글로 알린다');
});

test('마법 대상은 효과 적용 전에 조준 링으로 표시된다', () => {
  assert.ok(html.includes('function showSpellTargetRing(unit,label,color)'), '조준 링 헬퍼가 있어야 한다');
  assert.ok(html.includes('function markSpellTargets(units,label,color)'), '복수 대상 표시 헬퍼가 있어야 한다');
  assert.ok(html.includes('.spell-target-ring {'), '조준 링 스타일이 있어야 한다');
  assert.ok(html.includes("content:attr(data-label)"), '어떤 마법인지 링에 함께 적는다');
});

test('조준 링도 필드 오버레이로 등록되어 필드 기준으로 정리된다', () => {
  const selector = html.slice(html.indexOf("const FIELD_OVERLAYS="));
  assert.ok(selector.slice(0, 400).includes('.spell-target-ring'), 'FIELD_OVERLAYS에 포함돼야 한다 (CLAUDE.md 규칙)');
});

test('상대의 피해 효과도 대상을 먼저 공개한다', () => {
  /* 사용자 보고: "갑자기 어떤 카드가 죽어버려" — 상대 효과는 아무 표시가 없었다. */
  const fn = html.slice(html.indexOf("function enemyDamageUnits(units,damage"));
  const body = fn.slice(0, fn.indexOf('units.forEach'));
  assert.ok(body.includes('markSpellTargets('), '피해를 주기 전에 대상을 표시해야 한다');
  assert.ok(body.includes("'상대 효과 · '+Math.max(0,damage)+' 피해'"), '피해량까지 알려준다');
});

test('대상이 생기는 모든 내 마법이 조준 링을 띄운다', () => {
  for (const name of ['spellName', 'wipeName', 'boardName']) {
    assert.ok(html.includes("markSpellTargets(") && html.includes(name), name + ' 계열 마법도 대상을 표시한다');
  }
  assert.ok(html.includes("markSpellTargets(targets,spellName"), '단일·연쇄 번개 대상 표시');
  assert.ok(html.includes("markSpellTargets(wiped,wipeName"), '전체 파괴 대상 표시');
  assert.ok(html.includes("markSpellTargets([...allies,...enemies],boardName"), '전체 피해 대상 표시');
});
