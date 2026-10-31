import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const specs = JSON.parse(await readFile(resolve(root, 'specs/skill-effects.json'), 'utf8'));
const registry = JSON.parse(await readFile(resolve(root, 'registry/effects.json'), 'utf8'));
const errors = [];
const allowedSemantic = new Set(['damage', 'heal', 'shield', 'buff', 'debuff', 'status', 'summon', 'ultimate']);
const allowedDelivery = new Set(['procedural', 'texture', 'sprite_sheet', 'hybrid']);
const allowedStatus = new Set(['planned', 'generating', 'candidate', 'approved', 'legacy', 'retired']);
const ids = new Set();

for (const [index, effect] of specs.effects.entries()) {
  const at = `specs.effects[${index}]`;
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(effect.effectId ?? '')) errors.push(`${at}: invalid effectId`);
  if (ids.has(effect.effectId)) errors.push(`${at}: duplicate effectId ${effect.effectId}`);
  ids.add(effect.effectId);
  if (!allowedSemantic.has(effect.semantic)) errors.push(`${at}: invalid semantic`);
  if (!allowedDelivery.has(effect.delivery)) errors.push(`${at}: invalid delivery`);
  if (!Number.isInteger(effect.durationMs) || effect.durationMs < 100 || effect.durationMs > 2500) errors.push(`${at}: durationMs outside budget`);
  if (!Array.isArray(effect.palette) || effect.palette.length < 2 || effect.palette.some(color => !/^#[0-9a-f]{6}$/i.test(color))) errors.push(`${at}: invalid palette`);
  if (!effect.motion?.entry || !effect.motion?.peak || !effect.motion?.exit) errors.push(`${at}: motion phases required`);
  if (effect.performance?.maxParticles > 48) errors.push(`${at}: particle budget exceeded`);
  if (effect.performance?.maxTextureSize > 2048) errors.push(`${at}: texture budget exceeded`);
  if (effect.performance?.maxBytes > 2097152) errors.push(`${at}: file budget exceeded`);
  if (!effect.reducedMotion) errors.push(`${at}: reducedMotion fallback required`);
}

const registered = new Set();
for (const [index, effect] of registry.effects.entries()) {
  const at = `registry.effects[${index}]`;
  if (registered.has(effect.effectId)) errors.push(`${at}: duplicate registry effectId ${effect.effectId}`);
  registered.add(effect.effectId);
  if (!ids.has(effect.effectId)) errors.push(`${at}: missing effect spec ${effect.effectId}`);
  if (!allowedStatus.has(effect.status)) errors.push(`${at}: invalid status`);
  if (effect.status === 'approved' && !effect.approvedAsset) errors.push(`${at}: approved effect requires approvedAsset`);
}

for (const effectId of ids) if (!registered.has(effectId)) errors.push(`registry: missing ${effectId}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${ids.size} effect specs and ${registered.size} registry entries.`);
}
