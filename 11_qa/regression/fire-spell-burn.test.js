const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('화염 피해 마법은 생존한 적 챔프에게 화상 1을 남긴다', () => {
  assert.ok(html.includes("function applyFireSpellBurn(card,target,outcome)"));
  assert.ok(html.includes("getElement(card)!=='fire'||card?.dataset?.effect==='black-flame'"), '비화염 주문과 자체 화상 주문은 제외해야 한다');
  assert.ok(html.includes('applyFireSpellBurn(card,unit,result)'), '단일·광역 화염 주문의 피해 결과를 화상 판정에 전달해야 한다');
  assert.ok(html.includes("reversalDamageAll(units,()=>amount,element,element==='fire'?'화염 마법':'')"), '화염 역전 주문도 화상을 남겨야 한다');
  assert.ok(html.includes("FIRE_SPELL_BURN_EFFECTS=new Set(['lightning-strike','board-damage','comeback-flare','reversal-weight-toll'])"), '카드 설명에도 공통 화상 규칙을 표시해야 한다');
});

test('상대 화염 마법도 동일하게 화상을 부여한다', () => {
  assert.ok(html.includes("enemyDamageUnits([strongest],amount,card.el,card.el==='fire'?'상대 화염 마법':'')"));
  assert.ok(html.includes("enemyDamageUnits(foes,amount||4,card.el,card.el==='fire'?'상대 화염 마법':'')"));
  assert.ok(html.includes("enemyDamageUnits(foes,amount||5,card.el,card.el==='fire'?'상대 화염 마법':'')"));
});

test('화상은 누적되고 보호막·처치 시에는 추가되지 않는다', () => {
  assert.ok(html.includes("target.dataset.burn=String((Number(target.dataset.burn)||0)+burn)"));
  assert.ok(html.includes("outcome?.blocked||outcome?.hp<=0"));
  assert.ok(html.includes("element==='fire'&&!result.blocked&&result.hp>0"));
});
