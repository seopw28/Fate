const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/engine.js');

test('seeded RNG reproduces the same sequence and shuffle', () => {
  const left = engine.createRng('match-42');
  const right = engine.createRng('match-42');
  assert.deepEqual(Array.from({ length: 8 }, () => left.next()), Array.from({ length: 8 }, () => right.next()));
  assert.deepEqual(left.shuffle([1, 2, 3, 4, 5]), right.shuffle([1, 2, 3, 4, 5]));
});

test('element damage is resolved by one deterministic rule', () => {
  assert.deepEqual(engine.calculateDamage(10, 'fire', 'wind'), { damage: 13, modifier: 1.3, label: '상성 유리 +30%' });
  assert.deepEqual(engine.calculateDamage(10, 'wind', 'fire'), { damage: 8, modifier: 0.8, label: '상성 불리 -20%' });
  assert.deepEqual(engine.calculateDamage(10, 'neutral', 'fire'), { damage: 10, modifier: 1, label: '' });
});

test('priority rejects out-of-turn actions', () => {
  const state = engine.createMatchState({ players: [{ playerId: 'a' }, { playerId: 'b' }] });
  assert.deepEqual(engine.validateAction(state, { type: engine.ACTIONS.PLAY_CARD, player: 1, cardId: 'core.test', cost: 0 }), { ok: false, reason: 'NO_PRIORITY' });
});

test('play card spends mana and passes priority with a serializable event', () => {
  const state = engine.createMatchState({ matchId: 'm1', players: [{ playerId: 'a', mana: 3 }, { playerId: 'b', mana: 3 }] });
  const result = engine.applyAction(state, { type: engine.ACTIONS.PLAY_CARD, player: 0, cardId: 'core.crimson-bolt', cost: 3, targets: ['hero:1'] });
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].mana, 0);
  assert.equal(result.state.priorityPlayer, 1);
  assert.equal(result.state.stack[0].cardId, 'core.crimson-bolt');
  assert.doesNotThrow(() => JSON.stringify(result.state));
});

test('two consecutive passes advance the round and rotate attack token', () => {
  let state = engine.createMatchState({ players: [{ playerId: 'a' }, { playerId: 'b' }] });
  state = engine.applyAction(state, { type: engine.ACTIONS.PASS_PRIORITY, player: 0 }).state;
  state = engine.applyAction(state, { type: engine.ACTIONS.PASS_PRIORITY, player: 1 }).state;
  assert.equal(state.round, 2);
  assert.equal(state.attackToken, 1);
  assert.equal(state.priorityPlayer, 1);
});
