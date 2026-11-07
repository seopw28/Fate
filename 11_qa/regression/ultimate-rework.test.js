const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');

/* 궁극기·복수자·최후의 저항 폐지·묘지 재사용 (2026-11-07 PM 확정) 의 핵심 규칙.
   번들 문자열로 구조를 고정하고, 동작은 아래 마지막 테스트가 브라우저 검사(check-ultimate-rework.py)로 확인한다. */

test('궁극기 수치 상수가 PM 확정값이다 (소진자 +15/1, 복수자 +7/+15, T+2, 공명 −2/+2/+2, 재사용 체력 10)', () => {
  const m = html.match(/const ULTIMATE_SPENT_ATTACK_BONUS=(\d+),ULTIMATE_SPENT_HP=(\d+),ULTIMATE_RESONANCE_STAT=(\d+),ULTIMATE_RESONANCE_COST=(\d+),AVENGER_ATTACK_BONUS=(\d+),AVENGER_HP_BONUS=(\d+),AVENGER_HERO_DAMAGE=(\d+),AVENGER_ARRIVAL_TURNS=(\d+),AVENGER_RESET_TURNS=(\d+),AVENGER_EXTRA_DRAW_AT=(\d+),GRAVEYARD_RECYCLE_HP_COST=(\d+),ULTIMATE_UNLOCK_HP=(\d+);/);
  assert.ok(m, '상수 선언을 찾을 수 없다');
  assert.deepEqual(m.slice(1).map(Number), [15, 1, 2, 2, 7, 15, 7, 3, 2, 2, 10, 85]);
});

test('각성 선택 전 세팅 불가 · 소진자 생존 중 세팅 불가는 버튼 경로와 카드 경로 모두 같은 판정을 쓴다', () => {
  assert.ok(html.includes("if(!ultimateAwakenGateOpen(side))return {reason:'오라 각성 후 세팅 가능'"));
  assert.ok(html.includes("if(ledger.spent)return {reason:'소진자 생존 중'"));
  assert.ok(html.includes("'복수자 강림까지 '+left+'턴'"));
  assert.ok(html.includes("function armUltimateSetting(){if(battlePhase!=='setup'||ultimateState||ultimateUsed)return;const settingLock=ultimateSettingLockReason();"));
  assert.ok(html.includes('function setUltimate(card){const settingLock=ultimateSettingLockReason();'));
  assert.ok(html.includes("function enemyUltimateSettingLocked(){return Boolean(ultimateSettingLockReason('enemy'));}"));
});

test('세팅하면 같은 카드의 덱 사본을 묘지로 보낸다(손패 취소 후에도 되돌리지 않는다)', () => {
  assert.ok(html.includes("card.remove();consumeDeckCopiesOfCard('player',ultimateState);"));
  assert.ok(html.includes("pile[i].art===spec.art&&!pile[i].spell"));
  const cancel = html.slice(html.indexOf('function cancelUltimate()'));
  assert.ok(!cancel.slice(0, 500).includes('deck.push') && !cancel.slice(0, 500).includes('allyGraveyard'), '취소는 손패 복귀만 한다');
});

test('복수자는 소진자 사망 시점의 턴 수 +2 에 강림하고, 강림하면 각성곡으로 바뀐다', () => {
  assert.ok(html.includes('ledger.pending.push({rec:spent,due:ledger.turns+AVENGER_ARRIVAL_TURNS})'));
  assert.ok(html.includes('function advanceUltimateLedger(side){const ledger=ultimateLedger[side];syncUltimateLedger(side);ledger.turns++;'));
  assert.ok(html.includes("advanceUltimateLedger('player');"));
  assert.ok(html.includes("advanceUltimateLedger('enemy');"));
  assert.ok(html.includes('switchToAwakeningBgm();const presented=showAvengerArrival(partner,rec,unit);'));
  assert.ok(!html.includes('if(active){switchToAwakeningBgm();'), '체력 40 이하는 BGM 전환 조건이 아니다');
});

test('묘지 재사용: 덱에 챔프가 없을 때 카드 뽑기를 누르면 예/아니오로 묻고, 자동 드로우는 재사용하지 않는다', () => {
  assert.ok(html.includes('function canRecycleGraveyard(side){return heroHpOf(side)>GRAVEYARD_RECYCLE_HP_COST&&recyclableGraveyard(side).length>0;}'));
  assert.ok(html.includes("!/^ultimate-(spent|avenger)$/.test(card.effect||'')"));
  assert.ok(html.includes("function drawCard(){ if(!deck.length){"), '자동 드로우는 재사용하지 않는다');
  assert.ok(html.includes("if(!enemyDeck.length)break;"), '컴퓨터 자동 드로우도 재사용하지 않는다');
  assert.ok(html.includes("if(needsRecyclePrompt()){openRecyclePrompt();return;}"), '카드 뽑기에서 묻는다');
  assert.ok(html.includes('HP 10을 이용하여 묘지에서 덱을 가져오시겠습니까?'));
  assert.ok(html.includes('enemyRecycleIfNoChampion();enemyDraw();'), '컴퓨터는 턴 시작에 같은 조건이면 예');
});

test('체력 40% 기준 효과(역전 돌진·영웅 회복 잠금·최후의 저항)는 하나도 남지 않고 카드 자체의 돌진 효과는 유지한다', () => {
  for (const gone of ['comebackRushActive', 'playerHeroHealingLocked', 'comebackLockEntered', 'desperateActive', 'DESPERATE_HP', 'desperate-toast', 'LAST STAND', '역전 돌진']) {
    assert.ok(!html.includes(gone), gone + ' 가 남아 있다');
  }
  assert.ok(html.includes("if(effect==='rush'||effect==='blink-shield'){unit.classList.remove('exhausted');unit.dataset.rush='true';"), '카드의 돌진 효과는 유지');
});

test('복수자는 착지 연출 뒤 상대 영웅에게 7 피해를 주고(양쪽 공통), 0이 되면 즉시 승패가 정해진다', () => {
  assert.ok(html.includes('AVENGER_HERO_DAMAGE=7'));
  assert.ok(html.includes("setTimeout(()=>dealAvengerHeroDamage(side,partner),AVENGER_LANDING_MS+120)"), '착지 연출 뒤에 피해');
  assert.ok(html.includes("if(reason==='cleared')return;setTimeout(()=>dealAvengerHeroDamage"), '전투가 치워졌으면 피해 없음');
  assert.ok(html.includes("if(player&&enemyHp<=0)finish(true,"), '상대 영웅 0 → 승리');
  assert.ok(html.includes("else if(!player&&playerHp<=0)finish(false,"), '내 영웅 0 → 패배');
});

test('소진자는 상대 소진자(전역 도발)가 없으면 챔프가 있어도 영웅을 우선 공격한다 (양쪽 공통)', () => {
  assert.ok(html.includes("if(!priority||(selected.dataset.ultimateSpent==='true'&&priority.dataset.ultimateAggro!=='true')){attackFace(document.querySelector('.duel-hud .enemy'),automatic);return;}"), '자동·클릭 대상이 영웅으로 잡힌다');
  assert.ok(html.includes("if(defenders.length&&!(selected.dataset.ultimateSpent==='true'&&!defenders.some(u=>u.dataset.ultimateAggro==='true')))"), '영웅 직접 공격이 챔프 방어에 막히지 않는다');
  assert.ok(html.includes("if(unit.dataset.ultimateSpent==='true')return null;"), '컴퓨터 소진자는 내 영웅을 노린다');
  assert.ok(html.indexOf("if(ultimateAggro){showUltimateAggroIntercept(ultimateAggro);return ultimateAggro;}if(unit.dataset.ultimateSpent==='true')return null;") > 0, '상대 소진자 도발이 먼저다');
});

test('브라우저 검사: 세팅 잠금 · 소진자 +15/1 · 복수자 T+2 +7/+15 · 추가 드로우 · 묘지 재사용(체력 10) · 컴퓨터 대칭', (t) => {
  const probe = spawnSync('python3', ['-I', '-c', 'import playwright'], { encoding: 'utf8' });
  if (probe.status !== 0) { t.skip('python playwright 가 없어 건너뜀 (npm run qa:ultimate 로 따로 실행)'); return; }
  const run = spawnSync('python3', ['-I', path.join(root, '12_tools/qa/check-ultimate-rework.py')], { encoding: 'utf8', timeout: 240000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /OK: 궁극기·복수자·묘지 재사용 규칙 확인/);
});
