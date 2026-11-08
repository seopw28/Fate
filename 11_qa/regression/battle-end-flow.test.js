const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('치명적인 상대 공격은 타격 순간에 판정하고 이후 예약 공격을 중단한다', () => {
  const enemyTurn = html.slice(html.indexOf('function enemyTurn('), html.indexOf('function selectUnit('));
  assert.ok(enemyTurn.includes('if(resultPending||!unit.isConnected'), '종료 후 예약된 상대 공격이 실행되면 안 된다');
  assert.ok(enemyTurn.includes("showSummonAttack(unit,'내 소환사',damage,()=>"), '본체 피해는 타격 콜백에서 처리해야 한다');
  assert.ok(enemyTurn.indexOf("showSummonAttack(unit,'내 소환사',damage,()=>") < enemyTurn.indexOf('playerHp=Math.max(0,playerHp-damage)'), 'HP가 공격 연출보다 먼저 줄면 안 된다');
  assert.ok(html.includes('const resolveDuelBeforeAuraBurn=resolveDuel'), '불 오라는 소환사 타격 콜백을 감싸지 않고 하수인 교전 뒤에만 화상을 판정해야 한다');
  assert.ok(!html.includes('showSummonAttackBeforePassion'), '삭제된 연속 공격 래퍼가 소환사 타격 콜백을 가로채면 안 된다');
});

test('승패 확정 시 전투 UI를 종료 상태로 정리하고 결과를 즉시 표시한다', () => {
  const finish = html.slice(html.indexOf('function settleBattleUi('), html.indexOf('function triggerBattlecry('));
  assert.ok(finish.includes("end.textContent='전투 종료'"));
  assert.ok(finish.includes("document.querySelectorAll('.initiative-banner,.effect-narration,.aura-awaken-choice')"));
  assert.ok(!finish.includes('animateCrackerTransfer(stolen'), '승리 결과가 보상 이동 연출 완료를 기다리면 안 된다');
  assert.ok(html.includes('<span>이전 티어</span>') && html.includes('<span>현재 티어</span>'), '결과 화면에 티어 변동을 표시해야 한다');
  assert.ok(html.includes('한 판 더 플레이하시겠습니까?'), '결과 화면에서 다시 플레이할지 물어야 한다');
  assert.ok(!html.includes("openCollection('codex');},2000"), '결과 이후 도감을 자동으로 열면 안 된다');
});
