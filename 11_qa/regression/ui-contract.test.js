const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.resolve(__dirname, '../../dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

test('battle UI keeps the approved layout anchors', () => {
  for (const token of ['class="duel-hud"', 'class="arena"', 'class="command-rail"', 'id="player-health"', 'mana-hud', 'id="draw-action"', 'class="end"']) {
    assert.ok(html.includes(token), `Missing UI contract token: ${token}`);
  }
});

test('collection and deck editor remain available', () => {
  for (const token of ['id="collection-modal"', 'id="gacha-view"', 'id="deck-view"', 'id="owned-grid"', 'id="deck-rows"', 'id="deck-save"']) {
    assert.ok(html.includes(token), `Missing collection contract token: ${token}`);
  }
});

test('prototype cards stay out of the approved collection UI', () => {
  assert.ok(html.includes("card.releaseState!=='prototype'"), 'Collection UI must filter prototype cards');
});

test('magic cards keep a stable rail composition', () => {
  for (const token of ['height:276px', 'min-height:276px', 'flex:0 0 122px', 'height:122px']) {
    assert.ok(html.includes(token), `Missing stable magic-card token: ${token}`);
  }
});

test('champion fields are capped and fit six cards without rail overflow', () => {
  assert.ok(html.includes('const FIELD_CARD_LIMIT = 6'), 'Both champion fields must share a six-card limit');
  assert.ok(html.includes("length>=FIELD_CARD_LIMIT"), 'Player summons must stop before spending resources on a full field');
  assert.ok(html.includes('grid-template-columns:repeat(6,minmax(0,182px))'), 'Desktop fields must use six fluid tracks');
  assert.ok(html.includes('grid-template-columns:repeat(6,minmax(0,1fr))'), 'Narrow fields must shrink all six tracks inside the stage');
});

test('field setup stays locked until combat fully resolves', () => {
  for (const token of ["let battlePhase = 'setup'", "setBattlePhase('player-combat')", "setBattlePhase('enemy-combat')", "setBattlePhase('setup')", "if(battlePhase!=='setup')return;"]) {
    assert.ok(html.includes(token), `Missing battle-phase lock token: ${token}`);
  }
});

test('deterministic runtime loads before legacy UI code', () => {
  const engine = html.indexOf('runtime/engine.js');
  const adapter = html.indexOf('runtime/engine-adapter.js');
  const legacy = html.indexOf('<script>');
  assert.ok(engine >= 0 && adapter > engine && legacy > adapter, 'Runtime scripts must load before legacy UI');
});

test('initial battle hand is generated from validated card data', () => {
  assert.ok(html.includes('PrimalBattleStarter.cardIds'), 'Initial hand must use the battle starter data');
  assert.ok(html.includes('initialHandNode.replaceChildren(...initialBattleCardIds.map(createRuntimeBattleCard))'), 'Initial hand must be rendered from card definitions');
  assert.ok(html.includes('cardDefinitionById'), 'Battle cards must resolve through stable cardIds');
});

test('opening fields are dealt from the shuffled decks', () => {
  assert.ok(html.includes('takeCards(enemyDeck,'), 'Enemy opening field must be drawn from the shuffled enemy deck');
  assert.ok(html.includes('playerOpeningField=takeCards(deck,'), 'Player opening field must be drawn from the shuffled player deck');
  assert.ok(html.includes('OPENING_MAX_COST=STARTING_MANA'), 'Opening field cards must not cost more than the starting mana');
  assert.ok(html.includes('power<=budget'), 'Enemy opening power must not exceed the player opening power');
  assert.ok(html.includes('dealOpeningFields()'), 'Opening fields must replace static placeholder units');
  assert.ok(html.includes('양쪽 덱에서 시작 마나 이하 비용의 카드 2장'), 'The battle log must explain the opening deal');
  assert.ok(html.includes('crypto?.randomUUID?.()'), 'Normal matches must receive a fresh shuffle seed');
  assert.ok(html.includes('requestedSeed||'), 'An explicit seed must remain available for deterministic QA');
});

test('equipped ultimate remains visible when temporarily locked', () => {
  assert.ok(html.includes('button.hidden=!ultimateState||ultimateUsed'), 'Equipped ultimate action must only disappear before equip or after use');
  assert.ok(html.includes('<span class="ult-reason">\'+reason'), 'Locked ultimate action must explain why it cannot fire');
  assert.ok(html.includes("button.classList.toggle('locked'"), 'Locked ultimate action must keep a persistent field state');
});

test('mana curve starts low and grows into the mid game', () => {
  assert.ok(html.includes('const STARTING_MANA = 3'), 'Battle must start at three maximum mana');
  assert.ok(html.includes('const MANA_CAP = 10'), 'Mana cap must remain ten');
  assert.ok(html.includes('let turnNumber = 1'), 'Battle must start on turn one');
  assert.ok(html.includes('Math.min(MANA_CAP,maxMana+1)'), 'Maximum mana must grow by one each turn');
  assert.ok(html.includes('const BLOOD_MANA_UNLOCK_TURN = 3'), 'Blood mana must not bypass the opening curve');
});

test('self replication stays conditional and linear', () => {
  for (const token of [
    "data-effect=\"self-replicate\"",
    'selfReplicationPrimed=mana>=2',
    "summonBattleToken('미토시스 슬라임 분체',1,1",
    'setTimeout(resolveSelfReplication',
    'fieldCount<FIELD_CARD_LIMIT'
  ]) assert.ok(html.includes(token), `Missing bounded replication token: ${token}`);
});

test('set magic and equipped ultimate can be cancelled back to hand before ending the turn', () => {
  for (const token of ['function cancelSetMagic', 'function cancelUltimate', "addEventListener('dblclick'", 'draggedCancel', 'magic.refund', "turnNumber >= magic.readyTurn"]) {
    assert.ok(html.includes(token), `Missing setting-cancel token: ${token}`);
  }
});

test('space bar ends the turn through the end-turn button', () => {
  for (const token of ["event.code!=='Space'", "'.turn-actions .end'", "battlePhase!=='setup'"]) {
    assert.ok(html.includes(token), `Missing space-end-turn token: ${token}`);
  }
});
