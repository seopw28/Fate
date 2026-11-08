const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const read = name => JSON.parse(readFileSync(resolve(__dirname, '../../03_card-data/sets', name), 'utf8'));
const cards = new Map([...read('core-set.json').cards, ...read('character-expansions.json').cards].map(card => [card.cardId, card]));
const { decks } = read('aura-decks.json');
const champions = deck => deck.cards.flatMap(({ cardId, count }) => Array(count).fill(cards.get(cardId))).filter(card => card.cardType === 'champion');

test('오라 기본 덱은 오라마다 하나, 60장 = 하수인 30(덱 오라 20 + 다른 오라 10) + 마법 20 + 함정 10 (2026-11-09)', () => {
  assert.deepEqual(decks.map(deck => deck.aura).sort(), ['earth', 'fire', 'metal', 'water', 'wood']);
  for (const deck of decks) {
    const all = deck.cards.flatMap(({ cardId, count }) => Array(count).fill(cards.get(cardId)));
    const same = champions(deck).filter(card => card.aura === deck.aura).length;
    assert.equal(all.length, 60, deck.name);
    assert.equal(champions(deck).length, 30, deck.name);
    assert.equal(same, 20, deck.name + ' 같은 오라 하수인');
    assert.equal(all.filter(card => card.cardType === 'spell').length, 20, deck.name);
    assert.equal(all.filter(card => card.cardType === 'trap').length, 10, deck.name);
  }
});

test('다섯 덱의 마법 20·함정 10 구성은 같다', () => {
  const rest = deck => JSON.stringify(deck.cards.filter(({ cardId }) => cards.get(cardId).cardType !== 'champion'));
  for (const deck of decks) assert.equal(rest(deck), rest(decks[0]), deck.name);
});

// 하수인 점수 = 공격 + 체력 + 효과 값 - (2 x 비용 + 2). 12_tools/aura-decks/build-aura-decks.py 의 value() 와 같은 식
const EFFECT_VALUE = { draw: 2, arcane_arrow: 1, heal_bless: .7, mass_heal: 2, summon_wolf: 3, hero_splash: 2, lone_wolf: 2, swarm_fury: 2, swarm_bulwark: 2, weaken_all: 3, burn: 1.5, explosive_mark: 2, piercing_shot: 3, armor_pierce: 2, sword_aura: 3, freeze_strongest: 3, battle_enhance: 4, blink_shield: 2, entry_hero_damage: 1, time_bomb: 4, shock_storage: 2 };
const PER_AMOUNT = new Set(['draw', 'arcane_arrow', 'entry_hero_damage', 'mass_heal']);
const value = card => card.stats.attack + card.stats.health - (2 * card.cost + 2) + card.effects.reduce((sum, effect) => sum + (EFFECT_VALUE[effect.effectId] ?? 2) * (PER_AMOUNT.has(effect.effectId) ? effect.amount : 1), 0);
const spread = list => Math.max(...list) - Math.min(...list);

test('다섯 덱의 하수인 세기가 비슷하다: 평균 비용 차 0.2 이하, 덱 오라 20장 점수 차 2 이하, 30장 점수 차 4.5 이하', () => {
  const avgCost = decks.map(deck => champions(deck).reduce((sum, card) => sum + card.cost, 0) / 30);
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
