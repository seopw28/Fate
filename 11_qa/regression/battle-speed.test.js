const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('전투 배속: 1배속/2배속 토글이 있고 선택값을 이 기기에 저장한다 (2026-11-09)', () => {
  assert.ok(html.includes("const BATTLE_SPEED_KEY='fate.battleSpeed'"));
  assert.ok(html.includes("function toggleBattleSpeed(){battleSpeed=battleSpeed>1?1:2;"));
  assert.ok(html.includes("button.textContent=battleSpeed>1?'⏩ 2배속':'▶ 1배속'"));
});

test('전투 배속: 대기, 시계, 애니메이션이 같은 배속으로 함께 빨라져 연출 순서가 어긋나지 않는다', () => {
  assert.ok(html.includes('window.setTimeout=function(handler,delay,...args){return nativeSetTimeout(handler,scaled(delay),...args);}'));
  assert.ok(html.includes('performance.now=function(){'), '마감 시각 비교도 같은 배속으로 흐른다');
  assert.ok(html.includes('Element.prototype.animate=function(...args){'));
  assert.ok(html.includes("document.addEventListener('animationstart',onCssAnimation,true)"));
  assert.ok(html.includes('animation.playbackRate=(typeof battleSpeedActive===\'function\'&&battleSpeedActive()?battleSpeed:1)/COMBAT_TIME_SCALE;'), '전투 애니메이션 감속도 배속을 따른다');
  assert.ok(html.includes("return battleSpeed>1&&!battleSpeedCollectionOpen;"), '컬렉션 화면에는 적용하지 않는다');
});

test('전투 배속 버튼은 전장 맨 끝에 붙어 상대 줄(.lane:first-child) 찾기를 깨지 않는다', () => {
  assert.ok(html.includes('arena.appendChild(button)'));
  assert.ok(!html.includes('<div class="arena"><button'));
});
