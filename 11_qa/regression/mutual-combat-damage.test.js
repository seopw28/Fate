const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('카드 대 카드 교전은 양쪽이 상대 공격력만큼 피해를 받는다', () => {
  assert.ok(html.includes('const resolveDuelBeforeMutualDamage=resolveDuel'));
  assert.ok(html.includes('returnDamage=Math.max(0,defenderAttack)'));
  assert.ok(!html.includes('calculateDamageBeforeDuel(Math.max(0,(Number(base)||0)-1)'));
  assert.ok(html.includes('applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
  assert.ok(html.includes("attacker.dataset.destroyed='true';triggerDeathrattle(attacker)"));
});

test('교환 피해는 방어 카드의 반격 이동·타격 이펙트 후 적용한다', () => {
  assert.ok(html.includes('function applyNumericExchangeDamage(target,damage,element)'));
  assert.ok(!html.includes('impact=()=>{};shieldBreakFx=()=>{};showSkillEffect=()=>{};showAwakeningProc=()=>{};sfx=()=>{}'));
  assert.ok(html.includes("fieldAttack(defender,attacker,{label:'반격 '+returnDamage+' 피해',counter:true,onImpact:()=>"));
  assert.ok(html.includes('const outcome=applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
  assert.ok(html.includes("setTimeout(()=>attacker.remove(),900)"), '사망 카드는 반격 피격을 보여 준 뒤 제거해야 한다');
});

test('방어함 표시는 전용 방패 연출과 동시에 방어 사운드를 반드시 재생한다', () => {
  assert.ok(html.includes("function showDefenseShield(target,label){if(!target)return;playShieldSfx();"), '전용 방패 연출도 소리를 낸다');
  /* 전용 방패 연출은 평타 방어(방어함) 전용으로 남겨 둔다. 접두사 검사를 들고 있되,
     소리 재생 조건은 그보다 넓다 — 아래 '피해를 막은 연출' 테스트가 그쪽을 지킨다. */
  assert.ok(html.includes("if(String(label).startsWith('방어함')){showDefenseShield(target,label);return;}"));
  assert.ok(!html.includes("if(defense.defended){sfx('shield');showSkillEffect('shield',defender,'방어함 "));
});

test('같은 찰나에 겹치는 방어음은 한 번만 난다', () => {
  /* 절대방어 궁극기는 아군 수만큼 showSkillEffect 를 돈다. 카드마다 소리를 내면
     6장일 때 '퍽'이 6번 겹쳐 뭉개진 굉음이 된다. 연출은 카드마다, 소리는 한 번. */
  assert.ok(html.includes('function playShieldSfx()'), '방어음은 한 군데로 모아 낸다');
  assert.ok(html.includes('const SHIELD_SFX_MIN_GAP='), '겹침 판정 간격');
  assert.ok(html.includes('if(now-lastShieldSfxAt<SHIELD_SFX_MIN_GAP)return'), '간격 안이면 건너뛴다');
  /* 중복 호출이 되살아나지 않게 못박는다 — showSkillEffect 가 이미 소리를 낸다 */
  assert.ok(!html.includes("showSkillEffect('shield',unit,'불가침 · 이번 턴 무적');sfx('shield')"), '불가침 중복');
  assert.ok(!html.includes("sfx('shield');showSkillEffect('shield',target,'무적 · 피해 무효')"), '무적 중복');
  assert.ok(!html.includes("function shieldBreakFx(target){if(!target?.isConnected)return;sfx('shield')"), '보호막 파괴 중복');
  assert.ok(!html.includes("absoluteDefense=true;sfx('shield')"), '절대방어 궁극기 중복');
});

test('폐지된 확률 방어의 죽은 코드를 남기지 않는다', () => {
  /* PRD: 기본 공격에 '일반 확률 방어를 적용하지 않는다'. 그런데 늘 defended:false 를
     돌려주는 껍데기가 남아, 그 값을 보는 '방어함 N%' 연출과 전투 기록이 영영 실행되지
     않는 죽은 코드로 있었다. 되살아나면 PRD 와 어긋난다. */
  assert.ok(!html.includes('function rollCardDefense('), '폐지된 확률 방어 함수가 남으면 안 된다');
  assert.ok(!html.includes('defense.defended'), '항상 false 인 값을 보는 분기가 남으면 안 된다');
  assert.ok(!html.includes('defense.chance'), '항상 0 인 확률 표시가 남으면 안 된다');
  /* 관통(armor-pierce)은 확률 방어와 별개 규칙이라 살아 있어야 한다 */
  assert.ok(html.includes('function consumeArmorPierce(defender)'), '관통 소비는 유지된다');
  assert.ok(html.includes("if(defender.dataset.shield!=='true')consumeArmorPierce(defender)"), '관통은 평타 교환에서 소비된다');
  assert.ok(html.includes("defender.dataset.survivePierced='true'"), '관통 표시는 불굴 판정이 읽는다');
});

test('정지된 오디오에서는 소리를 예약하지 않고 재개된 뒤에 낸다', () => {
  /* AudioContext 가 suspended 면 currentTime 이 0 에 멈춘다. 그 시각으로 예약하면
     resume 뒤에는 이미 과거라 소리가 통째로 버려진다 — 노드는 생기는데 안 들린다.
     방어음이 '간간히' 안 들리던 원인. 여유 시간을 더하는 식으로는 못 막는다
     (resume 지연이 정해져 있지 않다 — 실측 0.08s 예약 vs 재개 시계 0.443s). */
  assert.ok(html.includes("if(ctx.state==='suspended'){whenAudioReady(ctx,()=>tone("), 'tone 은 정지 중 예약하면 안 된다');
  assert.ok(html.includes("if(ctx.state==='suspended'){whenAudioReady(ctx,()=>noise("), 'noise 는 정지 중 예약하면 안 된다');
  assert.ok(html.includes('function whenAudioReady(ctx,play)'), '재개 뒤 재생 헬퍼');
  assert.ok(html.includes("ctx.addEventListener('statechange',onReady)"), 'resume 완료를 statechange 로 기다려야 한다');
  assert.ok(html.includes('function flushPendingAudio()'), '밀린 소리 처리');
  assert.ok(html.includes('queued[queued.length-1]()'), '밀린 소리는 마지막 하나만 — 전부 쏟으면 굉음이 된다');
  /* 되돌아가기 쉬운 형태를 막는다: currentTime 에 상수를 더해 미래로 미루는 방식 */
  assert.ok(!html.includes('AUDIO_RESUME_LEAD'), '여유 시간을 더하는 방식은 resume 지연이 가변이라 통하지 않는다');
});

test('피해를 막은 연출은 방어함이 아니어도 방어 사운드가 난다', () => {
  /* 확률 방어가 폐지돼 '방어함' 라벨이 사라지자 방어 효과음이 전혀 울리지 않았다.
     소리 조건이 라벨 접두사에 묶여 있던 탓이라, 다시 좁아지지 않도록 고정한다. */
  assert.ok(html.includes('const DAMAGE_BLOCK_LABELS='), '막은 연출 목록이 있어야 한다');
  assert.ok(html.includes("const blocksDamage=label=>DAMAGE_BLOCK_LABELS.some(word=>String(label).includes(word))"));
  assert.ok(/if\(kind==='shield'&&\(?blocksDamage\(label\)/.test(html), '소리 조건은 라벨 접두사가 아니라 막았는지로 판단해야 한다');
  /* 보호막을 실제로 걸었는데 라벨에 '보호막'이 없으면 소리가 빠진다 — 뮤테의 세라피나('힐링
     블레스')가 그랬다. 라벨뿐 아니라 걸린 상태도 함께 본다 (2026-11-07) */
  assert.ok(html.includes("target?.dataset?.shield==='true'"), '보호막이 걸린 상태도 방어음 조건이어야 한다');
  assert.ok(html.includes("'힐링 블레스 · 보호막 · +'"), '힐링 블레스는 보호막을 준다는 것이 라벨에 드러나야 한다');
  const list = html.match(/const DAMAGE_BLOCK_LABELS=\[([^\]]*)\]/)[1];
  for (const word of ['방어함', '보호막', '철벽', '무적', '절대방어']) {
    assert.ok(list.includes(word), word + '으로 막은 연출도 소리가 나야 한다');
  }
  /* 동결·도발은 피해를 막는 게 아니라 상태 변화다 — '퍽' 소리가 방어 신호로만 남아야 한다 */
  for (const word of ['동결', '빙결', '도발', '고독']) {
    assert.ok(!list.includes(word), word + '은(는) 피해를 막는 연출이 아니다');
  }
  /* GUARDIANS는 02 모듈에서 정의되므로 01 모듈의 이 목록에서 참조하면 로딩 때 터진다 */
  assert.ok(!/const DAMAGE_BLOCK_LABELS=\[[^\]]*GUARDIANS/.test(html), '목록은 리터럴이어야 한다');
});

test('자동 공격은 반격이 구분된 뒤 다음 카드 공격을 시작한다', () => {
  assert.ok(html.includes('function runCombatQueue(units,perform,done)'));
  assert.ok(html.includes('combatQueueHasNext=hasNext;combatBusyUntil=performance.now();perform(unit)'));
  assert.ok(html.includes('afterCombatSettles(next,hasNext)'));
  assert.ok(html.includes('postCombatPause:278'));
  assert.ok(!html.includes('PLAYER_AUTO_ATTACK_INTERVAL'));
});

test('상대가 공격해도 내 카드 공격력만큼 교환 피해가 반드시 적용되고 숫자로 표시된다', () => {
  assert.ok(html.includes('function showExchangeDamageNumber(target,damage,blocked)'));
  assert.ok(html.includes("badge.textContent=blocked?'교환 0 · 보호막':damage>0?'교환 −'+damage:'교환 0'"));
  assert.ok(!html.includes("if(!attacker.isConnected||attacker.dataset.destroyed==='true')return"));
  assert.ok(html.includes('applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
});
