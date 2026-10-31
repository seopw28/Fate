(function attachPrimalEffects(root, factory) {
  const effects = factory();
  if (typeof module === 'object' && module.exports) module.exports = effects;
  root.PrimalEffects = effects;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPrimalEffects() {
  'use strict';

  function clone(value) { return structuredClone(value); }

  function allChampions(state) {
    return state.players.flatMap((player, playerIndex) => player.board.map(champion => ({ champion, playerIndex })));
  }

  function findChampion(state, instanceId) {
    return allChampions(state).find(entry => entry.champion.instanceId === instanceId) ?? null;
  }

  function conditionMet(champion, condition) {
    if (!condition) return true;
    if (condition.kind === 'counter_at_least') return Number(champion.counters?.[condition.counterId] ?? 0) >= Number(condition.value);
    if (condition.kind === 'health_at_most_ratio') return champion.health / champion.maxHealth <= Number(condition.value);
    if (condition.kind === 'allies_at_least') return false;
    throw new Error(`Unsupported condition: ${condition.kind}`);
  }

  function createRegistry() {
    const handlers = new Map();
    return {
      register(effectId, handler) {
        if (!effectId || typeof handler !== 'function') throw new TypeError('Effect registration requires an id and handler');
        if (handlers.has(effectId)) throw new Error(`Effect already registered: ${effectId}`);
        handlers.set(effectId, handler);
        return this;
      },
      resolve(state, effect, context = {}) {
        const handler = handlers.get(effect.effectId);
        if (!handler) return { ok: false, reason: 'UNKNOWN_EFFECT', state, events: [] };
        return handler(clone(state), effect, context);
      },
      has(effectId) { return handlers.has(effectId); },
      ids() { return [...handlers.keys()].sort(); }
    };
  }

  function transformChampion(state, champion, card, reason) {
    const damage = Math.max(0, champion.maxHealth - champion.health);
    const beforeCardId = champion.cardId;
    champion.cardId = card.cardId;
    champion.attack = card.stats.attack;
    champion.maxHealth = card.stats.health;
    champion.health = Math.max(1, champion.maxHealth - damage);
    champion.effects = clone(card.effects ?? []);
    champion.transformed = true;
    return { type: 'CARD_TRANSFORMED', instanceId: champion.instanceId, fromCardId: beforeCardId, toCardId: card.cardId, reason };
  }

  function createDefaultRegistry() {
    return createRegistry()
      .register('add_counter', (state, effect, context) => {
        const found = findChampion(state, context.sourceInstanceId);
        if (!found) return { ok: false, reason: 'SOURCE_NOT_FOUND', state, events: [] };
        const champion = found.champion;
        champion.counters = champion.counters ?? {};
        champion.counters[effect.counterId] = Number(champion.counters[effect.counterId] ?? 0) + Number(effect.amount ?? 1);
        return { ok: true, state, events: [{ type: 'COUNTER_CHANGED', instanceId: champion.instanceId, counterId: effect.counterId, value: champion.counters[effect.counterId] }] };
      })
      .register('transform', (state, effect, context) => {
        const found = findChampion(state, context.sourceInstanceId);
        if (!found) return { ok: false, reason: 'SOURCE_NOT_FOUND', state, events: [] };
        if (!conditionMet(found.champion, effect.condition)) return { ok: true, state, events: [] };
        const card = context.catalog?.get(effect.cardRef);
        if (!card?.stats) return { ok: false, reason: 'TRANSFORM_CARD_NOT_FOUND', state, events: [] };
        const event = transformChampion(state, found.champion, card, effect.condition?.kind ?? 'effect');
        return { ok: true, state, events: [event] };
      })
      .register('global_destroy', (state, effect, context) => {
        const destroyed = [];
        state.players.forEach(player => {
          player.board = player.board.filter(champion => {
            const keep = Boolean(effect.excludeSource && champion.instanceId === context.sourceInstanceId);
            if (!keep) destroyed.push({ type: 'CARD_DESTROYED', instanceId: champion.instanceId, cardId: champion.cardId, reason: 'global_destroy' });
            return keep;
          });
        });
        return { ok: true, state, events: [{ type: 'GLOBAL_DESTROY_RESOLVED', count: destroyed.length }, ...destroyed] };
      });
  }

  function resolveTrigger(state, catalog, registry, trigger) {
    let current = clone(state);
    const events = [];
    const sources = allChampions(current).map(({ champion }) => ({ instanceId: champion.instanceId, effects: clone(champion.effects ?? []) }));
    for (const source of sources) {
      for (const effect of source.effects.filter(candidate => candidate.trigger === trigger)) {
        const result = registry.resolve(current, effect, { sourceInstanceId: source.instanceId, catalog });
        if (!result.ok) return { ...result, events: [...events, ...result.events] };
        current = result.state;
        events.push(...result.events);
      }
    }
    return { ok: true, state: current, events };
  }

  return Object.freeze({ createRegistry, createDefaultRegistry, resolveTrigger, conditionMet });
});
