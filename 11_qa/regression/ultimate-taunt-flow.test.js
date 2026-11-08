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
  assert.ok(html.includes('0 0 0 6.3px #59636f'));
  assert.ok(html.includes('inset 0 0 0 1.8px #8d96a1'));
  assert.ok(!html.includes('.unit[data-ultimate-aggro="true"]{box-shadow:0 0 0 3px #ff315f'));
});

test('치명상을 받은 도발 카드는 반격·사망 제거가 끝나기 전에 다음 공격으로 넘기지 않는다', () => {
  assert.ok(html.includes("defender.dataset.destroyed='true';markCombatBusy(combatMs(COMBAT_TIMING.counterDelay+1100))"));
  /* 제거 함수 이름이 아니라 '유언 뒤에 제거한다'는 순서를 본다. 2026-11-07 에 제거를
     removeFieldUnit(교전이 멎은 뒤로 미룸)으로 옮기면서, 이름을 박아둔 단정이 멀쩡한
     개선에 깨졌다. 공격 중 빈 자리가 생겨 맞는 카드가 옆으로 밀리던 문제를 고친 변경이다. */
  assert.ok(/triggerDeathrattle\(defender\);(defender\.remove\(\)|removeFieldUnit\(defender\))/.test(html),
    '유언을 처리한 뒤에 전장에서 뺀다');
});

test('공격력 0 궁극기 소진자는 카드와 소환사에게 실제 피해 0을 준다', () => {
  assert.ok(html.includes('rawDamage=attackerBase<=0?0:Math.max(0,Math.ceil((attackerBase+attackerField.bonus+chainBonus)*ratio))'));
  assert.ok(html.includes("const baseAtk=Number(selected.querySelector('.stats span').textContent.replace(/[^0-9]/g,''))||0"));
  assert.ok(html.includes('damage=baseAtk<=0?0:baseAtk+field.bonus+chainBonus'), '내 공격력 0 카드는 소환사 공격 보너스를 받아도 피해 0이어야 한다');
  const queuedEnemyTurn = html.slice(html.indexOf('enemyTurn=function(done)'), html.indexOf('function playCard('));
  assert.ok(queuedEnemyTurn.includes("const baseAtk=Number(unit.querySelector('.stats span').textContent.replace(/[^0-9]/g,''))||0"));
  assert.ok(queuedEnemyTurn.includes('damage=baseAtk<=0?0:baseAtk+field.bonus'), '상대 공격력 0 카드도 소환사에게 피해를 줄 수 없어야 한다');
});
