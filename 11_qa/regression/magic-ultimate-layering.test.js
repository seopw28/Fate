import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');

test('마법카드 공개 레이어는 궁극기 버튼보다 항상 앞에 표시된다', () => {
  assert.ok(html.includes('.global-spell{z-index:31;isolation:isolate}'));
  assert.ok(html.includes('.arena>.field-action-dock{z-index:12}'));
  assert.ok(html.indexOf('.global-spell{z-index:31;isolation:isolate}') > html.indexOf('.global-spell { position:fixed'));
});
