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

test('모든 속성 궁극기가 효과를 글로 설명한다', () => {
  /* 컷씬만 뜨고 무엇이 바뀌었는지 모르면 안 된다 — 6개 분기 전부 해설이 필요하다. */
  const calls = ult.match(/ultimateNarration\(spec,/g) || [];
  assert.equal(calls.length, 6, '불·물·얼음·번개·바람·대지 6개 분기 모두 해설해야 한다 (현재 ' + calls.length + '건)');
});

test('모든 속성 궁극기가 적용 대상을 링으로 표시한다', () => {
  const calls = ult.match(/markUltimateTargets\(/g) || [];
  assert.equal(calls.length, 6, '6개 분기 모두 대상을 표시해야 한다 (현재 ' + calls.length + '건)');
});

test('해설 문구에 구체적인 수치가 들어간다', () => {
  /* "강력한 일격" 같은 추상적 설명으로는 무엇이 변했는지 알 수 없다. */
  assert.ok(ult.includes("'상대 영웅에게 '+damage+' 피해'"), '단일 대상 피해량');
  assert.ok(ult.includes("'상대 챔프 전체에 '+damage+' 피해와 공격 −2'"), '물 궁극기 수치');
  assert.ok(ult.includes("'상대 챔프 전체에 '+damage+' 피해 후 동결'"), '얼음 궁극기 수치');
  assert.ok(ult.includes("'상대 챔프 전체와 상대 영웅에게 각각 '+damage+' 피해'"), '번개 궁극기 범위');
  assert.ok(ult.includes("'내 챔프 전체 공격 +'+windPlus"), '바람 궁극기 증가치');
  assert.ok(ult.includes('절대방어'), '대지 궁극기 효과명');
});

test('영웅 아바타도 조준 대상이 될 수 있다', () => {
  /* 궁극기는 유닛이 아니라 상대 영웅을 노리기도 한다. */
  assert.ok(ult.includes("markUltimateTargets([hero]"), '불·중립은 상대 영웅을 표시');
  assert.ok(ult.includes("document.querySelector('.duel-hud .enemy .avatar')]"), '번개는 적 챔프와 영웅을 함께 표시');
  assert.ok(ult.includes("document.querySelector('.player .avatar')]"), '대지는 내 영웅도 표시');
});

test('피해를 주는 광역 궁극기는 유닛마다 타격 연출을 남긴다', () => {
  /* 물·얼음은 아무 연출 없이 체력만 깎아 유닛이 소리없이 사라졌다. */
  const water = ult.slice(ult.indexOf("spec.element==='water'"));
  assert.ok(water.slice(0, 260).includes("showUnitSpellFx(unit,'water')"), '물 궁극기 타격 연출');
  const ice = ult.slice(ult.indexOf("spec.element==='ice'"));
  assert.ok(ice.slice(0, 260).includes("showUnitSpellFx(unit,'ice')"), '얼음 궁극기 타격 연출');
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
