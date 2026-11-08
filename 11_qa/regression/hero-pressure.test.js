const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const expansion = JSON.parse(fs.readFileSync(path.join(root, '03_card-data/sets/character-expansions.json'), 'utf8'));
const pressure = expansion.cards.filter(card => card.cardId.startsWith('pressure.'));
const effectOf = card => card.effects[0];

test('소환사 압박 하수인은 척후 4·선봉 3·결사대 2종이고 비용 1~3에 모두 상대 소환사를 겨냥한다', () => {
  assert.equal(pressure.length, 9);
  const byEffect = id => pressure.filter(card => effectOf(card).effectId === id);
  assert.equal(byEffect('hero_splash').length, 4);
  assert.equal(byEffect('entry_hero_damage').length, 3);
  assert.equal(byEffect('time_bomb').length, 2);
  for (const card of pressure) {
    assert.equal(card.cardType, 'champion');
    assert.ok(card.cost >= 1 && card.cost <= 3, `${card.cardId} 비용`);
    assert.equal(effectOf(card).target, 'enemy_hero');
  }
  assert.ok(byEffect('hero_splash').every(card => effectOf(card).amount === 1));
  assert.ok(byEffect('entry_hero_damage').every(card => [2, 3].includes(effectOf(card).amount)));
  assert.ok(byEffect('time_bomb').every(card => effectOf(card).amount === 5 && effectOf(card).delay === 2));
});

test('소환사 압박 하수인은 오라가 한쪽에 몰리지 않고 이름이 기존 카드와 겹치지 않는다', () => {
  const auras = new Set(pressure.map(card => card.aura));
  assert.equal(auras.size, 5, '불·물·나무·금속·대지 모두 포함');
  const others = [...expansion.cards, ...JSON.parse(fs.readFileSync(path.join(root, '03_card-data/sets/core-set.json'), 'utf8')).cards].filter(card => !card.cardId.startsWith('pressure.'));
  const names = new Set(others.map(card => card.displayName));
  const arts = new Set(others.map(card => card.assetId));
  for (const card of pressure) {
    assert.ok(!names.has(card.displayName), `${card.displayName} 이름 중복`);
    assert.ok(!arts.has(card.assetId), `${card.assetId} 일러스트 중복(cardDefByArt 충돌)`);
  }
});

test('기본 덱은 소환사 압박 하수인 12장을 고정으로 넣고 컴퓨터도 같은 덱 빌더를 쓴다', () => {
  assert.ok(html.includes('HERO_PRESSURE_DECK_IDS=['));
  assert.ok(html.includes("!fill('champion',BASIC_CHAMPION_COUNT,HERO_PRESSURE_DECK_IDS,true)"));
  assert.ok(html.includes('let enemyDeck = shuffleBattleDeck(buildBasicDeck(starterOwnedCards())).map(deckEntry);'));
  const ids = html.match(/HERO_PRESSURE_DECK_IDS=\[([^\]]*)\]/)[1].match(/pressure\.[a-z-]+/g);
  assert.equal(ids.length, 12);
  assert.ok(new Set(ids).size === 9, '9종 모두 포함');
  assert.ok(html.includes('deckReset=Number(saved.version)<10'), '저장된 덱도 새 기본 덱으로 교체');
});

test('세 효과는 플레이어와 컴퓨터가 같은 훅으로 처리한다', () => {
  assert.ok(html.includes('function heroPressureDamage('));
  assert.ok(html.includes('triggerBattlecry=function(unit){const result=triggerBattlecryBeforePressure(unit);onSummoned(unit)'));
  assert.ok(html.includes('triggerEnemyBattlecry=function(unit,data){const result=triggerEnemyBattlecryBeforePressure(unit,data);onSummoned(unit)'));
  assert.ok(html.includes("startPlayerTurn=function(button){const result=startPlayerTurnBeforePressure(button);if(battlePhase==='setup'&&!resultPending)tickBombs('player')"));
  assert.ok(html.includes("enemyTurn=function(done){if(!resultPending)tickBombs('enemy')"));
  assert.ok(html.includes('!options.counter&&parse(attacker)'), '반격은 스플래시에서 제외');
  assert.ok(html.includes('enemyAbsoluteDefense:absoluteDefense'), '절대방어 존중');
  assert.ok(html.includes('impact(avatar,amount,element)') && html.includes('updateHeroHealth()') && html.includes("finish(true,'상대 소환사의 체력을 0으로 만들었습니다.')"), '기존 소환사 피해 경로');
});

test('자폭 카운트다운은 내려놓은 턴을 0으로 두고 자기 턴 시작마다 줄며 배지로 보여준다', () => {
  assert.ok(html.includes("unit.dataset.bombTurns=String(info.delay)"));
  assert.ok(html.includes('const left=Number(unit.dataset.bombTurns)-1;'));
  assert.ok(html.includes("badge.innerHTML='<span>자폭 '+left+'턴</span>'"));
  assert.ok(html.includes(".bomb-badge{position:absolute"));
  assert.ok(html.includes("UNIT_BADGE_ORDER.unshift('.bomb-badge')"));
});

test('카드 설명 문구가 효과 키에서 만들어진다', () => {
  assert.ok(html.includes("'공격 시 상대 소환사에게 추가로 '+mPressure[2]+' 피해.'"));
  assert.ok(html.includes("'소환 시 상대 소환사에게 '+mPressure[2]+' 피해.'"));
  assert.ok(html.includes("'내 턴이 '+mPressure[3]+'번 시작되면 상대 소환사에게 돌진해 자폭, '+mPressure[2]+' 피해.'"));
});
