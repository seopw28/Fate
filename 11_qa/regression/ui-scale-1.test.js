const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const css = readFileSync(path.join(root, '05_game-client/app/styles.css'), 'utf8');
const shell = readFileSync(path.join(root, '05_game-client/app/index.shell.html'), 'utf8');
const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');

// 2026-11-08: 화면을 CSS zoom 0.9 로 줄여 보이던 구조를 없애고 1.0 기준 값으로 바꿨다(docs/plan-ui-scale-1.md).
// 축소가 다시 들어오면 효과 위치가 배율만큼 어긋나는 문제가 되살아난다.
test('화면 전체를 줄이는 축소 배율을 다시 쓰지 않는다', () => {
  for (const [name, text] of [['styles.css', css], ['index.shell.html', shell], ['dist/index.html', html]]) {
    assert.ok(!/(^|[;{\s])zoom\s*:/m.test(text), `${name}: CSS zoom 을 쓰면 안 된다`);
    assert.ok(!text.includes('--ui-scale'), `${name}: --ui-scale 배율 변수가 남아 있으면 안 된다`);
  }
  assert.ok(!shell.includes('data-ui-scale'), '?scale= 배율 스크립트가 남아 있으면 안 된다');
});

test('예전 축소 보정 대신 1.0 기준 높이를 쓴다', () => {
  assert.ok(css.includes('main.app { min-height:100vh; }'));
  assert.ok(css.includes('.command-rail, .stage-column { height:calc(100vh - 142.2px); }'));
  assert.ok(css.includes('.collection-shell { width:calc(100vw - 28.8px); height:calc(100vh - 28.8px); }'));
});

// 2026-11-08: 내 영웅 줄이 화면 하단으로 내려오며, 체력바 아래에서 시작하던 영웅 피해 숫자가 화면 밖으로 나갔다.
test('영웅 피해 숫자는 아래 공간이 모자라면 체력바 위에서 떠오른다', () => {
  assert.ok(html.includes("below=br.bottom+size*1.1"));
  assert.ok(html.includes("pop.style.top=(below<=innerHeight-6?below:br.top-6)+'px'"));
});
