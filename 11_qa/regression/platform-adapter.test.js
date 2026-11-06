const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '05_game-client/app/modules/00-platform-adapters.js'), 'utf8');

test('platform adapter isolates browser storage and supports FE injection', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const context = { Math, __FATE_PLATFORM__: { storage, economyRandom: { next: () => 0.25 } } };
  context.globalThis = context;
  vm.runInNewContext(source, context);

  context.FatePlatform.storage.setItem('count', 7);
  assert.equal(context.FatePlatform.storage.getItem('count'), '7');
  context.FatePlatform.storage.removeItem('count');
  assert.equal(context.FatePlatform.storage.getItem('count'), null);
  assert.equal(context.FatePlatform.economyRandom.next(), 0.25);
});

test('economy decisions use the injectable random source', () => {
  const app = fs.readFileSync(path.join(root, '05_game-client/app/modules/03-collection-progression.js'), 'utf8');
  assert.ok(app.includes('economyRandom.next()*100<synthChance(count)'));
  assert.ok(app.includes('success=economyRandom.next()*100<rule.chance'));
  assert.equal(/Math\.random\(\)/.test(app), false);
});
