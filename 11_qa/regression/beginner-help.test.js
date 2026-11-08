const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');

test('상단 안내 배너와 설명 토글은 폐지하고 튜토리얼 탭으로 이관했다', () => {
  assert.ok(!html.includes('beginner-overview'), '상단 요약 배너가 남아 있으면 안 된다');
  assert.ok(!html.includes('beginner-help-toggle'), '상단 설명 토글이 남아 있으면 안 된다');
  assert.ok(!html.includes('function toggleBeginnerHelp'));
  assert.ok(!html.includes('처음이라면, 이번 턴은 이렇게 해보세요'));
});

test('튜토리얼은 사운드 오른쪽의 on/off 토글이다', () => {
  assert.ok(html.includes('id="tutorial-toggle"'));
  assert.ok(html.includes('onclick="toggleTutorialMode()"'));
  assert.ok(html.includes('role="switch"'));
  assert.ok(html.includes('class="util-group"'), '사운드와 한 묶음의 보조 장치여야 한다');
  assert.ok(html.indexOf('id="sound-toggle"') < html.indexOf('id="tutorial-toggle"'), '사운드 오른쪽에 있어야 한다');
  assert.ok(!html.includes('tutorial-view'), '모달 탭 방식은 폐지했다');
  assert.ok(!html.includes("openCollectionDirect('tutorial')"));
});

test('튜토리얼을 켜면 설명이 나오고 상대 AI가 약해진다', () => {
  assert.ok(html.includes('function toggleTutorialMode'));
  assert.ok(html.includes('const TUTORIAL_HANDICAP={mistakeRate:.55,searchDepth:0}'));
  assert.ok(html.includes('return tutorialMode?{...base,...TUTORIAL_HANDICAP}:base'), '난이도 위에 핸디캡을 덧씌워야 한다');
  assert.ok(html.includes('beginnerHelpEnabled=tutorialMode'), '설명 UI는 토글을 따라간다');
  assert.ok(html.includes("const TUTORIAL_KEY='fate.tutorialMode'"), '선택은 저장되어야 한다');
  assert.ok(html.includes('function persistTutorialMode'));
});

test('보조 장치는 작게, 결제로 이어지는 상점 요소는 도드라지게 전시한다', () => {
  assert.ok(html.includes('.util-toggle { display:inline-flex'));
  assert.ok(html.includes('.util-group #sound-toggle { padding:4.5px 8.1px !important; font-size:9.9px'));
  assert.ok(html.includes('.top-nav-btn.shop { color:#ffdf9b'));
  assert.ok(html.includes('class="top-nav-btn main shop" href="#강화"'));
  assert.ok(html.includes('class="top-nav-btn main shop" href="#상점"'));
});

test('조작부에 붙는 짧은 맥락 설명은 그대로 남긴다', () => {
  assert.ok(html.includes('font-size:max(12.6px,.79rem)'));
  assert.ok(html.includes('.beginner-focus::after{display:block;animation:beginner-coach-in'));
  assert.ok(html.includes('function showBeginnerCoach'));
  assert.ok(html.includes('function startBeginnerGuideSequence'));
  assert.ok(html.includes('function showBeginnerEndTurnGuide'));
  assert.ok(html.includes('showBeginnerEndTurnGuide(2800)'));
  for (const label of ['이번 턴에 쓸 수 있는 마나예요. 카드 비용만큼 줄어요', '손패의 하수인을 누르면 여기에 소환돼요', '준비가 끝났다면 눌러 공격을 시작해요']) {
    assert.ok(html.includes(label), label + ' 맥락 설명이 있어야 한다');
  }
});
