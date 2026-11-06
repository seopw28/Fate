(function attachPrimalEngine(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.PrimalEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPrimalEngine() {
  'use strict';

  const ACTIONS = Object.freeze({
    PLAY_CARD: 'PLAY_CARD',
    DECLARE_ATTACK: 'DECLARE_ATTACK',
    DECLARE_BLOCK: 'DECLARE_BLOCK',
    CAST_RESPONSE: 'CAST_RESPONSE',
    PASS_PRIORITY: 'PASS_PRIORITY',
    END_ROUND: 'END_ROUND'
  });

  function seedToUint32(seed) {
    const text = String(seed ?? 'primal-tcg');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRng(seed) {
    let state = seedToUint32(seed) || 0x6d2b79f5;
    return Object.freeze({
      next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      },
      int(min, max) {
        const low = Math.ceil(Number(min));
        const high = Math.floor(Number(max));
        if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) throw new RangeError('Invalid RNG range');
        return low + Math.floor(this.next() * (high - low + 1));
      },
      shuffle(values) {
        const result = [...values];
        for (let index = result.length - 1; index > 0; index -= 1) {
          const other = this.int(0, index);
          [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
      },
      snapshot() { return state >>> 0; }
    });
  }

  /* 오라 상성은 폐지: 피해량은 오라과 무관하다. (시그니처는 어댑터 호환을 위해 유지) */
  function calculateDamage(base) {
    return { damage: Math.max(0, Number(base) || 0), modifier: 1, label: '' };
  }

  function resolveHealthDamage(currentHealth, incomingDamage) {
    const healthBefore = Math.max(0, Number(currentHealth) || 0);
    const damage = Math.max(0, Number(incomingDamage) || 0);
    const healthAfter = Math.max(0, healthBefore - damage);
    return Object.freeze({
      healthBefore,
      healthAfter,
      damageApplied: healthBefore - healthAfter,
      defeated: healthAfter === 0
    });
  }

  function createMatchState({ matchId = 'local', seed = 'local', players, startingPlayer = 0 } = {}) {
    if (!Array.isArray(players) || players.length !== 2) throw new TypeError('Exactly two players are required');
    return {
      schemaVersion: 1,
      matchId,
      seed: String(seed),
      sequence: 0,
      round: 1,
      phase: 'MAIN',
      activePlayer: startingPlayer,
      priorityPlayer: startingPlayer,
      attackToken: startingPlayer,
      consecutivePasses: 0,
      stack: [],
      players: players.map((player, index) => ({
        playerId: String(player.playerId ?? index),
        health: Number(player.health ?? 60),
        maxMana: Number(player.maxMana ?? 1),
        mana: Number(player.mana ?? player.maxMana ?? 1),
        deck: [...(player.deck ?? [])],
        hand: [...(player.hand ?? [])],
        board: [...(player.board ?? [])]
      })),
      events: []
    };
  }

  function validateAction(state, action) {
    if (!state || state.schemaVersion !== 1) return { ok: false, reason: 'INVALID_STATE' };
    if (!action || !Object.values(ACTIONS).includes(action.type)) return { ok: false, reason: 'UNKNOWN_ACTION' };
    if (action.player !== state.priorityPlayer) return { ok: false, reason: 'NO_PRIORITY' };
    if (action.type === ACTIONS.DECLARE_ATTACK && action.player !== state.attackToken) return { ok: false, reason: 'NO_ATTACK_TOKEN' };
    if (action.type === ACTIONS.PLAY_CARD && Number(action.cost) > state.players[action.player].mana) return { ok: false, reason: 'INSUFFICIENT_MANA' };
    return { ok: true };
  }

  function applyAction(state, action) {
    const validation = validateAction(state, action);
    if (!validation.ok) return { ok: false, reason: validation.reason, state };
    const next = structuredClone(state);
    next.sequence += 1;
    next.consecutivePasses = action.type === ACTIONS.PASS_PRIORITY ? next.consecutivePasses + 1 : 0;
    if (action.type === ACTIONS.PLAY_CARD) next.players[action.player].mana -= Number(action.cost) || 0;
    if (action.type === ACTIONS.PLAY_CARD || action.type === ACTIONS.CAST_RESPONSE) {
      next.stack.push({ sequence: next.sequence, player: action.player, cardId: action.cardId, targets: [...(action.targets ?? [])] });
    }
    if (action.type === ACTIONS.END_ROUND || next.consecutivePasses >= 2) {
      next.round += 1;
      next.activePlayer = 1 - next.activePlayer;
      next.priorityPlayer = next.activePlayer;
      next.attackToken = 1 - next.attackToken;
      next.consecutivePasses = 0;
      next.phase = 'MAIN';
    } else {
      next.priorityPlayer = 1 - action.player;
    }
    const event = { eventVersion: 1, matchId: next.matchId, sequence: next.sequence, round: next.round, type: action.type, player: action.player };
    next.events.push(event);
    return { ok: true, state: next, events: [event] };
  }

  return Object.freeze({ ACTIONS, createRng, calculateDamage, resolveHealthDamage, createMatchState, validateAction, applyAction });
});
