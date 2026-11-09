const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');

/* 2026-11-09 PM 요청(PRD 1-4): 튜토리얼은 대전과 별개인 기능 시연 가이드다. docs/plan-tutorial-guide.md */
test('옛 튜토리얼 모드(전투 중 설명, 상대 AI 약화)는 없앴다', () => {
  for (const gone of ['id="tutorial-toggle"', 'function toggleTutorialMode', 'TUTORIAL_HANDICAP', 'tutorialMode', 'beginnerHelpEnabled', 'function showBeginnerCoach', 'beginner-help', 'beginner-overview', '.util-toggle']) {
    assert.ok(!html.includes(gone), gone + ' 가 남아 있으면 안 된다');
  }
  assert.ok(html.includes('const enemyDifficultyConfig=()=>enemyDifficultyBase();'), '상대 AI는 자동 매칭 난이도만 따른다');
});

test('상단 튜토리얼 버튼은 사운드 오른쪽에서 새 튜토리얼을 연다', () => {
  assert.ok(html.includes('id="tutorial-open" type="button" onclick="openTutorialGuide()"'));
  assert.ok(html.includes('class="util-group"'));
  assert.ok(html.indexOf('id="sound-toggle"') < html.indexOf('id="tutorial-open"'), '사운드 오른쪽에 있어야 한다');
});

test('기능 6개를 전투 흐름 순서로 시연한다', () => {
  const order = ["key:'draw'", "key:'order'", "key:'auraMagic'", "key:'graveRecall'", "key:'awaken'", "key:'hero'"];
  const at = order.map(key => html.indexOf(key));
  at.forEach((pos, i) => assert.ok(pos > 0, order[i] + ' 단계가 있어야 한다'));
  assert.deepEqual([...at].sort((a, b) => a - b), at, '카드 뽑기 → 순서 바꾸기 → 오라 마법 → 묘지 회수 → 오라 각성 → 영웅 강림');
  for (const key of ['draw', 'order', 'auraMagic', 'graveRecall', 'awaken', 'hero']) {
    assert.ok(html.includes('TUTORIAL_GUIDE_SCENES.' + key + '={'), key + ' 시연 장면이 있어야 한다');
  }
});

test('완료 보상은 최초 1회 쿠키조각 200개, 건너뛰면 지급하지 않는다', () => {
  assert.ok(html.includes("const TUTORIAL_GUIDE_REWARD=200,TUTORIAL_GUIDE_REWARD_KEY='fate.tutorialGuide.rewarded';"));
  assert.ok(html.includes("return grantCookieFragments(TUTORIAL_GUIDE_REWARD,'tutorial','first-complete');"), '크래커가 아니라 쿠키조각으로 지급한다');
  assert.ok(html.includes("data-tg-skip]').addEventListener('click',()=>closeTutorialGuide(false))"), '건너뛰기는 보상 없이 닫는다');
  assert.ok(html.includes('const reward=grantTutorialGuideReward();'), '보상은 완료 화면에서만 지급한다');
});

test('보조 장치는 작게, 결제로 이어지는 상점 요소는 도드라지게 전시한다', () => {
  assert.ok(html.includes('.util-group #sound-toggle { padding:4.5px 8.1px !important; font-size:9.9px'));
  assert.ok(html.includes('.top-nav-btn.shop { color:#ffdf9b'));
  assert.ok(html.includes('class="top-nav-btn shop" href="#상점"'));
  assert.ok(html.includes('class="top-nav-btn" href="#강화"'));
  assert.ok(html.includes('class="collection-tab shop" data-view="gacha"'));
});
