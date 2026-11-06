import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');

test('복수 시작 카드의 절단선과 분리 방향은 칼빛 사선과 일치한다', () => {
  assert.ok(html.includes('--spent-cut-angle:-18deg'), '절단 각도는 한 변수에서 관리해야 한다');
  assert.ok(html.includes('rotate(var(--spent-cut-angle)) scaleX(0)'), '칼빛은 공통 절단 각도를 사용해야 한다');
  assert.ok(html.includes('clip-path:polygon(0 0,100% 0,100% var(--spent-cut-right-y),0 var(--spent-cut-left-y))'));
  assert.ok(html.includes('clip-path:polygon(0 var(--spent-cut-left-y),100% var(--spent-cut-right-y),100% 100%,0 100%)'));
  assert.ok(html.includes('transform:translate(-95px,-220px)'), '윗조각은 절단선의 법선 방향인 좌상단으로 이동해야 한다');
  assert.ok(html.includes('transform:translate(100px,225px)'), '아랫조각은 절단선의 법선 방향인 우하단으로 이동해야 한다');
  assert.ok(html.includes('.ultimate-spent-death::after{content:none}'), '다른 각도의 보조 칼빛이 절단 방향을 혼동시키면 안 된다');
});
