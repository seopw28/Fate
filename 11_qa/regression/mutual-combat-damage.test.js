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

test('교환 피해는 반격 이펙트 없이 체력 수치로만 처리한다', () => {
  assert.ok(html.includes('function applyNumericExchangeDamage(target,damage,element)'));
  assert.ok(html.includes('impact=()=>{};shieldBreakFx=()=>{};showSkillEffect=()=>{};showAwakeningProc=()=>{};sfx=()=>{}'));
  assert.ok(html.includes('applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
});

test('상대가 공격해도 내 카드 공격력만큼 교환 피해가 반드시 적용되고 숫자로 표시된다', () => {
  assert.ok(html.includes('function showExchangeDamageNumber(target,damage,blocked)'));
  assert.ok(html.includes("badge.textContent=blocked?'교환 0 · 보호막':damage>0?'교환 −'+damage:'교환 0'"));
  assert.ok(!html.includes("if(!attacker.isConnected||attacker.dataset.destroyed==='true')return"));
  assert.ok(html.includes('applyNumericExchangeDamage(attacker,returnDamage,defenderElement)'));
});
