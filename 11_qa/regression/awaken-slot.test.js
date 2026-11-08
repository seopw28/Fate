const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require('node:path').resolve(__dirname, '../../dist/index.html'), 'utf8');

test('오라 각성 받침: 평소엔 가운데가 비고, 각성 강하 연출이 걷힐 때만 올라와 문양을 받쳐 든 뒤 내려간다 (2026-11-09 PM)', () => {
  assert.ok(html.includes('.arena>.field-action-dock>.aura-sigil-slot{opacity:0;background:none;box-shadow:none}'), '버튼 사이 자리는 비어 있다');
  assert.ok(!html.includes("slot.classList.toggle('filled',filled)"), '각성 뒤 문양을 상시로 박아 두지 않는다');
  assert.ok(html.includes('awakenSlotTimer=setTimeout(()=>settleAwakenSlot(awakenedId,AWAKEN_SLOT_HOLD_MS),AWAKEN_SLOT_RISE_MS);'), '강화를 고른 뒤 강하 연출 끝무렵에 올라온다');
  assert.ok(html.includes("awakenSlotTimer=setTimeout(lowerAwakenSlot,holdMs);"), '받쳐 든 뒤 내려간다');
  assert.ok(html.includes('.aura-slot-float{--slot-aura:#9aa3b5;position:fixed;z-index:530;'), '연출 화면보다 위층에 띄운다');
});
