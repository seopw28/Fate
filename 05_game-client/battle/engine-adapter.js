(function attachEngineAdapter(root) {
  'use strict';
  if (!root.PrimalEngine) throw new Error('PrimalEngine must load before the client adapter');

  function create(options = {}) {
    const querySeed = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seed') : null;
    const seed = options.seed ?? querySeed ?? 'local-prototype-v1';
    const rng = root.PrimalEngine.createRng(seed);
    const effectRegistry = root.PrimalEffects?.createDefaultRegistry();
    const actionLog = [];
    return Object.freeze({
      seed,
      random: () => rng.next(),
      randomInt: (min, max) => rng.int(min, max),
      shuffle: values => rng.shuffle(values),
      calculateDamage: root.PrimalEngine.calculateDamage,
      resolveEffect(state, effect, context = {}) {
        if (!effectRegistry) return { ok: false, reason: 'EFFECT_RUNTIME_NOT_LOADED', state, events: [] };
        return effectRegistry.resolve(state, effect, context);
      },
      resolveTrigger(state, catalog, trigger) {
        if (!effectRegistry) return { ok: false, reason: 'EFFECT_RUNTIME_NOT_LOADED', state, events: [] };
        return root.PrimalEffects.resolveTrigger(state, catalog, effectRegistry, trigger);
      },
      registeredEffects: () => effectRegistry?.ids() ?? [],
      record(type, payload = {}) {
        const entry = Object.freeze({ sequence: actionLog.length + 1, type, payload: structuredClone(payload) });
        actionLog.push(entry);
        return entry;
      },
      exportReplay() { return Object.freeze({ version: 1, seed: String(seed), actions: structuredClone(actionLog) }); },
      rngSnapshot: () => rng.snapshot()
    });
  }

  root.PrimalEngineAdapter = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : this);
