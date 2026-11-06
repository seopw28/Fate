const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('궁극기 소진자의 전역 도발은 AI와 플레이어 기본 공격보다 우선한다', () => {
  assert.ok(html.includes("const ultimateAggro=targets.find(u=>u.dataset.ultimateAggro==='true')"));
  assert.ok(html.includes("priority=enemyLane.querySelector(':scope > .unit[data-ultimate-aggro=\"true\"]:not([data-destroyed=\"true\"])')"));
  assert.ok(html.includes("if(priority.dataset.ultimateAggro==='true')showUltimateAggroIntercept(priority)"));
});

test('전역 도발로 대상이 강제되면 화면과 전투 로그에 원인을 표시한다', () => {
  assert.ok(html.includes("showSkillEffect('shield',target,'전역 도발 · 공격 강제')"));
  assert.ok(html.includes('전역 도발이 공격 대상을 자신으로 강제했습니다.'));
  assert.ok(html.includes('showUltimateAggroIntercept(ultimateAggro);return ultimateAggro'));
});

test('전역 도발은 화상과 구분되는 두꺼운 짙은 회색 장갑 테두리로 표시한다', () => {
  assert.ok(html.includes('.unit[data-ultimate-aggro="true"]{border-color:#3f4854!important'));
  assert.ok(html.includes('0 0 0 7px #59636f'));
  assert.ok(html.includes('inset 0 0 0 2px #8d96a1'));
  assert.ok(!html.includes('.unit[data-ultimate-aggro="true"]{box-shadow:0 0 0 3px #ff315f'));
});

test('치명상을 받은 도발 카드는 반격·사망 제거가 끝나기 전에 다음 공격으로 넘기지 않는다', () => {
  assert.ok(html.includes("defender.dataset.destroyed='true';markCombatBusy(combatMs(COMBAT_TIMING.counterDelay+1100))"));
  assert.ok(html.includes('triggerDeathrattle(defender);defender.remove();'));
});

test('공격력 0 궁극기 소진자는 카드와 영웅에게 실제 피해 0을 준다', () => {
  assert.ok(html.includes('calculateDamage(Math.max(0,Math.ceil((attackerBase+attackerField.bonus+chainBonus)*ratio))'));
  assert.ok(html.includes("const baseAtk=Number(selected.querySelector('.stats span').textContent.replace(/[^0-9]/g,''))||0"));
  const queuedEnemyTurn = html.slice(html.indexOf('enemyTurn=function(done)'), html.indexOf('function playCard('));
  assert.ok(queuedEnemyTurn.includes("const baseAtk=Number(unit.querySelector('.stats span').textContent.replace(/[^0-9]/g,''))||0"));
});
