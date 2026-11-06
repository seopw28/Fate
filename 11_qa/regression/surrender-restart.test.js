const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('기권은 패배·티어 결과를 표시하고 사용자가 다시 하기를 선택할 때까지 기다린다', () => {
  const surrender = html.slice(html.indexOf('function surrenderBattle('), html.indexOf('function showBattleResult('));
  assert.ok(surrender.includes('resultPending=true'), '기권 즉시 예약된 전투 동작을 중단해야 한다');
  assert.ok(surrender.includes("showBattleResult(false,'기권했습니다. 기권은 패배로 계산됩니다.')"), '기권도 공통 패배·티어 결과를 표시해야 한다');
  assert.ok(surrender.includes('settleBattleUi()'), '기권 시에도 전투 UI를 종료 상태로 정리해야 한다');
  assert.ok(!html.includes('setTimeout(restartBattleToAuraSelect,1600)'), '사용자 선택 없이 새 판으로 자동 이동하면 안 된다');
  assert.ok(html.includes('onclick="restartBattleToAuraSelect()">다시 하기</button>'), '결과 화면에 명시적인 다시 하기 선택지가 있어야 한다');
  assert.ok(html.includes("next.searchParams.delete('guardian')") && html.includes("next.searchParams.delete('skipIntro')"), '자동 오라 선택용 QA 옵션이 다음 판까지 남으면 안 된다');
});

test('오라 선택 상태는 궁극기 패널의 최초 렌더링보다 먼저 초기화된다', () => {
  const guardianState = html.indexOf('let playerGuardian = null, enemyGuardian = null, guardianChosen = false');
  const initialHandRender = html.indexOf('updateHandTabs();');
  assert.ok(guardianState > 0 && guardianState < initialHandRender, '최초 손패·궁극기 렌더링에서 오라 상태 TDZ 오류가 나면 안 된다');
});
