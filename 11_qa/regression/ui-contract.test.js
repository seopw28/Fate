const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.resolve(__dirname, '../../dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const expansionCards = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../03_card-data/sets/character-expansions.json'), 'utf8')).cards;

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
  assert.ok(html.includes('BASIC_CHAMPION_COUNT=45,BASIC_SPELL_COUNT=9,BASIC_TRAP_COUNT=6,OPENING_HAND_SIZE=5'), 'Basic deck must be 45 champions, 9 spells, 6 traps with a five-card opening hand');
  assert.ok(html.includes("fill('spell',BASIC_SPELL_COUNT,FEATURED_REVERSAL_IDS)||!fill('trap',BASIC_TRAP_COUNT)||!fill('champion',BASIC_CHAMPION_COUNT)"), 'Basic deck builder must enforce all three card counts');
  assert.ok(html.includes("const FEATURED_REVERSAL_IDS=['reversal.judgment','reversal.bulwark','reversal.giant-hunt','reversal.weight-toll','reversal.life-siphon','reversal.insight']"), 'Basic and demo decks must feature all six reversal spells');
  assert.ok(html.includes('역전 체험덱 자동편성'), 'Deck editor must expose the featured reversal deck preset');
  assert.ok(html.includes('guaranteed.length<2') && html.includes('!deck[i].spell&&deck[i].cost<=STARTING_MANA'), 'Opening hand must guarantee two low-cost champions');
  assert.ok(html.includes('card.spell&&!card.trap&&card.cost<=STARTING_MANA') && html.includes('if(cheapMagic>=0)guaranteed.push(cheapMagic)'), 'Opening hand must guarantee one low-cost non-trap magic card when available');
  assert.ok(html.includes('let enemyDeck = shuffleBattleDeck(buildBasicDeck(starterOwnedCards())).map(deckEntry)'), 'Computer opponent must use the basic deck');
});

test('deck editing stays open during a battle but never changes the current battle deck', () => {
  assert.ok(!html.includes("if(view==='deck'&&guardianChosen)"), 'Deck view must open during a battle');
  assert.ok(html.includes("if(guardianChosen){/* 대전 중: 이번 판 덱은 그대로, 다음 판부터 이 덱을 쓴다 */collectionState.deck=[...draftDeck];persistCollection();"), 'Saving during a battle stores the deck for the next battle only');
  assert.ok(html.includes('지금 고친 덱은 다음 판부터 적용됩니다'), 'Deck editor must tell the player when changes apply');
});

test('deck editor: a deck is designated as the main deck and the editor stays open', () => {
  assert.ok(html.includes("save.textContent=isMain?(applied?'✓ 메인 덱':'메인 덱에 변경 반영'):'메인 덱으로 지정'"), 'Save button must designate the main deck');
  assert.ok(!html.includes("다음 판부터 이 덱으로 싸웁니다.');closeCollection();") && !html.includes("셔플했습니다.');closeCollection();"), 'Designating the main deck must not close the deck editor');
});

test('deck exhaustion and result actions follow the PRD', () => {
  assert.ok(html.includes("<strong>덱 소진:</strong> 더 뽑지 않고 현재 손패와 전장으로 계속 싸웁니다."), 'An empty deck must skip drawing instead of ending the battle');
  assert.ok(!html.includes("finish(false,'덱이 비어 더 이상 카드를 뽑을 수 없습니다.')"), 'Deck exhaustion must not be a defeat condition');
  assert.ok(html.includes('onclick="openTierStatus(lastRankResult)"'), 'Battle results must offer the detailed tier result');
  assert.ok(html.includes('onclick="restartBattleToAuraSelect()"'), 'Battle results must offer another battle');
});

test('enemy champions must be cleared before a direct hero attack', () => {
  assert.ok(html.includes("const defenders=[...document.querySelectorAll('.lane:nth-child(1) .unit:not([data-destroyed=\"true\"])')]") , 'Direct attacks must inspect surviving enemy champions');
  assert.ok(html.includes("const front=defenders.find(u=>u.dataset.taunt==='true')||defenders[0]"), 'Taunt or the leftmost champion must intercept a hero attack');
  assert.ok(html.includes('attack(front,automatic);return;'), 'A blocked hero click must resolve against the defending champion');
});

test('battle result copy is explicit and the result surface fully covers battle UI', () => {
  assert.ok(html.includes("textContent=win?'승리':'패배'"), 'Result title must say 승리 or 패배 directly');
  assert.ok(html.includes('background:radial-gradient(circle at 50% 45%,#211b12 0,#0b0d13 52%,#05070b 100%)'), 'Result overlay must have an opaque full-screen background');
  assert.ok(!html.includes("textContent=win?'캐릭터와 만든 역전':'완결을 향해'"), 'Narrative copy must not replace the win/loss label');
});

test('initiative uses health, field, then random order', () => {
  const health = html.indexOf('if(playerHp!==enemyHp)');
  const field = html.indexOf('if(playerUnits!==enemyUnits)');
  const random = html.indexOf("engineAdapter.random()<.5?'player':'enemy'");
  assert.ok(health >= 0 && health < field && field < random, 'Initiative priority must match the PRD');
  assert.ok(!html.includes('if(playerTierScore!==enemyTierScore)'), 'Phase 2 tier must not affect MVP initiative');
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
  assert.ok(html.includes('button.hidden=ultimateUsed'), 'Ultimate action slot must remain visible before equip and while temporarily locked');
  assert.ok(html.includes("ultimateState?ultimateState.name:'궁극기'"), 'An unequipped ultimate slot must keep the bottom action row aligned');
  assert.ok(html.includes('<span class="ult-reason">\'+reason'), 'Locked ultimate action must explain why it cannot fire');
  assert.ok(html.includes("button.classList.toggle('locked'"), 'Locked ultimate action must keep a persistent field state');
});

test('ready ultimate action uses a compact two-line cost layout', () => {
  assert.ok(html.includes('ult-ready-label">궁극기 발동'), 'Ready action must use one clear Korean action label');
  assert.ok(html.includes("ult-ready-meta\">마나 '+ultimateState.cost+' 소모 · '+ultimateState.title"), 'Second line must show mana cost and ultimate title');
  assert.ok(html.includes('.field-ultimate-action:not(.locked)::before{display:none}'), 'Ready action must hide the duplicated English ULTIMATE label');
});

test('오라 각성은 왼쪽, 궁극기는 오른쪽이며 궁극기는 선택 오라 색을 따른다', () => {
  assert.ok(html.includes('.field-action-dock>.field-guardian-ultimate{order:2}'), 'Aura awakening must occupy the left action slot');
  assert.ok(html.includes('.field-action-dock>.field-ultimate-action{order:3'), 'Ultimate must occupy the right action slot');
  assert.ok(html.includes("GUARDIANS[playerGuardian].color"), 'Ultimate color must come from the selected aura');
  assert.ok(html.includes("button.style.setProperty('--ultimate-aura',auraColor)"), 'Ultimate action must expose the selected aura color to CSS');
  assert.ok(html.includes('color-mix(in srgb,var(--ultimate-aura)'), 'Ultimate border and glow must be derived from the aura color');
});

test('궁극기 선택은 현재 성격 오라와 같은 계열 카드를 시각적으로 추천한다', () => {
  assert.ok(html.includes('function syncAuraUltimateCandidates(arming)'), 'Ultimate selection must synchronize aura recommendations');
  assert.ok(html.includes('card.dataset.persona===persona'), 'Recommendation must compare card personality with the selected aura');
  assert.ok(html.includes("card.classList.toggle('aura-ultimate-match',match)"), 'Matching cards must receive a dedicated highlight class');
  assert.ok(html.includes("card.classList.toggle('aura-ultimate-mismatch',Boolean(persona&&!match))"), 'Non-matching cards must be visually subdued');
  assert.ok(html.includes("cards.sort((a,b)=>Number(b.dataset.persona===persona)-Number(a.dataset.persona===persona))"), 'Matching aura cards must be sorted above the other ultimate candidates');
  assert.ok(html.includes("content:'오라 공명 · 마나 −2 · 대기 −1턴'"), 'Matching cards must explain why they are highlighted');
  assert.ok(html.includes('오라 공명 추천'), 'Matching cards must expose an accessible recommendation description');
});

test('mana curve starts low and grows into the mid game', () => {
  assert.ok(html.includes('const STARTING_MANA = 3'), 'Battle must start at three maximum mana');
  assert.ok(html.includes('const MANA_CAP = 10'), 'Mana cap must remain ten');
  assert.ok(html.includes('let turnNumber = 1'), 'Battle must start on turn one');
  assert.ok(html.includes('Math.min(MANA_CAP,maxMana+1)'), 'Maximum mana must grow by one each turn');
  assert.ok(html.includes('const BLOOD_MANA_UNLOCK_TURN = 3'), 'Blood mana must not bypass the opening curve');
  assert.ok(html.includes('＋ 카드 뽑기 <small>· 비용 2마나</small>'), 'Initial draw UI must show the actual two-mana base cost');
  assert.ok(html.includes("'비용 '+cost+' · 마나 '+paidMana+' + 혈마나 '+quote.shortage"), 'Blood-mana UI must distinguish total cost, paid mana, and converted mana');
  assert.ok(html.includes("' 다음 비용은 마나 '+(cost*2)+'입니다.'"), 'Draw log must follow the exponential 2, 4, 8 cost curve');
  assert.ok(!html.includes("' 다음 비용은 마나 '+(cost+1)+'입니다.'"), 'Draw log must not describe a linear cost curve');
});

test('freshly drawn cards obey the same global hand sorting', () => {
  assert.ok(html.includes('cards.sort((a,b)=>Number(a.dataset.usabilityRank)-Number(b.dataset.usabilityRank)||handCardValue(b)-handCardValue(a))'), 'Draw timing must not override usability and value sorting');
  assert.ok(!html.includes('freshDrawOrder(a,b)||'), 'Fresh cards must not form an unsorted priority block');
});

test('덱은 같은 성격 오라 카드를 최대 30장까지만 허용한다', () => {
  assert.ok(html.includes('AURA_DECK_LIMIT=30'), 'Aura deck limit must be thirty');
  assert.ok(html.includes('auraCountInDeck(cards,personality)>AURA_DECK_LIMIT'), 'Deck validation must detect an aura over the limit');
  assert.ok(html.includes('canAddAuraToDeck(draftDeck,index)'), 'Button and drag additions must share the aura limit guard');
  assert.ok(html.includes('deckAuraLimitExceeded(validDeck)'), 'Loaded legacy decks over the aura limit must be repaired');
  assert.ok(html.includes('deckAuraLimitExceeded(draftDeck)'), 'Deck saving must reject an over-limit draft');
  assert.ok(html.includes('같은 성격 오라는 최대 30장입니다.'), 'Deck editor must disclose the aura limit');
});

test('덱 편집은 큰 수량 버튼과 양방향 드래그를 제공한다', () => {
  for (const token of [
    'class="deck-row-actions"',
    '덱에서 1장 제거',
    "dragged={index:Number(node.dataset.index),from:node.classList.contains('deck-row')?'deck':'owned'}",
    "deckList.addEventListener('drop'",
    "ownedGrid.addEventListener('drop'",
    '.deck-list{min-height:380px;max-height:460px}'
  ]) assert.ok(html.includes(token), `Missing deck editing affordance: ${token}`);
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

test('군세 대응 카드와 저위력 광역 공격 기회가 충분히 분포한다', () => {
  const effectCount = id => expansionCards.filter(card => card.effects.some(effect => effect.effectId === id)).length;
  assert.ok(effectCount('swarm_fury') >= 6, 'At least six champions must punish crowded enemy fields');
  assert.ok(effectCount('summon_barrage') >= 13, 'Low-damage summon barrages must be available beyond legendary finishers');
  assert.ok(html.includes('count<3?0:Math.pow(2,count-2)-1'), 'Crowd scaling must accelerate at 3/4/5/6 enemies');
  assert.ok(html.includes('SWARM_FURY_CAP=12'), 'Accelerating attack must retain a hard safety cap');
});

test('set magic and equipped ultimate can be cancelled back to hand before ending the turn', () => {
  for (const token of ['function cancelSetMagic', 'function cancelUltimate', "addEventListener('dblclick'", 'draggedCancel', 'magic.refund', "turnNumber >= magic.readyTurn"]) {
    assert.ok(html.includes(token), `Missing setting-cancel token: ${token}`);
  }
});

test('space switches hand tabs and Enter ends the turn', () => {
  for (const token of ["event.code==='Space'?'toggle-tab':'end-turn'", "'.turn-actions .end'", "battlePhase!=='setup'"]) {
    assert.ok(html.includes(token), `Missing keyboard shortcut token: ${token}`);
  }
});

test('최후의 저항: 체력 40 이하에서 발동하지만 최대 마나는 10을 유지한다', () => {
  assert.ok(html.includes('const DESPERATE_HP_RATIO=.4'), 'Desperation must start at forty percent');
  assert.ok(html.includes('hp>0&&hp<=DESPERATE_HP'), 'Exactly forty percent health must activate desperation');
  assert.ok(html.includes('function playerManaCap(){return MANA_CAP;}'), 'Desperation must keep the normal mana cap');
  assert.ok(html.includes('maxMana=Math.min(MANA_CAP,maxMana+1)'), 'Turn start must never grow beyond ten mana');
  assert.ok(!html.includes('const DESPERATE_MANA_CAP = 11;'), 'The removed eleven-mana cap must not remain');
  assert.ok(!html.includes('function applyDesperateMana'), 'Desperation must not mutate maximum mana');
});
