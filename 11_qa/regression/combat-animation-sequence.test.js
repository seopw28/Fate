const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('공격·반격·추가 효과·다음 교전은 공통 타임라인 순서로 실행된다', () => {
  assert.ok(html.includes('counterDelay:1000,guardianReaction:2100,followUpDelay:2900,postCombatPause:278,cardImpactTail:900,heroImpactTail:500,phaseTransition:250,initiativeLeadIn:278'));
  assert.ok(html.includes('const COMBAT_TIME_SCALE = 1.08'));
  assert.ok(html.includes('},COMBAT_TIMING.counterDelay);'));
  assert.ok(html.includes('},COMBAT_TIMING.followUpDelay);'));
  assert.ok(html.includes('},COMBAT_TIMING.guardianReaction);'));
  assert.ok(html.includes('function runCombatQueue(units,perform,done)'));
  assert.ok(html.includes('afterCombatSettles(next,hasNext)'));
});

test('각 교전은 실제 연출 완료 후 0.3초 쉬고 다음 공격을 시작한다', () => {
  assert.ok(html.includes('visualTail=combatQueueHasNext?(heroTarget?COMBAT_TIMING.heroImpactTail:COMBAT_TIMING.cardImpactTail):0'));
  assert.ok(html.includes('combatMs(COMBAT_TIMING.postCombatPause)'));
  assert.ok(html.includes('const delay=withPause?combatMs(COMBAT_TIMING.postCombatPause):0'));
  assert.ok(html.includes('runCombatQueue(attackers,unit=>'));
  assert.ok(html.includes('runCombatQueue(enemyUnits,unit=>'));
  assert.ok(!html.includes('PLAYER_AUTO_ATTACK_INTERVAL'));
});

test('영웅 직접 공격은 카드 피격보다 짧은 완료 시간을 사용한다', () => {
  assert.ok(html.includes("heroTarget=target.classList.contains('avatar')"));
  assert.ok(html.includes('heroTarget?COMBAT_TIMING.heroImpactTail:COMBAT_TIMING.cardImpactTail'));
  assert.ok(html.includes("target?.classList?.contains('avatar')?COMBAT_TIMING.heroImpactTail:COMBAT_TIMING.cardImpactTail"));
});

test('마지막 카드는 판정 뒤 잔여 파티클 타이머를 다음 단계에 강제하지 않는다', () => {
  assert.ok(html.includes('combatQueueHasNext=hasNext'));
  assert.ok(html.includes('visualTail=combatQueueHasNext?(heroTarget?COMBAT_TIMING.heroImpactTail:COMBAT_TIMING.cardImpactTail):0'));
  assert.ok(html.includes('if(combatQueueHasNext){const target=args[0],tail='));
  assert.ok(html.includes('afterCombatSettles(next,hasNext)'));
});

test('실제 각성 배너가 표시될 때만 전투 대기 시간을 등록한다', () => {
  assert.ok(html.includes('if(guardianAwakenActive(side)&&guardianOfSide(side)===id)markCombatBusy(1400)'));
  assert.ok(!html.includes('showAwakeningProc=function(...args){markCombatBusy(1400)'));
});

test('상대 공격도 콜백 기반 전투 큐가 끝난 뒤에만 턴을 넘긴다', () => {
  const queuedEnemyTurn = html.slice(html.indexOf('enemyTurn=function(done)'), html.indexOf('function playCard('));
  assert.ok(queuedEnemyTurn.includes('runCombatQueue(enemyUnits,unit=>'));
  assert.ok(queuedEnemyTurn.includes('},done);'));
  assert.ok(html.includes('enemyTurn(()=>beginNextRound(button))'));
  assert.ok(html.includes('enemyTurn(()=>startPlayerTurn(button))'));
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
