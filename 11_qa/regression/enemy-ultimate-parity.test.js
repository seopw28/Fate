const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('컴퓨터의 궁극기 장착은 전투 로그로, 발동은 카드로 플레이어에게 공개한다', () => {
  /* 장착은 슬롯에 넣는 준비 동작이라 화면을 멈추지 않고 로그로만 알린다.
     실제 발동은 판을 바꾸는 사건이므로 카드 연출을 유지한다. */
  assert.ok(html.includes("writeLog('<strong>상대</strong>가 '+pick.card.name+'을(를) 궁극기로 장착했습니다.')"), '장착 사실은 로그로 반드시 공개해야 한다');
  assert.ok(!html.includes('ENEMY ULTIMATE EQUIP'), '장착에 전역 카드 연출을 쓰지 않는다');
  assert.ok(!html.includes("className='global-spell enemy-ultimate-equip'"), '장착 오버레이는 제거됐다');
  assert.ok(html.includes('function showEnemyUltimateActivation(spec,cost=enemyUltimateManaCost(spec))'));
  assert.ok(html.includes('ENEMY ULTIMATE · LIMIT BREAK'), '실제 발동은 카드로 공개한다');
});

test('컴퓨터 궁극기도 전장 제물과 소진자(기본 공격력 +7 / 체력 1) 및 전역 도발을 사용한다', () => {
  assert.ok(html.includes('function sendEnemyUltimateToGraveyard(spec)'));
  assert.ok(html.includes("effect:'ultimate-spent'"));
  assert.ok(html.includes("unit.dataset.ultimateAggro='true'"));
  assert.ok(html.includes('const unit=sendEnemyUltimateToGraveyard(spec);'));
  assert.ok(html.includes("stats=ultimateSpentStats(spec,false);"), '컴퓨터 소진자도 공명과 관계없이 기본 능력치로 먼저 내려온다');
  assert.ok(html.includes("if(unit?.isConnected&&enemyAuraUltimateMatch(spec))return applyResonanceDescent('enemy',unit);"), '컴퓨터도 공명이면 같은 오라 강하 연출로 공격력 +5 · 체력 +3을 받는다');
  assert.ok(html.includes("unit.dataset.rush='true';unit.classList.remove('exhausted');registerUltimateSpent('enemy'"), '컴퓨터 소진자도 내려놓은 즉시 공격할 수 있다');
  assert.ok(html.includes('unit[data-ultimate-aggro="true"]'));
});

test('컴퓨터도 복수자를 얻고, 두 번째 복수자부터 턴 시작에 추가 드로우를 받는다 (최후의 저항 폐지)', () => {
  assert.ok(!html.includes("if(desperateActive('enemy')){enemyDraw();"), '체력 40 이하 추가 드로우는 폐지됐다');
  assert.ok(!html.includes('상대 최후의 저항'), '상대 최후의 저항 문구가 남아 있다');
  assert.ok(html.includes("if(avengerExtraDrawActive('enemy')&&enemyDeck.length&&enemyHand.length<8){enemyDraw();"), '두 번째 복수자 이후 추가 드로우(덱 비면 생략)');
  assert.ok(html.includes("advanceUltimateLedger('enemy')"), '컴퓨터 턴 시작에 복수자 시계가 흘러야 한다');
  assert.ok(html.includes("effect:'ultimate-avenger'"));
  assert.ok(!html.includes('queueEnemyUltimateAvenger') && !html.includes('summonEnemyUltimateAvenger'), '체력 40 방아쇠 기반 상대 강림 함수는 없다');
});

test('복수자는 소진자가 쓰러진 뒤 그 편의 턴 시작 3번째에 강림한다 (양쪽 공통 장부)', () => {
  assert.ok(html.includes('AVENGER_ARRIVAL_TURNS=3,AVENGER_RESET_TURNS=2'));
  assert.ok(html.includes('ledger.pending.push({rec:spent,due:ledger.turns+AVENGER_ARRIVAL_TURNS})'), '사망 시점의 턴 수 +3 이 강림 시점이다');
  assert.ok(html.includes('const due=ledger.pending.filter(item=>item.due<=ledger.turns)'), '턴 시작마다 강림 시점이 된 복수자만 내려놓는다');
  assert.ok(html.includes('registerUltimateSpentDeath(unit.closest(\'.summon-zone\')?\'player\':\'enemy\',unit)'), '소진자 사망 컷에서 양쪽 모두 등록한다');
  // 사망 컷은 연출 큐에 올라가 필드를 멈추고, 강림은 같은 우선순위로 그 뒤에 이어진다(FIFO).
  assert.ok(html.includes("fxPresent('ultimate-spent-death'"), '사망 컷은 연출 큐를 통해 필드를 멈춰야 한다');
  const cut = html.slice(html.indexOf("fxPresent('ultimate-spent-death'"));
  assert.ok(cut.slice(0, cut.indexOf('}')+600).includes('priority:FX_PRIORITY.ultimate'), '강림과 같은 ultimate 우선순위여야 FIFO로 순서가 보장된다');
  assert.ok(!html.includes('firstUltimateSpentFallen') && !html.includes('enemyFirstUltimateSpentFallen'), '최초 궁극기 한정 플래그는 없다');
  assert.ok(!html.includes('ensureEnemyAvengerSource') && !html.includes('matchFirstUltimateCompanion'), '같은 오라 동료 매칭은 폐지됐다');
});

test('컴퓨터 상대도 같은 세팅 조건(오라 각성 후 · 직전 복수자 강림 후)을 받는다', () => {
  /* 유저만 막으면 상대만 궁극기를 연달아 올려 빈도가 비대칭이 된다. */
  assert.ok(html.includes("function enemyUltimateSettingLocked(){return Boolean(ultimateSettingLockReason('enemy'));}"), '상대 세팅 잠금도 같은 판정을 쓴다');
  assert.ok(html.includes('if(enemyUltimate)return;if(enemyUltimateSettingLocked())return;'), '장착 경로에서 실제로 막아야 한다');
  assert.ok(html.includes("consumeDeckCopiesOfCard('enemy',enemyUltimate)"), '컴퓨터도 같은 카드의 덱 사본을 사용 처리한다');
  assert.ok(html.includes('function enemyUltimateManaCost(spec){return Math.max(1,enemyTurnMaxMana-(enemyAuraUltimateMatch(spec)?ULTIMATE_RESONANCE_COST:0));}'), '컴퓨터 비용 = 최대 마나, 공명 −2');
  assert.ok(html.includes('enemyTurnMaxMana=enemyMana;'), '컴퓨터 최대 마나는 턴 시작에 기록한다');
});
