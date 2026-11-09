const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');

test('덱 편집 넣기·빼기 피드백: 모든 경로가 addToDraft/removeFromDraft 공통 피드백을 거친다 (2026-11-09 PM)', () => {
  assert.ok(html.includes('function deckAddDenyReason(index)'), '거절 이유');
  assert.ok(html.includes('const baseAdd=addToDraft,baseRemove=removeFromDraft;'), '공통 피드백');
  assert.ok(html.includes("addToDraft(index);/* 막히는 경우도 addToDraft 피드백(이유 안내)으로 보낸다 */"), '드롭은 막혀도 이유 안내');
  assert.ok(html.includes("e.dataTransfer.dropEffect='move';/* 막혀도 놓기는 받아서"), '막혀도 놓기를 받는다');
});

test('브라우저 검사: 덱 편집 드래그 양방향과 피드백', (t) => {
  const probe = spawnSync('python3', ['-I', '-c', 'import playwright'], { encoding: 'utf8' });
  if (probe.status !== 0) { t.skip('python playwright 가 없어 건너뜀'); return; }
  const run = spawnSync('python3', ['-I', path.join(root, '12_tools/qa/check-deck-drag.py')], { encoding: 'utf8', timeout: 180000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /OK: 덱 편집 드래그 양방향과 피드백 확인/);
});

test('덱 편집 배치: 실행 버튼은 덱 목록 아래, 덱 목록은 필터 줄부터, 전체/하수인/마법 탭이 왼쪽 보유 카드와 같은 기준으로 거른다 (2026-11-09 PM)', () => {
  assert.ok(html.includes('class="deck-type-tabs"'), '덱 목록 유형 탭');
  assert.ok(html.includes("const typeOk=i=>deckTypeFilter==='all'||(deckTypeFilter==='spell')===collectionIsSpell[i]"), '덱 목록도 같은 deckTypeFilter');
  assert.ok(html.includes("actions.className='deck-actions';save.before(actions);"), '실행 버튼을 덱 목록 아래로');
  assert.ok(html.includes('grid-template-areas:"note note" "head head" "tools deck" "grid deck"'), '덱 목록을 필터 줄 높이까지 올린다');
});
