# Engine Migration

## Preserved UI

The current battle, collection, deck-editor, VFX, and audio presentation remains the approved client shell. Its contract and viewport baselines live in `11_qa/regression/`.

## Completed foundation

- Stable, versioned card schema and 18-card core set
- Generated browser card runtime
- Seeded deterministic RNG
- Central elemental damage calculation
- Serializable action/event skeleton with priority and round rotation
- Character-chat reward event and idempotent inventory ledger
- Engine, platform, card-data, and UI-contract tests

## Current adapter boundary

The legacy UI now consumes the generated card catalog for collection champions and delegates match RNG and elemental damage to the engine adapter. Rendering and several rule transitions still live in `dist/index.html`.

## Next migration order

1. Move card-effect resolution into an effect registry.
2. Replace DOM-owned health, mana, hand, board, and stack state with engine state.
3. Emit serializable events and render the current UI from those events.
4. Add replay reconstruction and reconnect snapshots.
5. Put match RNG and action validation behind a server-authoritative session.

Do not redesign the approved UI as part of these steps unless the UI regression contract is intentionally updated.
