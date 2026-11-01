import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const setPath = resolve(here, '../sets/core-set.json');
const expansionPath = resolve(here, '../sets/character-expansions.json');
const starterPath = resolve(here, '../sets/battle-starter.json');
const [{ cards: coreCards, setId, setVersion }, { cards: expansionCards }, battleStarter] = await Promise.all([setPath, expansionPath, starterPath].map(async path => JSON.parse(await readFile(path, 'utf8'))));
const cards = [...coreCards, ...expansionCards];
const errors = [];
const ids = new Set();
const cardsById = new Map(cards.map(card => [card.cardId, card]));
const allowedTypes = new Set(['champion', 'spell', 'trap']);
const allowedElements = new Set(['fire', 'water', 'ice', 'wind', 'thunder', 'earth', 'neutral']);
const allowedRarities = new Set(['common', 'rare', 'legendary']);
const allowedSources = new Set(['starter', 'character_chat', 'summon', 'event', 'craft']);
const allowedReleaseStates = new Set(['live', 'prototype', 'retired']);
const allowedEffects = new Set(['burn', 'heal', 'damage', 'attack_down', 'buff', 'prevent_damage', 'lone_wolf', 'comeback', 'add_counter', 'transform', 'global_destroy', 'freeze_strongest', 'weaken_all', 'shock_storage', 'explosive_mark', 'blink_shield', 'armor_pierce', 'arcane_arrow', 'mass_heal', 'heal_bless', 'piercing_shot', 'battle_enhance', 'summon_wolf', 'sword_aura', 'necromancy', 'board_damage', 'draw', 'cleanse', 'bounce', 'mana_ramp', 'resurrect', 'negate_summon', 'self_replicate', 'black_flame', 'turn_invulnerable', 'frost_nova', 'swarm_fury', 'swarm_bulwark', 'lightning_strike', 'chain_lightning', 'summon_barrage', 'sweep_attack']);

for (const [index, card] of cards.entries()) {
  const at = `${setId}.cards[${index}]`;
  if (card.schemaVersion !== 1) errors.push(`${at}: schemaVersion must be 1`);
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(card.cardId ?? '')) errors.push(`${at}: invalid cardId`);
  if (ids.has(card.cardId)) errors.push(`${at}: duplicate cardId ${card.cardId}`);
  ids.add(card.cardId);
  if (!allowedTypes.has(card.cardType)) errors.push(`${at}: invalid cardType`);
  if (!allowedElements.has(card.element)) errors.push(`${at}: invalid element`);
  if (!allowedRarities.has(card.rarity)) errors.push(`${at}: invalid rarity`);
  if (card.releaseState !== undefined && !allowedReleaseStates.has(card.releaseState)) errors.push(`${at}: invalid releaseState`);
  if (!Number.isInteger(card.cost) || card.cost < 0 || card.cost > 20) errors.push(`${at}: invalid cost`);
  if (!Number.isInteger(card.deckLimit) || card.deckLimit < 1 || card.deckLimit > 3) errors.push(`${at}: invalid deckLimit`);
  if (card.cardType === 'champion' && (!card.stats || card.stats.attack < 0 || card.stats.health < 1)) errors.push(`${at}: champion stats required`);
  if (card.cardType !== 'champion' && card.stats !== null) errors.push(`${at}: non-champion stats must be null`);
  if (!Array.isArray(card.effects)) errors.push(`${at}: effects must be an array`);
  for (const effect of card.effects ?? []) {
    if (!allowedEffects.has(effect.effectId)) errors.push(`${at}: unknown effectId ${effect.effectId}`);
    if (effect.effectId === 'add_counter' && !effect.counterId) errors.push(`${at}: add_counter requires counterId`);
    if (effect.effectId === 'transform' && (!effect.cardRef || !effect.condition)) errors.push(`${at}: transform requires cardRef and condition`);
    if (effect.effectId === 'global_destroy' && effect.target !== 'all_champions') errors.push(`${at}: global_destroy must target all_champions`);
  }
  if (!card.assetId) errors.push(`${at}: assetId required`);
  if (!card.acquisition?.sources?.length) errors.push(`${at}: acquisition source required`);
  for (const source of card.acquisition?.sources ?? []) if (!allowedSources.has(source)) errors.push(`${at}: invalid acquisition source ${source}`);
}

if (!battleStarter.starterId) errors.push('battle-starter: starterId required');
if (!Array.isArray(battleStarter.cardIds) || battleStarter.cardIds.length !== 8) errors.push('battle-starter: exactly 8 cardIds required');
const starterIds = new Set();
for (const [index, cardId] of (battleStarter.cardIds ?? []).entries()) {
  if (starterIds.has(cardId)) errors.push(`battle-starter.cardIds[${index}]: duplicate cardId ${cardId}`);
  starterIds.add(cardId);
  if (!ids.has(cardId)) errors.push(`battle-starter.cardIds[${index}]: unknown cardId ${cardId}`);
  if (cardsById.get(cardId)?.releaseState === 'prototype') errors.push(`battle-starter.cardIds[${index}]: prototype cards cannot enter the starter hand`);
}

for (const [index, card] of cards.entries()) {
  const at = `${setId}.cards[${index}]`;
  if (card.collectible === false && !card.variantOf) errors.push(`${at}: non-collectible variants require variantOf`);
  if (card.releaseState === 'prototype' && card.acquisition?.sources?.includes('starter')) errors.push(`${at}: prototype cards cannot be starter rewards`);
  if (card.variantOf && !ids.has(card.variantOf)) errors.push(`${at}: unknown variantOf ${card.variantOf}`);
  for (const effect of card.effects ?? []) if (effect.cardRef && !ids.has(effect.cardRef)) errors.push(`${at}: unknown cardRef ${effect.cardRef}`);
}

const missingArt = cards.filter(card => card.cardType !== 'champion' && !/\.(png|webp|jpe?g|avif)$/i.test(card.assetId ?? '') && card.releaseState !== 'prototype');
if (missingArt.length) console.warn(`[art-queue] 일러스트 없는 마법/함정 ${missingArt.length}장 — Codex 토큰 회복 시 0순위로 생성 (06_assets/art-queue.md): ${missingArt.map(card => card.displayName).join(', ')}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${cards.length} cards from ${setId}@${setVersion} and ${battleStarter.cardIds.length} starter slots; all references are valid.`);
}
