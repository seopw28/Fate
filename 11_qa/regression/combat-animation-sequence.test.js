const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('공격·반격·추가 효과·다음 교전은 공통 타임라인 순서로 실행된다', () => {
  assert.ok(html.includes('counterDelay:1000,guardianReaction:2100,followUpDelay:2900,duelGap:4600,lastDuelSettle:3200,phaseTransition:250,initiativeLeadIn:500'));
  assert.ok(html.includes('const COMBAT_TIME_SCALE = 1.08'));
  assert.ok(html.includes('},COMBAT_TIMING.counterDelay);'));
  assert.ok(html.includes('},COMBAT_TIMING.followUpDelay);'));
  assert.ok(html.includes('},COMBAT_TIMING.guardianReaction);'));
  assert.ok(html.includes('const PLAYER_AUTO_ATTACK_INTERVAL = COMBAT_TIMING.duelGap;'));
  assert.ok(html.includes('combatMs(i*COMBAT_TIMING.duelGap)'));
});

test('마지막 교전은 다음 카드용 간격을 기다리지 않고 정산 직후 턴을 넘긴다', () => {
  assert.ok(html.includes('(attackers.length-1)*PLAYER_AUTO_ATTACK_INTERVAL+COMBAT_TIMING.lastDuelSettle'));
  assert.ok(html.includes('(enemyUnits.length-1)*COMBAT_TIMING.duelGap+COMBAT_TIMING.lastDuelSettle'));
  assert.ok(!html.includes('attackers.length*PLAYER_AUTO_ATTACK_INTERVAL+250'));
  assert.ok(!html.includes('enemyUnits.length*COMBAT_TIMING.duelGap+700'));
});

test('전투 종료 뒤 단계 전환과 상대 선공 준비는 별도의 짧은 지연만 사용한다', () => {
  assert.ok(html.includes('combatMs(COMBAT_TIMING.phaseTransition)'));
  assert.ok(html.includes('combatMs(COMBAT_TIMING.initiativeLeadIn)'));
  assert.ok(!html.includes('},combatMs(700));},attackDuration)'));
  assert.ok(!html.includes('},combatMs(1100));}else startPlayerTurn(button)'));
});

test('첫 타격이 치명적이어도 교전 시작 시 확정된 방어 카드의 반격은 실행된다', () => {
  assert.ok(html.includes('const defenderAttack=Number(defender.querySelector'));
  assert.ok(html.includes("if(!attacker.isConnected||!defender.isConnected)return;if(returnDamage<=0)"));
  assert.ok(!html.includes("if(!attacker.isConnected||!defender.isConnected||defender.dataset.destroyed==='true')return;if(returnDamage<=0)"));
  assert.ok(html.includes('combatMs(COMBAT_TIMING.counterDelay+1100)'));
});

test('여러 세트 마법은 한 연출이 끝난 뒤 다음 마법을 시작한다', () => {
  assert.ok(html.includes('spellGap:3400'));
  assert.ok(html.includes('order*COMBAT_TIMING.spellGap'));
});
