import { createHash } from 'node:crypto';
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
  copyFile(resolve(root, '05_game-client/battle/engine-adapter.js'), resolve(output, 'engine-adapter.js')),
  copyFile(resolve(root, '05_game-client/battle/sfx-variety.js'), resolve(output, 'sfx-variety.js')),
  copyFile(resolve(root, '05_game-client/battle/attack-motions.js'), resolve(output, 'attack-motions.js')),
  copyFile(resolve(root, '05_game-client/battle/spell-cinematics.js'), resolve(output, 'spell-cinematics.js'))
]);
const cardSet = JSON.parse(await readFile(resolve(root, '03_card-data/sets/core-set.json'), 'utf8'));
const characterExpansions = JSON.parse(await readFile(resolve(root, '03_card-data/sets/character-expansions.json'), 'utf8'));
cardSet.cards.push(...characterExpansions.cards);
// 성격 오로라 5종으로 통합 (2026-11-05): 게임은 element 대신 personality(불·물·나무·금속·대지)를 쓴다.
// 기존 연출·소리·궁극기 코드가 element 키로 짜여 있어, 런타임 element를 성격의 내부 키로 바꿔 넣는다(원래 값은 legacyElement).
const AURA_KEY = { fire: 'fire', water: 'water', wood: 'wind', metal: 'neutral', earth: 'earth' };
const LEGACY_TO_AURA = { fire: 'fire', water: 'water', ice: 'water', wind: 'wood', thunder: 'metal', neutral: 'metal', earth: 'earth' };
for (const card of cardSet.cards) {
  const aura = card.personality || LEGACY_TO_AURA[card.element];
  card.legacyElement = card.element;
  card.personality = aura;
  card.element = AURA_KEY[aura];
}
const battleStarter = JSON.parse(await readFile(resolve(root, '03_card-data/sets/battle-starter.json'), 'utf8'));
const cardsJs = `globalThis.PrimalCardSet = Object.freeze(${JSON.stringify(cardSet)});\nglobalThis.PrimalBattleStarter = Object.freeze(${JSON.stringify(battleStarter)});\n`;
await writeFile(resolve(output, 'cards.js'), cardsJs);
// 브라우저가 옛 카드 데이터를 캐시해 두고 계속 쓰지 않도록, index.html의 cards.js 주소 버전을 내용 해시로 갱신한다.
const indexPath = resolve(root, 'dist/index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const cardsVersion = createHash('sha1').update(cardsJs).digest('hex').slice(0, 10);
const bumped = indexHtml.replace(/runtime\/cards\.js\?v=[^"']*/, `runtime/cards.js?v=${cardsVersion}`);
if (bumped !== indexHtml) await writeFile(indexPath, bumped);
console.log('Built deterministic runtime into dist/runtime');
