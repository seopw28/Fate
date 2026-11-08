const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require('node:path').resolve(__dirname, '../../dist/index.html'), 'utf8');

test('소환 마법진은 전장 축소 배율을 되돌려 카드 아래 중심에 정확히 놓인다', () => {
  const fn = html.slice(html.indexOf('function summonLandingImpact('), html.indexOf('function summonCardFlip('));
  assert.ok(fn.includes("x=r.left+r.width/2,y=r.bottom-5"), '목표점은 카드 가로 중심, 아래 끝');
  assert.ok(fn.includes('const p1=impactNode.getBoundingClientRect(),kx=(p1.left-p0.left)/100||1,ky=(p1.top-p0.top)/100||1;'), '실제 화면 배율을 재야 한다');
  assert.ok(fn.includes("impactNode.style.left=((x-(p0.left+p0.width/2))/kx)+'px';"));
  assert.ok(fn.includes("impactNode.style.top=((y-(p0.top+p0.height/2))/ky)+'px';"));
  assert.ok(!fn.includes("impactNode.style.left=(x-lr.left)+'px'"), '화면 좌표 차이를 그대로 넣으면 축소 배율만큼 왼쪽으로 밀린다');
});
