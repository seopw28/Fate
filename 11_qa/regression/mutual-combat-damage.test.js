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
  assert.ok(html.includes("function showDefenseShield(target,label){if(!target)return;sfx('shield');"));
  /* 전용 방패 연출은 평타 방어(방어함) 전용으로 남겨 둔다. 접두사 검사를 들고 있되,
     소리 재생 조건은 그보다 넓다 — 아래 '피해를 막은 연출' 테스트가 그쪽을 지킨다. */
  assert.ok(html.includes("if(String(label).startsWith('방어함')){showDefenseShield(target,label);return;}"));
  assert.ok(!html.includes("if(defense.defended){sfx('shield');showSkillEffect('shield',defender,'방어함 "));
});

test('피해를 막은 연출은 방어함이 아니어도 방어 사운드가 난다', () => {
  /* 확률 방어가 폐지돼 '방어함' 라벨이 사라지자 방어 효과음이 전혀 울리지 않았다.
     소리 조건이 라벨 접두사에 묶여 있던 탓이라, 다시 좁아지지 않도록 고정한다. */
  assert.ok(html.includes('const DAMAGE_BLOCK_LABELS='), '막은 연출 목록이 있어야 한다');
  assert.ok(html.includes("const blocksDamage=label=>DAMAGE_BLOCK_LABELS.some(word=>String(label).includes(word))"));
  assert.ok(html.includes("if(kind==='shield'&&blocksDamage(label))"), '소리 조건은 라벨 접두사가 아니라 막았는지로 판단해야 한다');
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
