# Battle UI Baseline

This file protects the approved prototype UI while the game rules move into a deterministic engine.

## Required layout anchors

- The duel HUD spans the stage top with Noctis on the left and Astra on the right.
- Both health bars are large, red, segmented, and equal in width.
- The stage occupies the center-left workspace.
- The command rail stays on the right and contains draw/end-turn controls and the hand.
- Mana uses a large teal meter and remains visually distinct from health.
- Champion and magic-card tabs remain available in the hand.
- Two set-magic slots remain visible on the stage.
- Magic and trap cards use one fixed composition: role/type, art, title, two-line description, then target/status.
- Magic-card count and rail width must not change the card's internal order or crop its text; role colors may vary without changing geometry.

## Reference viewports

- Desktop: `1568x900`
- Laptop: `1366x768`
- Compact fallback: `1100x800`

Magic-card references are stored at `1366x768` and the stacked `1000x900` fallback.

## Interaction anchors

- Card selection is a separate action from card confirmation.
- Draw, summon, attack, spell, trap, damage, and turn transitions retain visual and audio feedback.
- Collection, summon, and deck-editor entry points remain available from the battle shell.

Any intentional change to these anchors must update this contract and its screenshot baseline in the same change.
