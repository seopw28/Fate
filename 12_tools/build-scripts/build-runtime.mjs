import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const output = resolve(root, 'dist/runtime');
const appSource = resolve(root, '05_game-client/app');
await mkdir(output, { recursive: true });
await Promise.all([
  copyFile(resolve(root, '04_game-engine/src/engine.js'), resolve(output, 'engine.js')),
  copyFile(resolve(root, '04_game-engine/src/effects.js'), resolve(output, 'effects.js')),
  copyFile(resolve(root, '05_game-client/battle/engine-adapter.js'), resolve(output, 'engine-adapter.js')),
  copyFile(resolve(root, '05_game-client/battle/sfx-variety.js'), resolve(output, 'sfx-variety.js')),
  copyFile(resolve(root, '05_game-client/battle/attack-motions.js'), resolve(output, 'attack-motions.js')),
  copyFile(resolve(root, '05_game-client/battle/spell-cinematics.js'), resolve(output, 'spell-cinematics.js'))
]);
const cardSet = JSON.parse(await readFile(resolve(root, '03_card-data/sets/core-set.json'), 'utf8'));
const characterExpansions = JSON.parse(await readFile(resolve(root, '03_card-data/sets/character-expansions.json'), 'utf8'));
cardSet.cards.push(...characterExpansions.cards);
// 카드 데이터는 성격 오라 5종만 저장한다. 런타임의 옛 키는 CSS·연출 호환용 표현 계층이다.
const AURA_KEY = { fire: 'fire', water: 'water', wood: 'wind', metal: 'neutral', earth: 'earth' };
for (const card of cardSet.cards) {
  card.auraKey = AURA_KEY[card.aura];
}
const battleStarter = JSON.parse(await readFile(resolve(root, '03_card-data/sets/battle-starter.json'), 'utf8'));
// 오라 기본 덱 5종 (2026-11-09). 사람과 컴퓨터가 같은 목록에서 고른다.
const auraDecks = JSON.parse(await readFile(resolve(root, '03_card-data/sets/aura-decks.json'), 'utf8'));
const cardsJs = `globalThis.PrimalCardSet = Object.freeze(${JSON.stringify(cardSet)});\nglobalThis.PrimalBattleStarter = Object.freeze(${JSON.stringify(battleStarter)});\nglobalThis.PrimalAuraDecks = Object.freeze(${JSON.stringify(auraDecks)});\n`;
await writeFile(resolve(output, 'cards.js'), cardsJs);
// HTML/CSS/앱 로직의 정본은 05_game-client/app 아래에 둔다. dist는 항상 이 소스에서 재생성한다.
const indexPath = resolve(root, 'dist/index.html');
const [shell, styles, appManifest] = await Promise.all([
  readFile(resolve(appSource, 'index.shell.html'), 'utf8'),
  readFile(resolve(appSource, 'styles.css'), 'utf8'),
  readFile(resolve(appSource, 'app.sources.json'), 'utf8').then(JSON.parse)
]);
if (!Array.isArray(appManifest) || !appManifest.length) throw new Error('app.sources.json must list client modules');
const app = (await Promise.all(appManifest.map(name => readFile(resolve(appSource, 'modules', name), 'utf8')))).join('');
if (!shell.includes('<!-- FATE:STYLES -->') || !shell.includes('<!-- FATE:APP -->')) {
  throw new Error('05_game-client/app/index.shell.html is missing build placeholders');
}
const indexHtml = shell
  .replace('<!-- FATE:STYLES -->', `<style>${styles}</style>`)
  .replace('<!-- FATE:APP -->', `<script>${app}</script>`);
// 브라우저가 옛 카드 데이터를 캐시해 두고 계속 쓰지 않도록 cards.js 주소에 내용 해시를 붙인다.
const cardsVersion = createHash('sha1').update(cardsJs).digest('hex').slice(0, 10);
const bumped = indexHtml.replace(/runtime\/cards\.js\?v=[^"']*/, `runtime/cards.js?v=${cardsVersion}`);
await writeFile(indexPath, bumped);
console.log('Built deterministic client and runtime into dist/');
