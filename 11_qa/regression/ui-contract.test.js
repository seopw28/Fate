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

test('basic deck and opening hand follow the PRD composition', () => {
  assert.ok(html.includes('BASIC_CHAMPION_COUNT=45,BASIC_SPELL_COUNT=9,BASIC_TRAP_COUNT=6,OPENING_HAND_SIZE=7'), 'Basic deck must be 45 champions, 9 spells, 6 traps with a seven-card opening hand');
  assert.ok(html.includes("fill('spell',BASIC_SPELL_COUNT)||!fill('trap',BASIC_TRAP_COUNT)||!fill('champion',BASIC_CHAMPION_COUNT)"), 'Basic deck builder must enforce all three card counts');
  assert.ok(html.includes('cheap.length<2') && html.includes('cheap.length+rest.length<OPENING_HAND_SIZE'), 'Opening hand must guarantee two low-cost champions');
  assert.ok(html.includes('let enemyDeck = shuffleBattleDeck(buildBasicDeck(starterOwnedCards())).map(deckEntry)'), 'Computer opponent must use the basic deck');
});

test('battle deck editing is blocked after the guardian choice starts the battle', () => {
  assert.ok(html.includes("if(view==='deck'&&guardianChosen)"), 'Deck view must redirect after battle start');
  assert.ok(html.includes("function saveBattleDeck(){ if(guardianChosen)"), 'Deck save must reject changes after battle start');
});

test('deck exhaustion and opponent-type disclosure follow the PRD', () => {
  assert.ok(html.includes("<strong>덱 소진:</strong> 더 뽑지 않고 현재 손패와 전장으로 계속 싸웁니다."), 'An empty deck must skip drawing instead of ending the battle');
  assert.ok(!html.includes("finish(false,'덱이 비어 더 이상 카드를 뽑을 수 없습니다.')"), 'Deck exhaustion must not be a defeat condition');
  assert.ok(html.includes("'봇 대전은 티어 점수가 변하지 않습니다.'"), 'Bot identity and no-score rule must be disclosed on the result screen');
  assert.ok(html.includes("'PvP 시연 대전으로 정산되었습니다.'"), 'Simulated PvP settlement must be disclosed on the result screen');
});

test('initiative uses health, field, tier, then random order', () => {
  const health = html.indexOf('if(playerHp!==enemyHp)');
  const field = html.indexOf('if(playerUnits!==enemyUnits)');
  const tier = html.indexOf('if(playerTierScore!==enemyTierScore)');
  const random = html.indexOf("engineAdapter.random()<.5?'player':'enemy'");
  assert.ok(health >= 0 && health < field && field < tier && tier < random, 'Initiative priority must match the PRD');
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

test('최후의 발악: 최대 마나가 11로 늘어나고, 발악이 풀리면 10으로 돌아간다', () => {
  assert.ok(html.includes('const DESPERATE_MANA_CAP = 11;'), 'Desperation mana cap must be eleven');
  assert.ok(html.includes("maxMana=playerManaCap()===DESPERATE_MANA_CAP?DESPERATE_MANA_CAP:Math.min(MANA_CAP,maxMana+1)"), 'Turn start must set max mana to eleven while desperate');
  assert.ok(html.includes("if(side==='player')applyDesperateMana(active);"), 'Entering/leaving desperation must update max mana');
  assert.ok(html.includes("else if(maxMana>MANA_CAP){maxMana=MANA_CAP;mana=Math.min(mana,maxMana);"), 'Leaving desperation must return max mana to ten');
});
