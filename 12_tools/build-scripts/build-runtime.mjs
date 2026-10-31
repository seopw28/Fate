import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const output = resolve(root, 'dist/runtime');
await mkdir(output, { recursive: true });
await Promise.all([
  copyFile(resolve(root, '04_game-engine/src/engine.js'), resolve(output, 'engine.js')),
  copyFile(resolve(root, '04_game-engine/src/effects.js'), resolve(output, 'effects.js')),
  copyFile(resolve(root, '05_game-client/battle/engine-adapter.js'), resolve(output, 'engine-adapter.js'))
]);
const cardSet = JSON.parse(await readFile(resolve(root, '03_card-data/sets/core-set.json'), 'utf8'));
const characterExpansions = JSON.parse(await readFile(resolve(root, '03_card-data/sets/character-expansions.json'), 'utf8'));
cardSet.cards.push(...characterExpansions.cards);
const battleStarter = JSON.parse(await readFile(resolve(root, '03_card-data/sets/battle-starter.json'), 'utf8'));
await writeFile(resolve(output, 'cards.js'), `globalThis.PrimalCardSet = Object.freeze(${JSON.stringify(cardSet)});\nglobalThis.PrimalBattleStarter = Object.freeze(${JSON.stringify(battleStarter)});\n`);
console.log('Built deterministic runtime into dist/runtime');
