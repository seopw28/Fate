const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('기권은 일반 전투 렌더링 종료와 무관하게 결과를 표시하고 새 게임으로 복귀한다', () => {
  const surrender = html.slice(html.indexOf('function surrenderBattle('), html.indexOf('function showBattleResult('));
  assert.ok(surrender.includes('resultPending=true'), '기권 즉시 예약된 전투 동작을 중단해야 한다');
  assert.ok(surrender.includes("showBattleResult(false,'기권했습니다. 기권은 패배로 계산됩니다.',true)"), '기권 패배 결과가 새 게임 복귀 경로로 표시되어야 한다');
  assert.ok(!surrender.includes("setBattlePhase('ended')"), '기권 복귀가 전투 렌더링 정리에 의존하면 안 된다');
  assert.ok(html.includes('setTimeout(()=>location.reload(),1600)'), '결과 표시 후 시작 화면을 새로 불러와야 한다');
});
