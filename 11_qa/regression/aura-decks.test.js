const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const read = name => JSON.parse(readFileSync(resolve(__dirname, '../../03_card-data/sets', name), 'utf8'));
const cards = new Map([...read('core-set.json').cards, ...read('character-expansions.json').cards].map(card => [card.cardId, card]));
const { decks } = read('aura-decks.json');
const champions = deck => deck.cards.flatMap(({ cardId, count }) => Array(count).fill(cards.get(cardId))).filter(card => card.cardType === 'champion');

test('오라 기본 덱은 오라마다 하나, 60장 = 하수인 40(덱 오라 20 + 다른 오라 4종 각 5) + 마법 20 (2026-11-09 함정은 즉발 마법으로 통합)', () => {
  assert.deepEqual(decks.map(deck => deck.aura).sort(), ['earth', 'fire', 'metal', 'water', 'wood']);
  for (const deck of decks) {
    const all = deck.cards.flatMap(({ cardId, count }) => Array(count).fill(cards.get(cardId)));
    const same = champions(deck).filter(card => card.aura === deck.aura).length;
    assert.equal(all.length, 60, deck.name);
    assert.equal(champions(deck).length, 40, deck.name);
    for (const aura of ['fire', 'water', 'wood', 'metal', 'earth'].filter(a => a !== deck.aura)) assert.equal(champions(deck).filter(card => card.aura === aura).length, 5, deck.name + ' ' + aura);
    assert.equal(same, 20, deck.name + ' 같은 오라 하수인');
    assert.equal(all.filter(card => card.cardType === 'spell').length, 20, deck.name);
    assert.equal(all.filter(card => card.cardType === 'trap').length, 0, deck.name);
  }
});

test('다섯 덱의 마법 20장 구성은 같다', () => {
  const rest = deck => JSON.stringify(deck.cards.filter(({ cardId }) => cards.get(cardId).cardType !== 'champion'));
  for (const deck of decks) assert.equal(rest(deck), rest(decks[0]), deck.name);
});

// 하수인 점수 = 공격 + 체력 + 효과 값 - (2 x 비용 + 2). 12_tools/aura-decks/build-aura-decks.py 의 value() 와 같은 식
const EFFECT_VALUE = { draw: 2, arcane_arrow: 1, heal_bless: .7, mass_heal: 2, summon_wolf: 3, hero_splash: 2, lone_wolf: 2, swarm_fury: 2, swarm_bulwark: 2, weaken_all: 3, burn: 1.5, explosive_mark: 2, piercing_shot: 3, armor_pierce: 2, sword_aura: 3, freeze_strongest: 3, battle_enhance: 4, blink_shield: 2, entry_hero_damage: 1, time_bomb: 4, shock_storage: 2 };
const PER_AMOUNT = new Set(['draw', 'arcane_arrow', 'entry_hero_damage', 'mass_heal']);
const value = card => card.stats.attack + card.stats.health - (2 * card.cost + 2) + card.effects.reduce((sum, effect) => sum + (EFFECT_VALUE[effect.effectId] ?? 2) * (PER_AMOUNT.has(effect.effectId) ? effect.amount : 1), 0);
const spread = list => Math.max(...list) - Math.min(...list);

test('다섯 덱의 하수인 세기가 비슷하다: 평균 비용 차 0.2 이하, 덱 오라 20장 점수 차 2 이하, 40장 점수 차 4.5 이하', () => {
  const avgCost = decks.map(deck => champions(deck).reduce((sum, card) => sum + card.cost, 0) / 40);
  const same = decks.map(deck => champions(deck).filter(card => card.aura === deck.aura).reduce((sum, card) => sum + value(card), 0));
  const all = decks.map(deck => champions(deck).reduce((sum, card) => sum + value(card), 0));
  assert.ok(spread(avgCost) <= 0.2, JSON.stringify(avgCost));
  assert.ok(spread(same) <= 2, JSON.stringify(same));
  assert.ok(spread(all) <= 4.5, JSON.stringify(all));
});

test('새 캐릭터 48장은 그림 파일이 있고 남성 캐릭터가 없다', () => {
  const sets = ['baekyeon.', 'gadam.', 'astrum.', 'inquisition.'];
  const added = [...cards.values()].filter(card => sets.some(prefix => card.cardId.startsWith(prefix)));
  assert.equal(added.length, 48);
  for (const card of added) readFileSync(resolve(__dirname, '../../dist/assets', card.assetId));
});

test('클라이언트: 덱 편집에서 오라 기본 덱을 불러오고, 새로 시작하면 덱 목록에 5종이 있고, 컴퓨터도 5종 중 하나를 쓴다', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  const runtime = readFileSync(resolve(__dirname, '../../dist/runtime/cards.js'), 'utf8');
  assert.ok(runtime.includes('globalThis.PrimalAuraDecks'), '런타임 카드 데이터에 오라 덱이 들어간다');
  assert.ok(html.includes('function loadAuraDeck(aura)'), '덱 편집 불러오기');
  assert.ok(html.includes('class="aura-deck-fill"'), '덱 도구의 오라 기본 덱으로 채우기');
  assert.ok(html.includes('AURA_DECKS.forEach(deck=>decks.push({name:deck.name,aura:deck.aura,ids:deckIdsOf(deck.indexes)}))'), '새로 시작하면 덱 목록에 5종');
  assert.ok(html.includes('let enemyDeck = shuffleBattleDeck(enemyAuraDeck?[...enemyAuraDeck.indexes]'), '컴퓨터 덱도 오라 기본 덱');
  assert.ok(html.includes('Math.max(AURA_DECK_OWNED_FLOOR[i]||0,'), '기본 덱 카드는 보유 보장');
  assert.ok(html.includes("wood:'#5fd38a',metal:'#cfd8e6'"), '덱 구성 막대에 나무·금속이 잡힌다');
});

test('오라 덱마다 소환사 압박 하수인(소환사 직접 피해 효과)이 기존 기본 덱과 같은 12장 들어간다', () => {
  const pressure = new Set(['hero_splash', 'entry_hero_damage', 'time_bomb']);
  for (const deck of decks) assert.equal(champions(deck).filter(card => card.effects.some(effect => pressure.has(effect.effectId))).length, 12, deck.name);
});

test('덱마다 오라 필수 · 오라당 덱 1개 · 성격 오라를 고르면 매칭 덱으로 내 덱과 컴퓨터 덱을 다시 만든다 (2026-11-09)', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes('var MAX_DECKS=5,'), '오라 5종 → 덱 최대 5개');
  assert.ok(html.includes('function assignDeckAuras(decks)'), '옛 저장 덱에 오라 배정');
  assert.ok(html.includes('function createDeck(){const aura=freeDeckAura();if(collectionState.decks.length>=MAX_DECKS||!aura)return;'), '새 덱은 빈 오라가 있을 때만');
  assert.ok(html.includes("decks.some((d,i)=>i!==editingDeck&&d.aura===aura))return;"), '다른 덱이 쓰는 오라는 고를 수 없다');
  assert.ok(html.includes('const GUARDIAN_DECK_AURA={jujak:\'fire\',cheongryong:\'water\',namu:\'wood\',baekho:\'metal\',hyeonmu:\'earth\'};'));
  assert.ok(html.includes('if(!before&&guardianChosen)applyAuraMatchedDecks();'), '오라를 고른 순간 매칭 덱 적용');
  assert.ok(html.includes('enemyDeck=shuffleBattleDeck([...theirs.indexes]).map(deckEntry);'), '컴퓨터도 자기 오라의 덱');
});

test('덱 편집은 오라 5칸 고정: 빈 칸·0장 덱은 오라 기본 덱, 새 덱·복제·삭제·오라 바꾸기 없음 (2026-11-09 PM)', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes('return own&&own.ids.length?own:preset?{name:preset.name,aura:key,ids:deckIdsOf(preset.indexes)}'), '빈 칸은 기본 덱으로 채운다');
  assert.ok(html.includes('<span class="deck-tab-head">'), '탭에 오라 문양과 이름');
  assert.ok(!html.includes('onclick="createDeck()"') && !html.includes('onclick="duplicateDeck()"') && !html.includes('onclick="deleteDeck()"') && !html.includes('id="deck-aura"'), '오라 칸 관리 버튼 없음');
  assert.ok(html.includes(" 기본 덱으로 되돌리기</button>"), '기본 덱으로 되돌리기');
});

test('덱 편집 2단계: 들어가면 오라 5개 중 편집할 덱을 먼저 고르고, 고른 오라 덱 안에서 넣고 뺀다 (2026-11-09 PM)', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes("openCollection=function(view='deck',...rest){if(view==='deck')deckAuraStep='pick';"), '덱 편집을 열면 오라 고르기부터');
  assert.ok(html.includes('<h3>어떤 오라의 덱을 편집할까요?</h3>'), '오라 고르기 화면');
  assert.ok(html.includes('function pickAuraDeck(i)') && html.includes('function backToAuraPick()'), '고르기와 되돌아가기');
  assert.ok(html.includes('#deck-view.aura-pick-mode .deck-toolbar,#deck-view.aura-pick-mode .deck-content{display:none!important}'), '고르기 화면에서는 편집 도구를 숨긴다');
});

test('덱 편집과 컬렉션에서 마법카드는 오라 대신 마법으로 묶어, 오라 숫자에는 하수인만 센다 (2026-11-09 PM)', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes("const deckAuraKey=i=>collectionIsSpell[i]?'magic':collectionCards[i][0]"), '구성 막대');
  assert.ok(html.includes("keys:['fire','water','wood','metal','earth','magic'],of:i=>collectionIsSpell[i]?'magic':collectionCards[i][0]"), '성격별 묶음');
  assert.ok(html.includes("collectionFilter==='magic'?collectionIsSpell[index]:!collectionIsSpell[index]&&card[0]===collectionFilter"), '오라 필터는 하수인만, 마법 필터 추가');
  assert.ok(html.includes("(collectionIsSpell[index]?'마법':elementLabel[card[0]])+' · 비용 '"), '보유 카드 설명');
});

test('덱 편집 UX: 넓은 한 줄 덱 목록(비용·그림 띠·이름·장수·−/＋)과 그림을 띠로 줄인 보유 카드 타일 (2026-11-09 PM)', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes('<div class="deck-row slim"'), '한 줄 덱 목록');
  assert.ok(html.includes('#deck-view.aura-edit-mode .deck-content{grid-template-columns:minmax(0,1fr) minmax(340px,40%)!important;'), '덱 목록 폭을 넓힌다');
  assert.ok(html.includes('#deck-view.aura-edit-mode .owned-card img{aspect-ratio:auto!important;height:64px!important;'), '보유 카드 그림은 띠로');
});

test('컬렉션 머리 1행: 제목, 탭, 재화와 닫기를 한 줄에 둔다 (2026-11-09 PM)', () => {
  const html = readFileSync(resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(/<div class="collection-head"><div class="collection-titleblock">.*?<\/div><div class="collection-tabs">/s.test(html), '탭이 머리 줄 안에 있다');
  assert.ok(html.includes('#collection-modal #collection-sub{display:none}'), '설명 문구는 숨긴다');
});
