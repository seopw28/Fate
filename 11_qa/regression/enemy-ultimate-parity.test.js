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
  assert.ok(html.includes('function showEnemyUltimateActivation(spec)'));
  assert.ok(html.includes('ENEMY ULTIMATE · LIMIT BREAK'), '실제 발동은 카드로 공개한다');
});

test('컴퓨터 궁극기도 전장 제물과 1/1 소진자 및 전역 도발을 사용한다', () => {
  assert.ok(html.includes('function sendEnemyUltimateToGraveyard(spec)'));
  assert.ok(html.includes("effect:'ultimate-spent'"));
  assert.ok(html.includes("unit.dataset.ultimateAggro='true'"));
  assert.ok(html.includes('sendEnemyUltimateToGraveyard(spec);'));
  assert.ok(html.includes('unit[data-ultimate-aggro="true"]'));
});

test('컴퓨터도 최후의 저항에서 추가 드로우와 복수자를 얻는다', () => {
  assert.ok(html.includes("if(desperateActive('enemy')){enemyDraw();"));
  assert.ok(html.includes('function queueEnemyUltimateAvenger(delay=0)'));
  assert.ok(html.includes('function summonEnemyUltimateAvenger()'));
  assert.ok(html.includes("effect:'ultimate-avenger'"));
  /* 언제 터뜨리는지(고정 지연 / 컷신 종료 연동)는 연출 사정으로 바뀐다 — 불변식은
     '강림이 충격파 피해로 이어진다'는 것뿐이다. 순서 보장은 avenger-overlap 이 검사한다. */
  assert.ok(/afterAvengerArrival\(showAvengerArrival\(partner,enemyFirstUltimateSpec,unit\)[\s\S]{0,120}resolveEnemyAvengerArrivalDamage\(partner\)/.test(html), '상대 강림도 충격파로 이어져야 한다');
});

test('복수자는 궁극기 소진자가 쓰러진 뒤에만 강림한다 (체력 40 진입만으로는 오지 않는다)', () => {
  // 소진자가 전장에 살아 있는 동안에는 체력이 40 이하여도 강림을 보류한다.
  assert.ok(html.includes('function summonEnemyUltimateAvenger(){if(enemyAvengerSummoned)return null;if(!enemyFirstUltimateSpentFallen)return null;'), '상대 복수자는 소진자 사망 전에는 소환되지 않아야 한다');
  assert.ok(html.includes('function summonFirstUltimateAvenger(){if(avengerSummoned)return null;if(!firstUltimateSpentFallen)return null;'), '내 복수자도 같은 규칙을 따라야 한다');
  // 사망 플래그는 전용 사망 컷(최초 소진자 한정)에서만 세워진다.
  assert.ok(html.includes("if(avengerSide==='player')firstUltimateSpentFallen=true;else enemyFirstUltimateSpentFallen=true;"), '사망 시점에 복수 자격이 생겨야 한다');
  // 체력 40 진입이 이미 지났어도 사망 시점에 다시 강림을 시도한다.
  assert.ok(html.includes('queueEnemyUltimateAvenger(0)'), '사망 시점에 강림을 다시 시도해야 한다');
  // 사망 컷은 연출 큐에 올라가 필드를 멈추고, 강림은 같은 우선순위로 그 뒤에 이어진다(FIFO).
  assert.ok(html.includes("fxPresent('ultimate-spent-death'"), '사망 컷은 연출 큐를 통해 필드를 멈춰야 한다');
  const cut = html.slice(html.indexOf("fxPresent('ultimate-spent-death'"));
  assert.ok(cut.slice(0, cut.indexOf('}')+600).includes('priority:FX_PRIORITY.ultimate'), '강림과 같은 ultimate 우선순위여야 FIFO로 순서가 보장된다');
  assert.ok(!html.includes('queueEnemyUltimateAvenger(4200)'), '컷신 길이를 상수로 추측하는 수동 지연은 없어야 한다');
  assert.ok(html.includes('function ensureEnemyAvengerSource()'), '동료 후보 확정 로직은 유지한다');
  assert.ok(html.includes('if(!ensureEnemyAvengerSource())return null'));
});

test('컴퓨터 상대도 두 번째 궁극기부터 6턴 세팅 대기를 받는다', () => {
  /* 유저만 막으면 상대만 궁극기를 연달아 올려 빈도가 비대칭이 된다. */
  assert.ok(html.includes('function enemyUltimateSettingLocked()'), '상대 세팅 잠금 판정이 있어야 한다');
  assert.ok(/enemyLastUltimateTurn!==null&&turnNumber<enemyLastUltimateTurn\+ULTIMATE_RESET_TURNS/.test(html),
    '유저와 같은 상수·직전 사용 기준이어야 한다');
  assert.ok(html.includes('if(enemyUltimate)return;if(enemyUltimateSettingLocked())return;'), '장착 경로에서 실제로 막아야 한다');
});
