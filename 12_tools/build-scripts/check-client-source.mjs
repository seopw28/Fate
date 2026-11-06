import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const appDir = resolve(root, '05_game-client/app');
const manifest = JSON.parse(await readFile(resolve(appDir, 'app.sources.json'), 'utf8'));
if (!Array.isArray(manifest) || !manifest.length || new Set(manifest).size !== manifest.length) {
  throw new Error('app.sources.json must contain a non-empty, duplicate-free module list');
}
const parts = await Promise.all(manifest.map(name => readFile(resolve(appDir, 'modules', name), 'utf8')));
new vm.Script(parts.join(''), { filename: '05_game-client/app/modules/<bundle>' });
console.log(`Validated ${manifest.length} ordered client modules`);
