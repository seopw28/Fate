const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');
const ult = html.slice(html.indexOf('function activateUltimate()'), html.indexOf('function syncSettingPanelVisibility()'));

test('궁극기 효과 해설과 대상 표시 헬퍼가 있다', () => {
  assert.ok(html.includes('function ultimateNarration(spec,summary)'), '효과 해설 헬퍼');
  assert.ok(html.includes('function markUltimateTargets(nodes,label,color)'), '궁극기 대상 표시 헬퍼');
  /* 효과문은 컷씬 타이핑 하나로 끝낸다. 나레이션 배너까지 띄우면 같은 설명을 연달아 두 번 읽힌다. */
  assert.ok(!html.includes("showEffectNarration('ultimate'"), '궁극기는 별도 해설 배너를 띄우지 않는다');
  assert.ok(html.includes('typeUltimateEffect(scene,spec.description)'), '설명은 컷씬 타이핑이 담당한다');
  assert.ok(html.includes("writeLog('<strong>'+spec.title+' · 궁극기:</strong> '+summary)"), 'summary는 전투 기록에 남는다');
});

test('설명을 글로 반복하는 대신 영향 대상을 눈으로 보여준다', () => {
  assert.ok(html.includes("node.classList.add('ult-affected')"), '영향을 받는 카드를 직접 밝힌다');
  assert.ok(html.includes('.unit.ult-affected, .avatar.ult-affected'), '강조 스타일');
  assert.ok(html.includes('@keyframes ult-affected-pulse'), '강조 애니메이션');
  assert.ok(html.includes('.spell-target-ring.ult { border-width:4px; animation-duration:1.8s; }'), '조준 링을 읽을 시간만큼 유지');
});

test('궁극기 효과는 소진자 강화 하나이고, 오라별 효과 5종은 삭제됐다', () => {
  for (const gone of ['홍련 종언', '빙해 봉인', '천공 해방', '절대성역', '운명 절단', '혹한의 감옥', '벽력 연쇄']) {
    assert.ok(!html.includes(gone), `${gone}: 오라별 궁극기 효과 이름이 남아 있다`);
  }
  for (const gone of ['aoeDamage', 'absoluteDefense=true;/* 소리는', 'reviveLastFallenAlly(\'절대성역', 'freezeUnit(unit);showSkillEffect(\'shield\',unit,\'동결 · \'+damage']) {
    assert.ok(!ult.includes(gone), `${gone}: 궁극기 발동 효과 분기가 남아 있다`);
  }
  assert.ok(!html.includes('function resolveEnemyUltimateEffect'), '컴퓨터의 오라별 효과 분기도 삭제');
  assert.ok(html.includes("return '소진자 강화 · 공격력 '+stats.attack+' · 체력 '+stats.hp") || html.includes("'소진자 강화 · 공격력 '+stats.attack+' · 체력 '+stats.hp"), '효과 설명은 소진자 강화 수치');
});

test('발동 시 소진자 하나만 대상으로 표시하고 수치를 해설한다', () => {
  assert.equal((ult.match(/ultimateNarration\(spec,/g) || []).length, 1, '해설은 소진자 강화 한 곳');
  assert.equal((ult.match(/markUltimateTargets\(/g) || []).length, 1, '대상 표시는 소진자 한 곳');
  assert.ok(ult.includes("markUltimateTargets([spent],'소진자 · 공격력 '+stats.attack+' · 체력 '+stats.hp"), '소진자 수치를 링 라벨로 보여준다');
});

test('캐릭터 필살 컷씬은 그대로 재생한다', () => {
  assert.ok(html.includes("if(spec.element==='wind')showUltimateCutscene('sakura',spec);"), '바람 계열 컷씬 유지');
  assert.ok(html.includes("if(spec.element==='water'||spec.element==='thunder')showUltimateCutscene('lightning-flow',spec);"), '물 계열 컷씬 유지');
  assert.ok(html.includes('typeUltimateEffect(scene,spec.description)'), '컷씬 문구는 spec.description(소진자 강화)을 쓴다');
});

test('효과 적용은 컷씬이 걷힌 뒤에 일어난다 (컷씬 아래 깔리지 않는다)', () => {
  const overlay = Number(html.match(/ULTIMATE_OVERLAY_MS=(\d+)/)[1]);
  const cutsceneHold = Number(html.match(/fxPresent\('ultimate:'\+kind[\s\S]{0,400}?hold:(\d+)\}/)[1]);
  assert.ok(html.includes('ULTIMATE_EFFECT_DELAY=ULTIMATE_OVERLAY_MS+30'), '효과는 오버레이 종료 직후에 적용된다');
  assert.ok(cutsceneHold < overlay + 30, '컷씬(' + cutsceneHold + 'ms)이 효과 적용 시점(' + (overlay + 30) + 'ms)보다 먼저 끝나야 한다');
});

test('조준 링은 필드 오버레이로 등록된 클래스를 쓴다', () => {
  assert.ok(html.includes("ring.className='spell-target-ring ult'"), '기존 조준 링 클래스를 재사용한다');
  const selector = html.slice(html.indexOf('const FIELD_OVERLAYS='));
  assert.ok(selector.slice(0, 400).includes('.spell-target-ring'), 'FIELD_OVERLAYS에 포함 (CLAUDE.md 규칙)');
});
