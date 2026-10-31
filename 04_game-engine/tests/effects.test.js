const test = require('node:test');
const assert = require('node:assert/strict');
const { createDefaultRegistry, resolveTrigger } = require('../src/effects.js');

const catalog = new Map([
  ['chronicle.time-warden-awakened', { cardId: 'chronicle.time-warden-awakened', stats: { attack: 7, health: 9 }, effects: [] }],
  ['chronicle.bloodbound-heroine-awakened', { cardId: 'chronicle.bloodbound-heroine-awakened', stats: { attack: 8, health: 6 }, effects: [] }]
]);

function matchWith(...champions) {
  return {
    players: [
      { board: champions.filter(card => card.owner === 0) },
      { board: champions.filter(card => card.owner === 1) }
    ]
  };
}

test('숙성 adds time and transforms at the threshold', () => {
  const registry = createDefaultRegistry();
  let state = matchWith({
    instanceId: 'time-1', owner: 0, cardId: 'chronicle.time-warden', attack: 3, health: 6, maxHealth: 6, counters: { time: 2 },
    effects: [
      { effectId: 'add_counter', trigger: 'round_start', target: 'self', counterId: 'time', amount: 1 },
      { effectId: 'transform', trigger: 'round_start', target: 'self', cardRef: 'chronicle.time-warden-awakened', condition: { kind: 'counter_at_least', counterId: 'time', value: 3 } }
    ]
  });
  const result = resolveTrigger(state, catalog, registry, 'round_start');
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].board[0].counters.time, 3);
  assert.equal(result.state.players[0].board[0].cardId, 'chronicle.time-warden-awakened');
  assert.deepEqual(result.events.map(event => event.type), ['COUNTER_CHANGED', 'CARD_TRANSFORMED']);
});

test('각성 transforms only after the health condition is met', () => {
  const registry = createDefaultRegistry();
  const base = { instanceId: 'blood-1', owner: 0, cardId: 'chronicle.bloodbound-heroine', attack: 4, maxHealth: 10, counters: {}, effects: [{ effectId: 'transform', trigger: 'after_damage', target: 'self', cardRef: 'chronicle.bloodbound-heroine-awakened', condition: { kind: 'health_at_most_ratio', value: 0.5 } }] };
  const safe = resolveTrigger(matchWith({ ...base, health: 6 }), catalog, registry, 'after_damage');
  const awakened = resolveTrigger(matchWith({ ...base, health: 5 }), catalog, registry, 'after_damage');
  assert.equal(safe.state.players[0].board[0].cardId, 'chronicle.bloodbound-heroine');
  assert.equal(awakened.state.players[0].board[0].cardId, 'chronicle.bloodbound-heroine-awakened');
});

test('종말 destroys every champion on both boards', () => {
  const registry = createDefaultRegistry();
  const state = matchWith(
    { instanceId: 'a', owner: 0, cardId: 'core.a', attack: 1, health: 1, maxHealth: 1, effects: [] },
    { instanceId: 'b', owner: 0, cardId: 'core.b', attack: 1, health: 1, maxHealth: 1, effects: [] },
    { instanceId: 'c', owner: 1, cardId: 'core.c', attack: 1, health: 1, maxHealth: 1, effects: [] }
  );
  const result = registry.resolve(state, { effectId: 'global_destroy', trigger: 'next_round_start', target: 'all_champions' });
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].board.length + result.state.players[1].board.length, 0);
  assert.equal(result.events.filter(event => event.type === 'CARD_DESTROYED').length, 3);
});

test('unknown effects fail explicitly instead of silently resolving', () => {
  const result = createDefaultRegistry().resolve(matchWith(), { effectId: 'not_registered' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'UNKNOWN_EFFECT');
});
