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
  /* 예전에는 마법·함정 카드 높이를 276px, 그림을 122px 로 못박아 '안정'을 만들었다.
     그런데 하수인 카드는 폭을 따라가는 5:7 실루엣이라, 레일이 좁아지면 마법 카드만
     유독 길쭉해졌다 (실측 1440px: 하수인 137x191(비율 1.4) vs 마법 137x276(2.0)).
     이제는 고정 픽셀이 아니라 하수인과 같은 비율을 공유해 안정을 만든다. */
  const magicBlock = html.slice(
    html.indexOf('.command-rail .card.spell-card,'),
    html.indexOf('.command-rail .card.spell-card > h3'));
  assert.ok(magicBlock.includes('aspect-ratio:5/7'), '마법·함정도 하수인과 같은 5:7 실루엣이어야 한다');
  assert.ok(!magicBlock.includes('height:276px'), '고정 높이로 돌아가면 좁은 레일에서 다시 길쭉해진다');
  assert.ok(!magicBlock.includes('aspect-ratio:auto'), '비율을 풀면 카드마다 실루엣이 달라진다');
  /* 그림 크기는 카드 종류와 무관하게 공통 규칙 하나가 정한다 */
  assert.ok(html.includes('.command-rail .card .art,.command-rail .card.summon-card .art,.command-rail .card.spell-card .art,.command-rail .card.trap-card .art { width:100%; height:auto; min-height:0; aspect-ratio:4/3;'),
    '그림은 하수인·마법·함정이 같은 4:3 규칙을 공유해야 한다');
  assert.ok(!html.includes('flex:0 0 122px'), '그림 높이를 고정하면 카드가 그림에 밀려 길어진다');
});

test('champion fields are capped and fit five cards without rail overflow', () => {
  assert.ok(html.includes('const FIELD_CARD_LIMIT = 5'), 'Both champion fields must share a five-card limit');
  assert.ok(html.includes("length>=FIELD_CARD_LIMIT"), 'Player summons must stop before spending resources on a full field');
  assert.ok(html.includes('grid-template-columns:repeat(5,minmax(0,163.8px))'), 'Desktop fields must use five fluid tracks');
  assert.ok(html.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), 'Narrow fields must shrink all five tracks inside the stage');
});

test('5칸 전장은 카드 크기를 행 높이·칸 폭에서 계산해 간격을 넓게 쓰고 크게 표시되는 소진자와 복수자가 독과 마나 바를 덮지 않는다', () => {
  assert.ok(html.includes('container-type:size;--field-gap:48.6px'), '독(50px)이 들어갈 행 사이 간격을 확보한다');
  assert.ok(html.includes('calc((100cqw - 32.4px) / 5 - 64.8px)'), '카드 폭은 칸 폭 − 72px 이하라 간격이 72px 아래로 줄지 않는다(모든 뷰포트)');
  assert.ok(html.includes('height:var(--row-h);align-self:start'), '반응형 구간에서도 행 높이를 고정해 전장이 마나 바로 넘치지 않는다');
  assert.ok(html.includes('--card-h:calc((var(--row-h) - 3.6px) / 1.375)'), '복수자(110% × 125%)로 커져도 행 안에 들어가는 카드 높이');
  assert.ok(html.includes('.stage-column .arena .summon-zone > .unit{width:var(--card-w);max-width:none;height:auto;aspect-ratio:5/7;justify-self:center}'), '카드는 균등 5칸 트랙 가운데에 놓인다');
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
  assert.ok(html.includes('SPELL_DECK_LIMIT=30,'), 'Decks may hold up to 30 spells and traps combined');
  assert.ok(html.includes('BASIC_CHAMPION_COUNT=30,BASIC_SPELL_COUNT=20,BASIC_TRAP_COUNT=10,OPENING_HAND_SIZE=5'), 'Basic deck must be 30 champions, 20 spells, 10 traps with a five-card opening hand');
  assert.ok(html.includes("fill('spell',BASIC_SPELL_COUNT,FEATURED_REVERSAL_IDS)||!fill('trap',BASIC_TRAP_COUNT)||!fill('champion',BASIC_CHAMPION_COUNT,HERO_PRESSURE_DECK_IDS,true)"), 'Basic deck builder must enforce all three card counts');
  assert.ok(html.includes("const FEATURED_REVERSAL_IDS=['reversal.judgment','reversal.bulwark','reversal.giant-hunt','reversal.weight-toll','reversal.life-siphon','reversal.insight']"), 'Basic and demo decks must feature all six reversal spells');
  assert.ok(html.includes('역전 체험덱 자동편성'), 'Deck editor must expose the featured reversal deck preset');
  assert.ok(html.includes('guaranteed.length<2') && html.includes('!pile[i].spell&&pile[i].cost<=STARTING_MANA'), 'Opening hand must guarantee two low-cost champions');
  assert.ok(html.includes('card.spell&&!card.trap&&card.cost<=STARTING_MANA') && html.includes('if(cheapMagic>=0)guaranteed.push(cheapMagic)'), 'Opening hand must guarantee one low-cost non-trap magic card when available');
  assert.ok(html.includes('takeCards(deck,openingHandIndexes(deck))') && html.includes('takeCards(enemyDeck,openingHandIndexes(enemyDeck))'), 'Player and computer opening hands use the same guarantee (2026-11-08)');
  assert.ok(html.includes('let enemyDeck = shuffleBattleDeck(enemyAuraDeck?[...enemyAuraDeck.indexes]:buildBasicDeck(starterOwnedCards())).map(deckEntry)'), 'Computer opponent must use one of the aura starter decks (same list as the player)');
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
  assert.ok(html.includes("const front=defenders.find(u=>u.dataset.ultimateAggro==='true')||defenders.find(u=>u.dataset.taunt==='true')||defenders[0]"), 'Taunt or the leftmost champion must intercept a hero attack');
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
  assert.ok(html.includes('ult-ready-label">영웅 강림'), 'Ready action must use one clear Korean action label');
  assert.ok(html.includes("ult-ready-meta\">마나 '+ultimateState.cost+' 소모 · '+ultimateState.title"), 'Second line must show mana cost and ultimate title');
  assert.ok(html.includes('.field-ultimate-action:not(.locked)::before{display:none}'), 'Ready action must hide the duplicated English ULTIMATE label');
});

test('활성 궁극기 버튼은 한 번의 클릭으로 상태를 확정한 뒤 컷신을 재생한다', () => {
  assert.ok(html.includes("fieldUltimateAction.type='button'"), '궁극기 버튼은 폼 기본 동작이 없는 일반 버튼이어야 한다');
  assert.ok(html.includes("fieldUltimateAction.addEventListener('pointerdown',event=>{if(event.button!==0)return;fireUltimateAction(event);})"), '마우스와 터치는 첫 누름에서 궁극기를 처리해야 한다');
  assert.ok(html.includes("fieldUltimateAction.addEventListener('click',event=>{if(event.detail===0)fireUltimateAction(event);})"), '키보드로 발생한 클릭도 궁극기를 발동해야 한다');
  const action = html.slice(html.indexOf('function fireUltimateAction(event)'), html.indexOf('function fireBloodUltimate'));
  assert.ok(action.includes('const spec=ultimateState,reason=ultimateLockReason()'), '클릭 시작 시 발동 상태와 실패 사유를 한 번 확정해야 한다');
  assert.ok(action.indexOf('activateUltimate()') < action.indexOf("showUltimateCutscene('sakura',spec)"), '실제 발동 성공을 확인하기 전에 컷신부터 띄우면 안 된다');
  assert.ok(action.includes('if(ultimateState===spec)'), '발동 상태가 소비되지 않으면 실패를 사용자에게 알려야 한다');
  assert.ok(action.includes('궁극기 발동 대기:'), '발동하지 못한 첫 클릭을 조용히 무시하면 안 된다');
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
  assert.ok(html.includes('const BLOOD_MANA_UNLOCK_TURN = 1;'), '혈마나는 배틀 첫 턴부터 쓸 수 있다 (2026-11-08 초반 제한 해제)');
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
    '.deck-list{min-height:342px;max-height:414px}'
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
  for (const token of ['function cancelSetMagic', 'function cancelUltimate', "addEventListener('dblclick'", 'draggedCancel', 'magic.refund', "turnNumber > (magic.setTurn ?? magic.readyTurn-1)"]) {
    assert.ok(html.includes(token), `Missing setting-cancel token: ${token}`);
  }
});

test('space switches hand tabs and Enter ends the turn', () => {
  for (const token of ["event.code==='Space'?'toggle-tab':'end-turn'", "'.turn-actions .end'", "battlePhase!=='setup'"]) {
    assert.ok(html.includes(token), `Missing keyboard shortcut token: ${token}`);
  }
});

test('최대 마나는 항상 10 상한이다', () => {
  assert.ok(html.includes('function playerManaCap(){return MANA_CAP;}'), 'Max mana stays capped at ten');
  assert.ok(html.includes('maxMana=Math.min(MANA_CAP,maxMana+1)'), 'Turn start must never grow beyond ten mana');
  assert.ok(!html.includes('const DESPERATE_MANA_CAP = 11;'), 'The removed eleven-mana cap must not remain');
});

test('상대는 카드를 한 장씩 간격을 두고 내려놓는다 (같은 프레임 동시 등장 금지)', () => {
  assert.ok(html.includes('const ENEMY_PLAY_GAP_MS=340'), '카드 간 간격 상수가 있어야 한다');
  const turn = html.slice(html.indexOf('let placedBefore=lane.querySelectorAll', html.indexOf('enemyTurnMaxMana=enemyMana;')));
  assert.ok(turn.includes('await new Promise(resolve=>setTimeout(resolve,combatMs(ENEMY_PLAY_GAP_MS)))'), '카드 사이에 실제 대기가 있어야 한다');
  assert.ok(!turn.slice(0, turn.indexOf('arrangeEnemyLane')).includes('.forEach(data=>{enemyMana-=data.cost;enemySummonUnit(lane,data);})'), '동기 forEach로 한꺼번에 깔면 안 된다');
  assert.ok(turn.includes('let placedBefore=lane.querySelectorAll'), '전개 우선 소환 직후에도 같은 간격을 둬야 한다');
});

test('연출이 점유 중이어도 교전 간 판독 여유가 무너지지 않는다', () => {
  // 래퍼가 자기 자신을 재호출하면 게이트가 중첩되어 간격이 160ms 이하로 붕괴한다.
  const gate = html.slice(html.indexOf('fieldAttack=function(...args)'), html.indexOf('const selectCardBeforeComebackRush'));
  assert.ok(gate.includes('markCombatBusy(wait)'), '미루는 동안에도 전투 큐에 점유를 알려야 한다');
  assert.ok(gate.includes('fieldAttackBeforePresentationGate(...args)'), '재시도는 원본을 호출해야 한다');
  assert.ok(!gate.includes('setTimeout(()=>fieldAttack(...args)'), '래퍼를 재귀 호출하면 안 된다');
  assert.ok(html.includes('postCombatPause:278'), '교전 간 0.3초(278*1.08) 판독 여유를 유지한다');
});

test('평타 연출은 피해량·반격·치명타를 시각으로 구분한다', () => {
  // 궤적: --hit(피해 비중)으로 두께·발광·속도가 함께 변한다.
  assert.ok(html.includes('height:calc(3px + 5px*var(--hit,.3))'), '피해량이 클수록 궤적이 두꺼워야 한다');
  assert.ok(html.includes("line.style.setProperty('--hit',hitWeight.toFixed(3))"), '궤적에 피해 비중을 넘겨야 한다');
  assert.ok(html.includes('hitWeight=Math.max(0,Math.min(1,dealt/12))'), '피해량을 0~1로 정규화해 쓴다');
  // 반격은 같은 선이면 구분이 안 된다. 끊긴 질감으로 분리한다.
  // 점선은 선이 끊겨 보여 품질이 떨어진다. 실선을 유지하되 심지 위치와 두께로 구분한다.
  assert.ok(!html.includes('.field-attack-line.counter{background:repeating-linear-gradient'), '반격을 점선으로 되돌리지 말 것');
  assert.ok(html.includes('.field-attack-line.counter{height:calc(2px + 3px*var(--hit,.3));background:linear-gradient'), '반격도 실선이어야 한다');
  assert.ok(html.includes("if(counter)line.classList.add('counter')"), '반격 궤적에 counter 표시를 해야 한다');
  // 치명타: 대상 체력을 넘기는 타격은 더 굵고 오래 남는다.
  assert.ok(html.includes('lethalHit=dealt>0&&targetHp>0&&dealt>=targetHp'), '치명타를 판정해야 한다');
  assert.ok(html.includes('.field-attack-line.lethal{'), '치명타 전용 스타일이 있어야 한다');
  // 착탄: 섬광 + 방사 파편.
  assert.ok(html.includes('.field-impact-burst'), '착탄 연출이 있어야 한다');
  assert.ok(html.includes("burst.className='field-impact-burst '+(motion.impact||'blunt')"), '교전마다 착탄 연출을 띄우고 유형을 붙여야 한다');
  assert.ok(html.includes('@keyframes impact-shard'), '방사 파편 애니메이션이 있어야 한다');
  // 반동: 때린 쪽도 반작용을 받는다.
  assert.ok(html.includes('if(attacker.isConnected&&hitWeight>0)attacker.animate('), '공격자 반동이 있어야 한다');
});

test('평타 착탄은 모션 성격에 따라 베기·가격·찌르기로 갈린다', () => {
  // 마법사 덱이라 전부 원소 폭발처럼 보이던 것을 모션 그룹으로 가른다.
  const motions = fs.readFileSync(path.resolve(__dirname, '../../05_game-client/battle/attack-motions.js'), 'utf8');
  assert.ok(motions.includes("IMPACT = { spin: 'slash', swoop: 'slash', slam: 'blunt', bash: 'blunt', jab: 'pierce', lunge: 'pierce' }"), '모션별 착탄 유형 매핑이 있어야 한다');
  assert.ok(motions.includes("impact: impactKind(name)"), '모션 객체가 착탄 유형을 실어 보내야 한다');
  for (const kind of ['slash', 'blunt', 'pierce']) {
    assert.ok(html.includes(`.field-impact-burst.${kind}`), `${kind} 전용 착탄 스타일이 있어야 한다`);
  }
  assert.ok(html.includes('@keyframes impact-slash'), '베기는 칼자국이 그어져야 한다');
  assert.ok(html.includes('@keyframes impact-ring'), '가격은 링 파동이 퍼져야 한다');
  assert.ok(html.includes('@keyframes impact-pierce'), '찌르기는 진행 방향으로 뻗어야 한다');
  assert.ok(html.includes("burst.style.setProperty('--impact-angle'"), '찌르기 방향을 넘겨야 한다');
});

test('카드 평타 동작은 툭 스치지 않고 크게 움직인다', () => {
  const motions = fs.readFileSync(path.resolve(__dirname, '../../05_game-client/battle/attack-motions.js'), 'utf8');
  assert.ok(motions.includes('const amp = 1.12 + power * 0.42'), '모션 진폭이 1 이상이어야 한다');
  assert.ok(motions.includes('const lift = 66 + power * 58'), '내려찍기는 충분히 높이 떠야 한다');
});

test('피격 카드는 때린 방향 그대로 밀려나고, 밀린 구간이 충분히 길다', () => {
  // 예전에는 translate(7px,-2px) 고정이라 어디서 맞든 오른쪽으로 찔끔 움직였다.
  assert.ok(!html.includes('22%{transform:translate(7px,-2px)'), '고정 방향 피격 반응으로 되돌리지 말 것');
  // 세로 부호를 위쪽으로 고정하면 적 레인(위)이 내 소환존(아래)을 때릴 때 거꾸로 솟는다.
  assert.ok(!html.includes("target.style.setProperty('--knock-y',(-reach*1.5).toFixed(1)+'px')"), '세로 밀림을 위쪽 고정으로 되돌리지 말 것');
  assert.ok(html.includes("target.style.setProperty('--knock-y',(vy*reach*1.5).toFixed(1)+'px')"), '세로 밀림은 공격자→대상 벡터의 부호를 따라야 한다');
  assert.ok(html.includes("vy=Math.sign(uy||-1)*Math.max(Math.abs(uy),.62)"), '세로 밀림 크기에 하한이 있어야 한다(대각 교전에서 무게 유지)');
  assert.ok(html.includes("target.style.setProperty('--knock-x',(ux*reach*.55).toFixed(1)+'px')"), '가로 밀림은 실제 공격 각도를 따라야 한다');
  assert.ok(html.includes('reach=16+38*hitWeight'), '밀리는 거리가 피해량에 비례해야 한다');
  // 0.68초는 밀림이 화면에 오래 남아 렉처럼 느껴졌다. 빠르게 밀리고 곧 복귀해야 한다.
  const hitDur = html.match(/animation:target-hit ([\d.]+)s/);
  assert.ok(hitDur, '피격 반응 길이가 지정되어야 한다');
  assert.ok(Number(hitDur[1]) <= .4, `피격 반응이 길면 렉처럼 느껴진다 (현재 ${hitDur[1]}s)`);
  // 클래스 해제는 애니메이션보다 길어야 복귀가 안 잘리지만, 지나치게 길면 끝난 카드가 계속 점유된다.
  const releaseMs = Number(html.match(/classList\.remove\('hit-react'\),combatMs\((\d+)\)/)[1]);
  assert.ok(releaseMs >= Number(hitDur[1]) * 1000, '복귀 구간이 잘리면 안 된다');
  assert.ok(releaseMs <= Number(hitDur[1]) * 1000 + 120, '애니메이션이 끝난 뒤 오래 붙잡고 있으면 안 된다');
  // 최대 밀림 지점은 --knock-y를 그대로 써야 한다. fallback 값을 리터럴로 박으면 폴백을 손볼 때마다 깨지므로
  // 세로 성분이 변수에서 온다는 것과, 폴백이 '항상 위로 솟는' 음수가 아니라는 것만 본다.
  // 최대 밀림 지점은 배수 없이 --knock-x/y를 그대로 쓰는 키프레임이다. 퍼센트 위치는 완급 조절로 바뀔 수 있으니 고정하지 않는다.
  const knockPeak = html.match(/\d+%\{transform:translate\(var\(--knock-x,[^)]*\),var\(--knock-y,([^)]*)\)\)/);
  assert.ok(knockPeak, '최대 밀림 지점이 있어야 한다');
  assert.ok(!knockPeak[1].trim().startsWith('-'), '세로 폴백이 음수면 공격자와 무관하게 항상 위로 솟는다 (방향은 impact()가 대상 기준으로 정한다)');
});

test('마법·함정 피해는 밀어낼 방향이 없으므로 밀리지 않는다', () => {
  // 마법·화상·광역은 fieldAttack을 거치지 않고 damageUnit에서 바로 impact로 들어온다.
  // 예전에는 --knock-y가 없어 폴백으로 '항상 위'로 솟거나 직전 평타 값이 남아 엉뚱하게 튀었다.
  // 때린 몸이 없는 피해에 방향을 억지로 만들면 '어디서 밀렸지?'가 되므로 아예 밀지 않는다.
  // 마법·함정은 때린 몸이 없어 밀어낼 방향 자체가 없다 → 밀림 없이 번쩍임·흔들림만으로 알린다.
  assert.ok(html.includes("const melee=target.style.getPropertyValue('--knock-src')==='field'"), '근접 타격인지 구분해야 한다');
  assert.ok(html.includes("if(!melee){target.style.setProperty('--knock-x','0px');target.style.setProperty('--knock-y','0px');}"), '마법·함정은 밀림을 0으로 둬야 한다');
  // 평타·반격만 실제 공격자 좌표를 남긴다. 그 표식이 근접 타격의 유일한 근거다.
  assert.ok(html.includes("target.style.setProperty('--knock-src','field')"), 'fieldAttack만 근접 표식을 남긴다');
  assert.ok(html.includes("target.style.removeProperty('--knock-src')"), '표식은 1회용이라 읽고 지워야 한다');
});

test('피격 모션은 돌진·반동 WAAPI에 먹히지 않는다', () => {
  // element.animate()(WAAPI)는 CSS 애니메이션보다 우선순위가 높다. 돌진·반동이 아직 돌고 있으면
  // hit-react(CSS target-hit)가 transform을 전혀 못 잡아, 밀림이 통째로 사라지고 돌진 복귀 움직임만 남는다.
  // 반격에서 특히 방향이 거꾸로 보인 원인이었다.
  assert.ok(html.includes("if(anim.animationName)return;"), 'CSS 애니메이션(hit-react 자신)은 취소하면 안 된다');
  assert.ok(html.includes("touchesTransform=(anim.effect?.getKeyframes()||[]).some(frame=>'transform' in frame)"), 'transform을 건드리는 WAAPI만 골라야 한다');
  assert.ok(html.includes('if(touchesTransform)try{anim.cancel();}catch(e){}'), '충돌하는 WAAPI를 거둬야 한다');
  // 반격 전용 2차 밀림 연출은 폐지했다 — 같은 요소에 WAAPI transform을 또 걸어 밀림을 먹었다.
  assert.ok(!html.includes("if(counter&&target.classList.contains('unit'))target.animate("), '반격 2차 밀림 연출이 되살아나면 안 된다');
});

test('상대 턴의 행동들은 한 프레임에 몰리지 않고 한 박자씩 띄운다', () => {
  // 함정·전개 우선 소환·궁극기 장착·궁극기 발동·마법 세트가 같은 프레임에 연달아 일어나면
  // 무슨 일이 벌어졌는지 읽을 틈이 없다.
  assert.ok(html.includes('const ENEMY_ACTION_BEAT_MS=200'), '행동 사이 최소 간격 상수가 있어야 한다');
  // 실제로 쓰이는 경로는 async enemyTurn 재정의본이다. 거기서 한 줄 몰아 호출이 되살아나면 안 된다.
  const turn = html.slice(html.indexOf('enemyTurnMaxMana=enemyMana;'));
  assert.ok(!turn.slice(0, turn.indexOf('runCombatQueue')).includes("summonEnemyPriorityChampion(lane);equipEnemyUltimate()"), '다섯 행동을 한 줄에 몰아 호출하지 말 것');
  for (const fn of ['triggerEnemyTrap', 'summonEnemyPriorityChampion', 'equipEnemyUltimate', 'castEnemyUltimate', 'setEnemyMagic']) {
    assert.ok(html.includes(`await beat(()=>${fn}(`), `${fn}은 한 박자를 두고 실행해야 한다`);
  }
  // 아무 일도 없었으면 기다리지 않는다 — 빈 턴이 느려지면 안 된다.
  assert.ok(html.includes("if(boardSignature()!==before)"), '실제로 바뀐 행동 뒤에만 기다려야 한다');
  assert.ok(html.includes('setTimeout(resolve,combatMs(ENEMY_ACTION_BEAT_MS))'), '간격에 전투 속도 배율을 적용해야 한다');
});

test('궁극기 세팅은 오라 각성 선택을 마친 뒤에만, 두 번째부터는 직전 복수자가 쓰러지고 주인의 턴이 두 번 시작된 뒤에만 가능하다', () => {
  assert.ok(html.includes('ULTIMATE_UNLOCK_HP=85') && html.includes('const GUARDIAN_AWAKEN_HP=ULTIMATE_UNLOCK_HP;'), '각성 버튼과 같은 체력 85 기준을 쓴다');
  assert.ok(html.includes("function ultimateAwakenGateOpen(side='player'){return awakenGateOpened[side];}"), '체력이 아니라 각성 선택 완료로 열린다');
  assert.ok(html.includes('guardianAwakenChoice=choice;awakenGateOpened.player=true;') && html.includes('enemyGuardianAwakenChoice=choice;awakenGateOpened.enemy=true;'), '유저·컴퓨터 모두 각성 선택 시점에 열린다');
  assert.ok(html.includes("{reason:'복수자 생존 중'") && html.includes("'다음 세팅까지 '+(ledger.cooldownUntil-ledger.turns)+'턴'"), '복수자 생존 중 / 다음 세팅까지 N턴 잠금');
  assert.ok(html.includes('ledger.cooldownUntil=ledger.turns+AVENGER_RESET_TURNS'), '복수자가 쓰러진 뒤 두 번째 턴 시작부터(강림 +3 과 별개로 +2)');
  assert.ok(html.includes("function ultimateSettingLock(side='player'){if(!ultimateAwakenGateOpen(side))return {reason:'오라 각성 후 세팅 가능'"), '각성 전에는 세팅 불가');
  assert.ok(html.includes("if(ledger.spent)return {reason:'소진자 생존 중'"), '소진자가 살아 있으면 다음 세팅 불가');
  assert.ok(html.includes("'복수자 강림까지 '+left+'턴'"), '잠금 해제 조건(강림까지 N턴)을 표시한다');
  // 버튼 경로와 실제 세팅 경로(클릭·드래그) 양쪽을 다 막아야 한다.
  assert.ok(html.includes("function armUltimateSetting(){if(battlePhase!=='setup'||ultimateState||ultimateUsed)return;const settingLock=ultimateSettingLockReason();"), '세팅 버튼을 막아야 한다');
  assert.ok(html.includes('function setUltimate(card){const settingLock=ultimateSettingLockReason();'), '카드 세팅 자체를 막아야 한다');
  // 패널이 잠긴 동안 세팅을 권하면 안 된다.
  assert.ok(html.includes("(setup&&!ultimateUsed&&!settingLock?'':'disabled')"), '잠긴 동안 버튼이 비활성이어야 한다');
  assert.ok(html.includes("settingLock?ultimateSettingLockDetail():"), '잠금 해제 조건을 안내해야 한다');
  // 폐지된 규칙이 돌아오면 안 된다.
  for (const gone of ['ULTIMATE_RESET_TURNS', 'ULTIMATE_COOLDOWN_TURNS', 'ULTIMATE_BASE_MIN_TURN', 'ULTIMATE_STRONG_TURN_DELAY', 'ultimateMinTurn', 'firstUltimateTurn', 'lastUltimateTurn']) {
    assert.ok(!html.includes(gone), `${gone}: 사용 가능 턴·재사용 대기·재세팅 대기는 폐지됐다`);
  }
});

test('궁극기 비용은 발동 시점의 내 최대 마나이고 혈마나는 쓰지 못한다 (오라 공명이면 −2)', () => {
  assert.ok(html.includes('function ultimateManaCost(spec){return spec?Math.max(1,maxMana-(auraUltimateMatch(spec)?ULTIMATE_RESONANCE_COST:0)):0;}'));
  assert.ok(html.includes("if(mana<cost)return '마나 '+cost+' 필요';"), '마나가 모자라면 혈마나 없이 잠긴다');
  assert.ok(!html.includes('minTurn'), '최소 사용 턴 표기는 어디에도 없다');
  assert.ok(html.includes('<div class="ult-meta"><span></span></div>'), '미리보기 배지는 마나 하나만 남긴다');
});

test('죽는 카드는 짧은 소멸 연출을 거친 뒤 사라진다', () => {
  // 전장 카드가 사라지는 경로가 코드 곳곳에 흩어져 있어, 호출부마다 붙이면 반드시 빠지는 곳이 생긴다.
  assert.ok(html.includes('const UNIT_DEATH_MS=420'), '소멸 연출 길이 상수가 있어야 한다');
  assert.ok(html.includes('Element.prototype.remove=function()'), '제거 경로를 한 곳에서 가로채야 한다');
  assert.ok(html.includes("this.classList.add('unit-dying')"), '소멸 연출 클래스를 붙여야 한다');
  assert.ok(html.includes('setTimeout(()=>nativeRemove.call(this),UNIT_DEATH_MS)'), '연출이 끝난 뒤 실제로 지워야 한다');
  // 전장 밖 요소와 이미 연출 중인 카드는 그대로 통과시켜야 무한 루프·지연이 없다.
  assert.ok(html.includes("if(!isFieldUnit||this.dataset.dyingFx==='true')return nativeRemove.call(this)"), '전장 밖·중복 호출은 즉시 제거해야 한다');
  assert.ok(html.includes("this.closest('.summon-zone')||this.closest('.arena .lane')"), '전장 카드만 대상으로 삼아야 한다');
  assert.ok(html.includes('@keyframes unit-death'), '소멸 애니메이션이 있어야 한다');
  assert.ok(html.includes('.unit.unit-dying{'), '소멸 중 카드 스타일이 있어야 한다');
});
