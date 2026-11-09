const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('오라 각성 진행 중에는 다른 행동을 막는다: 버튼을 누르는 순간 잠그고 강림 연출이 끝나면 푼다 (2026-11-09)', () => {
  assert.ok(html.includes("startGraveRecall();setBattlePhase('awakening');const g=GUARDIANS[playerGuardian]"), '각성 시작에 잠근다');
  assert.ok(html.includes("Promise.resolve(playGuardianDescent(playerGuardian,summary)).then(()=>{if(battlePhase==='awakening'&&!resultPending)setBattlePhase('setup');});"), '강림 연출이 끝나면 푼다');
  assert.ok(html.includes("if(!guardianAwakenChoice){lowerAwakenSlot();if(battlePhase==='awakening'&&!resultPending)setBattlePhase('setup');}"), '고르지 않고 끊겨도 풀린다');
  assert.ok(html.includes("next==='awakening'?'오라 각성 진행 중'"), '잠긴 이유를 안내한다');
  assert.ok(html.includes("closeHeroPick();if(typeof graveRecallPicking!=='undefined'&&graveRecallPicking)startGraveRecall();setBattlePhase('awakening')"), '열려 있던 영웅 고르기와 묘지 회수 고르기를 닫는다');
});
