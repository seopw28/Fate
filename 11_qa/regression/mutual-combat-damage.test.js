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
  assert.ok(html.includes("fieldAttack(defender,attacker,{label:'교환 '+returnDamage+' 피해',counter:true,onImpact:()=>"));
  assert.ok(html.includes('const outcome=applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
  assert.ok(html.includes("setTimeout(()=>attacker.remove(),900)"), '사망 카드는 반격 피격을 보여 준 뒤 제거해야 한다');
});

test('자동 공격은 반격이 구분된 뒤 다음 카드 공격을 시작한다', () => {
  assert.ok(html.includes('const PLAYER_AUTO_ATTACK_INTERVAL = 1150;'));
  assert.ok(html.includes('combatMs(index*PLAYER_AUTO_ATTACK_INTERVAL)'));
  assert.ok(html.includes('combatMs(attackers.length*PLAYER_AUTO_ATTACK_INTERVAL+250)'));
  assert.ok(!html.includes('combatMs(index*900)'));
});

test('상대가 공격해도 내 카드 공격력만큼 교환 피해가 반드시 적용되고 숫자로 표시된다', () => {
  assert.ok(html.includes('function showExchangeDamageNumber(target,damage,blocked)'));
  assert.ok(html.includes("badge.textContent=blocked?'교환 0 · 보호막':damage>0?'교환 −'+damage:'교환 0'"));
  assert.ok(!html.includes("if(!attacker.isConnected||attacker.dataset.destroyed==='true')return"));
  assert.ok(html.includes('applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
});
