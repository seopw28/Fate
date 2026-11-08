# 화면 배율 작업에서 판정하지 못하고 빼 둔 CSS 규칙 (2026-11-08)

0.9 축소 안/밖을 자동으로 판정하지 못한 규칙이다. 변환(3묶음)에서는 **값을 바꾸지 않고 그대로 둔다.**
이 중 실제로는 축소 안에 그려지는 것이 있으면, 축소를 없앤 뒤 그 화면만 지금보다 약 10% 크게 보일 수 있다. 나중에 해당 화면을 띄워 눈으로 확인한다.

- 판정 방법: 화면 상태 60개 × 화면 크기 4종을 띄워 규칙이 맞는 요소가 축소 안/밖 어디에 있는지 셌다(12_tools/ui-scale/scan-rule-sides.py).
- 아래 규칙은 그 화면들에서 한 번도 나오지 않았다. 대부분 시간차로 뜨는 연출(궁극기 컷씬, 오라 강림, 선공 배너, 함정 발동, 시네마틱 스킬)이라 호출만으로는 잡히지 않았다.

## 화면에 안 나온 규칙 233개 (만드는 함수별)

### `activateGuardianAwakening` (17개)
- `.aura-awaken-choice-panel`
- `.aura-awaken-choice-panel .aura-mark`
- `.aura-awaken-choice-panel small`
- `.aura-awaken-choice-panel h2`
- `.aura-awaken-choice-panel>p`
- `.aura-awaken-options`
- `.aura-awaken-option`
- `.aura-awaken-option:hover,.aura-awaken-option:focus-visible`
- `.aura-awaken-option b`
- `.aura-awaken-desc`
- `.aura-awaken-desc span`
- `.aura-awaken-desc span+span`
- `.aura-awaken-option em`
- `.aura-awaken-options`
- `.aura-awaken-choice-panel`
- `.aura-awaken-option`
- `.aura-awaken-choice-panel`

### `showUltimateCutscene` (16개)
- `.ultimate-cutscene-bg`
- `.ultimate-cutscene-flow`
- `.ultimate-cutscene-slash`
- `.ultimate-cutscene-hero`
- `.ultimate-cutscene-hero>img`
- `.ultimate-cutscene-hero>div`
- `.ultimate-cutscene-hero small`
- `.ultimate-cutscene-hero strong`
- `.ultimate-cutscene-hero span`
- `.ultimate-cutscene-hero`
- `.ultimate-cutscene-hero>div`
- `.ultimate-cutscene-hero strong`
- `.ultimate-cutscene-hero span`
- `.ultimate-cutscene-flow`
- `.ultimate-cutscene-hero`
- `.ultimate-cutscene-hero strong`

### `settleBattleUi` (16개)
- `.initiative-banner`
- `.initiative-banner small`
- `.initiative-banner strong`
- `.initiative-banner span`
- `.initiative-banner`
- `body .initiative-banner`
- `body .initiative-banner > small`
- `body .initiative-banner.leaving`
- `.initiative-banner .ib-line`
- `.initiative-banner .ib-word,.initiative-banner .ib-verdict,.initiative-banner .ib-detail`
- `.initiative-banner .ib-verdict`
- `.initiative-banner .ib-detail`
- `.initiative-banner,.initiative-banner .ib-word,.initiative-banner .ib-verdict,.initiative-banner .ib-detail`
- `.aura-awaken-choice`
- `.aura-awaken-choice`
- `.aura-awaken-choice,.aura-awaken-choice-panel`

### `showTrapActivation` (14개)
- `.global-spell-card`
- `.global-spell-card .global-icon`
- `.global-spell-card small`
- `.global-spell-card h2`
- `.global-spell-card p`
- `.global-spell-card`
- `.global-spell-card .global-icon`
- `.global-spell-card .global-icon img`
- `.global-spell-card h2`
- `.global-spell-card, .global-summon-card`
- `.global-spell-card`
- `.global-spell-card .global-icon`
- `.guardian-awakening .global-spell-card`
- `.guardian-awakening .global-icon img`

### `playGuardianDescent` (11개)
- `.gdx-veil`
- `.gdx-pillar`
- `.gdx-ring`
- `.gdx-ring.r2`
- `.gdx-wave`
- `.gdx-spark`
- `.gdx-core`
- `.gdx-sigil`
- `.gdx-core small`
- `.gdx-title`
- `.gdx-core p`

### `activateUltimate` (10개)
- `.ultimate-ring`
- `.ultimate-ring.r2`
- `.ultimate-sigil`
- `.ultimate-card`
- `.ultimate-card img`
- `.ultimate-card small`
- `.ultimate-card h2`
- `.ultimate-card p`
- `.ultimate-card strong`
- `.ultimate-particle`

### `syncGuardianAwakenAura` (9개)
- `.awaken-field-sigil`
- `.awaken-field-sigil::before,.awaken-field-sigil::after`
- `.awaken-field-sigil::after`
- `.awaken-field-sigil img`
- `.awaken-field-sigil.engraving`
- `.awaken-field-sigil.engraving img`
- `.awaken-field-sigil.engraving::before`
- `.awaken-field-sigil.engraving::after`
- `.awaken-field-sigil,.awaken-field-sigil::after`

### `typeSkillTitle` (7개)
- `.typed-skill-title i`
- `.typed-skill-title i.space`
- `.ultimate-cutscene-hero .typed-skill-title`
- `.ultimate-cutscene-hero .typed-skill-title i`
- `.ultimate-cutscene-hero .typed-skill-title`
- `.typed-skill-title .title-word`
- `.ultimate-cutscene-hero .typed-skill-title`

### `guardianProc` (7개)
- `.metal-experience-badge,.aura-burn-badge`
- `.metal-experience-badge`
- `.aura-burn-badge`
- `.metal-experience-badge>span,.aura-burn-badge>span`
- `.metal-experience-badge>span`
- `.aura-burn-badge>span`
- `.metal-experience-badge~.aura-burn-badge`

### `applyMagicRole` (6개)
- `.card.magic-heal`
- `.card.magic-heal::before`
- `.card.magic-heal .art`
- `.card.magic-heal .type,.card.magic-heal .card-stats`
- `.card.magic-heal h3`
- `.card.magic-heal p`

### `recycleGraveyardIntoDeck` (6개)
- `.enh-tier i.fresh`
- `.enh-tier .c0.fresh`
- `.enh-tier .c1.fresh`
- `.enh-tier .c2.fresh`
- `.enh-tier .c3.fresh`
- `.enh-tier i.fresh, .enh-tier .tier-spark`

### `animateNewTier` (6개)
- `.enh-tier .tier-spark`
- `.enh-tier .tier-spark.c0`
- `.enh-tier .tier-spark.c1`
- `.enh-tier .tier-spark.c2`
- `.enh-tier .tier-spark.c3`
- `.enh-tier .tier-spark`

### `toast` (6개)
- `.secret-teaser`
- `.secret-broken`
- `.secret-broken i`
- `.secret-broken i:nth-child(1)`
- `.secret-broken i:nth-child(2)`
- `.secret-broken i:nth-child(3)`

### `(HTML)` (5개)
- `.magic-field-card`
- `.magic-field-card.reaction`
- `.magic-field-card strong`
- `.magic-field-card small`
- `.magic-field-card`

### `updateHeroHealth` (5개)
- `.side`
- `.side h2`
- `.side h2 span`
- `.side`
- `.side`

### `pullCardMarkup` (5개)
- `.pull-appeal`
- `.pull-card.pull-land`
- `.pull-card`
- `.pull-card h4`
- `.pull-card small`

### `showCinematicSkillEffect` (5개)
- `.cinematic-skill-label`
- `.cinematic-skill-label`
- `.cinematic-skill-label::before`
- `.cinematic-skill-label`
- `.cinematic-skill-label`

### `codexArtMarkup` (5개)
- `.codex-glyph`
- `.codex-card.missing .codex-glyph`
- `.codex-detail-art .codex-glyph`
- `.codex-glyph`
- `.codex-detail-art .codex-glyph`

### `save` (5개)
- `.secret-unlock-note`
- `.secret-unlock-note small`
- `.secret-unlock-note strong`
- `.secret-unlock-note span`
- `.secret-unlock-note button`

### `runCombatQueue` (4개)
- `.spell`
- `.spell small`
- `.spell b`
- `.enh-tier.rewrite .enh-roman.new`

### `renderCardHpMeter` (4개)
- `.card-hp-meter`
- `.card-hp-meter i`
- `.card-hp-meter b`
- `.card-hp-meter`

### `createRuntimeBattleCard` (4개)
- `.element`
- `.element b`
- `.card.thunder`
- `.card.ice`

### `fieldAttack` (4개)
- `.field-attack-line`
- `.field-attack-line::after`
- `.field-attack-line.counter`
- `.field-attack-line.counter::after`

### `reviveLastFallenAlly` (4개)
- `.ultimate-effect-typing`
- `.ultimate-effect-typing::after`
- `.ultimate-effect-typing.complete::after`
- `.ultimate-effect-typing::after`

### `renderEnemyPiles` (4개)
- `.synth-slot.empty span`
- `.synth-slot.empty small`
- `.synth-slot.empty`
- `.synth-slot.empty span`

### `renderSynthesis` (4개)
- `.synth-pop`
- `.synth-card.synth-pop::before`
- `.synth-card.synth-wait span`
- `.synth-card.synth-wait small`

### `flyToDeck` (4개)
- `.deck-row.deck-row-pulse`
- `#build-count.count-bump`
- `.owned-card.add-denied`
- `#enhance-grid .enh-none`

### `applyPowerGrade` (3개)
- `.card.summon-card.grade-s`
- `.grade-s .power-grade`
- `.grade-s .card-stats span:first-child`

### `renderCodex` (3개)
- `.completion-chip`
- `.completion-chip.done`
- `.codex-card .completion-chip`

### `clearBeginnerCoach` (3개)
- `body.beginner-help [data-beginner-label].beginner-focus::after`
- `body.beginner-help .beginner-focus`
- `body.beginner-help [data-beginner-label].beginner-focus::after`

### `animateTierScore` (3개)
- `.tier-score-value.rolling`
- `.tier-delta.up`
- `.tier-delta.down`

### `syncAuraBurnVfx` (3개)
- `.aura-burn-vfx`
- `.aura-burn-vfx::before,.aura-burn-vfx::after`
- `.aura-burn-vfx::after`

### `persistTutorialMode` (2개)
- `.magic-field,.magic-field.has-magic`
- `.magic-field`

### `syncMagicHandSlotAvailability` (2개)
- `.global-summon`
- `.global-summon`

### `renderDeckBuilder` (2개)
- `.gacha-empty`
- `.gacha-empty`

### `showCharacterAppeal` (2개)
- `.gacha-reveal.rare`
- `.gacha-reveal.rare .gacha-card-front`

### `syncShieldAura` (2개)
- `.shield-aura-vfx`
- `.shield-aura-vfx`

### `buildBasicDeck` (2개)
- `.synth-have .deck.on`
- `.synth-have .deck.on b`

### `remapSavedByCardIds` (2개)
- `.enh-tier.rewrite .enh-roman.old`
- `.enh-tier.rewrite .enh-roman.old`

### `updateSwarmBonuses` (1개)
- `.spell-zone .sigil`

### `deckPanelMarkup` (1개)
- `.legend`

### `renderEnhancement` (1개)
- `.rule`

### `giveUp` (1개)
- `.art.art-failed::before`

### `borderImpact` (1개)
- `.card.draw-flipping`

### `flipReveal` (1개)
- `.card.draw-revealed`

### `flyGuardianToProfile` (1개)
- `.guardian-fly .aura-mark`

### `startBgm` (1개)
- `.owned-card.dragging, .deck-row.dragging`

### `startDeckTabRename` (1개)
- `.deck-tab .deck-tab-rename`

### `animateEnhancementEquip` (1개)
- `#enhance-result .synth-card.enh-equip-land`

### `mark` (1개)
- `.enh-tier.rewrite *`

## 클래스가 코드에 없는 규칙 66개 (지워도 되는 후보, 화면 영향 없음)

- `.hero-row`
- `.enemy-row`
- `.player-row`
- `.spell-zone`
- `.spell-zone small`
- `.spell-zone b`
- `.global-summon-card .summon-icon`
- `.global-summon-card .creature-art`
- `.magic-field-art`
- `.magic-field-art img`
- `.magic-field-art`
- `.global-summon-card`
- `.global-summon-card .summon-icon`
- `.global-summon-card small`
- `.global-summon-card h2`
- `.global-summon-card p`
- `.matchup`
- `.arrow`
- `.legend-row`
- `.dot`
- `.draw-fx`
- `.enemy-row`
- `.global-summon-card .attack-name`
- `.global-summon-card .attack-effect`
- `.global-summon-card .attack-effect strong`
- `.global-summon-card .attack-effect span`
- `.global-summon-card .attack-effect .attack-target`
- `.global-summon-card .attack-element`
- `.battle-rules`
- `.rule-chip`
- `.rule-chip strong`
- `.rule-chip.active`
- `.battle-rules`
- `.global-summon-card`
- `.global-summon-card .summon-icon`
- `.global-summon-card .creature-art`
- `.global-summon-card .attack-effect`
- `.global-summon-card .attack-effect strong`
- `.ultimate-cast`
- `.ultimate-cast:disabled`
- `.gd-cheongryong`
- `.gd-hyeonmu`
- `.gd-none`
- `.gs-skip`
- `.gs-skip small`
- `.gs-skip strong`
- `.gs-skip span`
- `.gs-skip:hover,.gs-skip:focus-visible`
- `.gd-cheongryong`
- `.gd-namu`
- `.gd-hyeonmu`
- `.synth-swirl`
- `.synth-spare.lock`
- `#enhance-result .synth-card.enh-land`
- `.enh-tier .c0`
- `.enh-tier .c1`
- `.enh-tier .c2`
- `.enh-tier .c3`
- `.top-collection`
- `.top-collection b`
- `.top-collection small`
- `.top-collection:hover`
- `.top-collection`
- `.top-collection b`
- `.top-collection small`
- `.top-collection:hover`
