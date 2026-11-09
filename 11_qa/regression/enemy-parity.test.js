const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');

/* 2026-11-08 PM 지시: 컴퓨터에 제한을 걸지 않는다. 사람과 같은 행동을 같은 비용·조건으로 쓴다.
   번들 문자열로 구조를 고정하고, 동작은 마지막 테스트가 브라우저 검사(check-enemy-parity.py)로 확인한다. */

const between = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));

test('컴퓨터 카드 뽑기: 유저와 같은 비용(2×2^(n-1))·손패 8장 상한·별도 카운터', () => {
  assert.ok(html.includes('let enemyDrawActionsUsed = 0, enemyBloodManaUses = 0, enemyBloodManaBattleUses = 0, enemyTurnsTaken = 0;'));
  assert.ok(html.includes('function enemyDrawQuote(){const cost=DRAW_BASE_COST*2**enemyDrawActionsUsed,base=enemyBloodManaQuote(cost),'), '혈마나 카드 뽑기 누적(2026-11-09)을 더한 견적');
  const act = between('function performEnemyDrawAction()', 'function summonEnemyPriorityChampion');
  assert.ok(act.includes('if(enemyHand.length>=8)return false;'));
  assert.ok(act.includes('enemyDrawActionsUsed++;enemyDraw();'));
  assert.ok(act.includes('상대가 카드 뽑기'), '유저가 볼 수 있게 로그를 남긴다');
  assert.ok(html.includes('enemyDrawActionsUsed=0;enemyBloodManaUses=0;enemyAutoDraw();'), '턴 시작에 횟수를 초기화한다');
});

test('컴퓨터 혈마나: 유저와 같은 공식(배틀 첫 1번 마나 1당 체력 1, 이후 2+이번 턴 횟수), 지불 뒤 체력 1 이상, 1턴부터', () => {
  assert.ok(html.includes('const enemyBloodManaRate=()=>enemyBloodManaBattleUses===0?BLOOD_MANA_FIRST_RATE:BLOOD_MANA_BASE_RATE+enemyBloodManaUses*BLOOD_MANA_RATE_STEP;'));
  assert.ok(html.includes('function recordEnemyBloodManaUse(){if(enemyBloodManaBattleUses++===0)return;enemyBloodManaUses++;}'));
  assert.ok(html.includes('unlocked=turnNumber>=BLOOD_MANA_UNLOCK_TURN;return {shortage,rate,healthCost,unlocked,affordable:shortage===0||(unlocked&&enemyHp>healthCost)}'));
  assert.ok(html.includes('상대 혈마나 ♥'), '상대 혈마나 로그');
  assert.ok(html.includes("showBloodManaSpend(healthCost,'enemy')"), '상대 소환사 쪽에 혈마나 연출');
  /* 마법(비함정)은 유저처럼 마나로만 쓴다 */
  assert.ok(html.includes('x.card.spell&&x.card.cost<=enemyMana')||html.includes('x.card.cost<=enemyMana'));
  assert.ok(!between('function setEnemyMagic()', 'function resolveEnemySpell').includes('else enemyPayCost(card.cost,\'마법'), '마법에는 혈마나를 쓰지 않는다 (함정만 혈마나 허용)');
});

test('컴퓨터 소환·교체·뽑기는 한 박자씩 보여 주고 손패·덱 라벨을 갱신한다', () => {
  const loop = between('for(let step=0;step<8;step++){', 'const laneSettle=arrangeEnemyLane(lane);');
  assert.ok(loop.includes('enemyPlanSummons(lane)') && loop.includes('enemyPlanReplace(lane)') && loop.includes('performEnemyDrawAction()'));
  assert.ok(loop.includes('combatMs(ENEMY_ACTION_BEAT_MS)') && loop.includes('combatMs(ENEMY_PLAY_GAP_MS)'));
  assert.ok(loop.includes('enemyPayCost(data.cost,data.name);enemySummonUnit(lane,data);enemyCardPlayedHook(data.cost);'));
  assert.ok(loop.includes('updateEnemyDeckLabel()'));
  assert.ok(html.includes("label.textContent='덱 '+enemyDeck.length+'장 · 손패 '+enemyHand.length+'장'"));
});

test('컴퓨터 필드 교체: 가득 찬 전장에서만, 비용은 유저와 같다(마나 + 소환사 체력 = 새 카드 비용), 원래 카드는 묘지로', () => {
  const plan = between('function enemyPlanReplace(lane)', 'function replaceEnemyUnit');
  assert.ok(plan.includes('if(all.length<FIELD_CARD_LIMIT)return null;'));
  assert.ok(plan.includes('x.card.cost<=enemyMana&&enemyHp>x.card.cost'));
  assert.ok(plan.includes('ENEMY_REPLACE_MIN_GAIN'));
  const swap = between('function replaceEnemyUnit(', 'function enemyWantsDraw');
  assert.ok(swap.includes('enemyMana-=data.cost;enemyHp-=hpCost;'));
  assert.ok(swap.includes("buryOrVanish('enemy',"), '원래 카드는 묘지로(소진자와 복수자는 소멸, 2026-11-08)');
  assert.ok(swap.includes('enemySummonUnit(lane,data,slot)'));
  assert.ok(html.includes('function replaceHpCost(card){return Number(card?.querySelector(\'.cost\')?.textContent)||0;}'), '유저 교체 비용 정의가 그대로다');
});

test('시작 손패: 유저·컴퓨터가 같은 보장(시작 마나 이하 하수인 2장 + 함정 아닌 마법 1장)을 쓴다', () => {
  assert.ok(html.includes('function openingHandIndexes(pile){'));
  assert.ok(html.includes('let enemyHand = takeCards(enemyDeck,openingHandIndexes(enemyDeck)).map(gradeCardData);'));
  assert.ok(!html.includes('enemyDeck.splice(0,5)'), '덱 위에서 그냥 5장을 떼지 않는다');
  assert.ok(html.includes('function takeOpeningHand(){return takeCards(deck,openingHandIndexes(deck)).map(entry=>entry.cardId);}'));
});

test('첫 턴 자동 드로우: 컴퓨터도 자기 첫 턴에는 뽑지 않는다', () => {
  assert.ok(html.includes('function enemyAutoDraw(){if(enemyTurnsTaken++===0)return false;enemyDraw();return true;}'));
  assert.ok(!html.includes('enemyRecycleIfNoChampion();enemyDraw();'));
});

test('손패 8장 상한: 유저 턴 시작 자동 드로우도 8장이면 뽑지 않는다', () => {
  assert.ok(html.includes("lastAttackElement=null;if(document.querySelectorAll('.hand .card').length<8)drawCard();"));
});

test('물 오라: 컴퓨터도 비용 2 이상 카드를 낼 때 확률로 마나 회복(이번 턴 최대 마나 상한), 턴 시작 최대 마나 상승은 없다', () => {
  assert.ok(html.includes("enemyCardPlayedHook=function(cost){if(cost<2||resultPending||!guardianProc('enemy','cheongryong'))return;const gain=Math.max(0,Math.min(rollPoseidonMana('enemy'),enemyTurnMaxMana-enemyMana))"));
  assert.ok(!html.includes('enemyTurnBeforeGuardian'), '턴 시작 확률 최대 마나 상승 래퍼는 없다');
  assert.ok(html.includes('enemyMana-=data.cost;enemySummonUnit(lane,data);enemyCardPlayedHook(data.cost);writeLog'), '전개 우선 소환도 같은 트리거');
});

test('공격 대상: 컴퓨터도 유저와 같다(소진자 전역 도발 > 일반 도발 > 맨 왼쪽), 난이도는 대상을 바꾸지 않는다', () => {
  const pick = between('function chooseEnemyAttackTarget(', 'const LANE_SLIDE_MS');
  assert.ok(pick.includes("if(unit.dataset.ultimateSpent==='true')return null;"));
  assert.ok(pick.includes('return targets[0]||null;'));
  assert.ok(!pick.includes('enemyDifficulty') && !pick.includes('engineAdapter'));
  assert.ok(html.includes("[data-taunt=\"true\"]:not([data-destroyed=\"true\"])')||enemyLane.querySelector(':scope > .unit:not([data-destroyed=\"true\"])')"), '유저 공격도 일반 도발을 따른다');
});

test('브라우저 검사: 컴퓨터 시작 손패·자동 드로우·카드 뽑기 비용·혈마나·교체·대상·물 오라·실제 턴 흐름', (t) => {
  const probe = spawnSync('python3', ['-I', '-c', 'import playwright'], { encoding: 'utf8' });
  if (probe.status !== 0) { t.skip('python playwright 가 없어 건너뜀 (npm run qa:enemy-parity 로 따로 실행)'); return; }
  const run = spawnSync('python3', ['-I', path.join(root, '12_tools/qa/check-enemy-parity.py')], { encoding: 'utf8', timeout: 240000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /OK: 컴퓨터 규칙 동일화 확인/);
});

test('컴퓨터는 쓸모없는 즉발 마법(대상 없음)을 쓰지 않고, 마법에는 혈마나를 쓰지 않는다 (2026-11-09)', () => {
  assert.ok(html.includes('function enemyTrapBloodOk(cost)'));
  assert.ok(html.includes("x.card.spell&&enemySpellScore(x.card)>-50&&(x.card.cost<=enemyMana||(x.card.trap&&enemyTrapBloodOk(x.card.cost)))"));
  assert.ok(html.includes('function trapSpellScore(card)'));
  assert.ok(html.includes("else enemyPayCost(card.cost,'함정 세팅')"));
});
