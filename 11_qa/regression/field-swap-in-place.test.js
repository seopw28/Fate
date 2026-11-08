const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');
const fn = (name) => {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' 이 있어야 한다');
  return html.slice(start, html.indexOf('\n', start));
};

/* 2026-11-08 PM 피드백: 가득 찬 필드에서 하수인을 바꿀 때 잠깐 6장이 되어 보이면 안 된다.
   원인은 Element.remove 의 0.42초 소멸 연출이다. 새 카드를 먼저 넣고 옛 카드를 remove() 하면 옛 카드가 DOM 에 남아
   5칸 격자에서 여섯 번째가 다음 줄로 밀렸다. 동작은 12_tools/qa/check-field-swap.py 가 브라우저에서 프레임마다 센다. */

test('같은 칸 교체 도우미: 옛 카드는 즉시 필드에서 빼고 새 카드는 같은 위치에 넣는다', () => {
  const begin = fn('beginFieldSwap');
  const place = fn('placeSwapIncoming');
  assert.ok(begin.includes("closest('.arena')"), '소멸 연출은 필드 밖(.arena)의 복제본이 맡는다');
  assert.ok(begin.includes('cloneNode(true)') && begin.includes('FIELD_SWAP_MS'), '복제본이 정해진 시간 동안 가라앉는다');
  assert.ok(begin.includes('r.left+r.width/2-w/2'), '크게 표시되는 소진자도 중심 기준으로 맞춘다');
  assert.ok(place.includes('insertBefore(unit,slot.old)') && place.includes('removeChild(slot.old)'),
    '새 카드를 옛 카드 자리에 넣고 같은 동기 구간에서 옛 카드를 DOM 에서 뺀다(remove() 의 지연 소멸을 쓰지 않는다)');
  assert.match(html, /const FIELD_SWAP_MS=560;/, '교체 연출은 0.5~0.8초 안쪽');
});

test('교체 경로 전부가 도우미를 쓰고 옛 카드를 remove() 로 남기지 않는다', () => {
  const fieldReplace = html.slice(html.indexOf('if(pendingReplaceTarget?.isConnected&&pendingReplaceTarget.parentElement===lane)'));
  assert.ok(fieldReplace.slice(0, 400).includes('beginFieldSwap(old)') && fieldReplace.slice(0, 400).includes('placeSwapIncoming(slot,unit)'), '유저 수동 교체');
  assert.ok(!fieldReplace.slice(0, 400).includes('old.remove()'), '수동 교체는 old.remove() 를 쓰지 않는다');
  const avenger = fn('summonUltimateAvenger');
  assert.ok(avenger.includes('beginFieldSwap(replace)') && !avenger.includes('replace.remove()'), '복수자 강림 제물');
  assert.ok(avenger.includes("'ultimate-avenger',slot") && avenger.includes("label:'복수자'}},slot"), '복수자는 비운 칸에 선다(유저·컴퓨터)');
  const spent = fn('sendUltimateToGraveyard');
  assert.ok(spent.includes('beginFieldSwap(victim)') && !spent.includes('victim.remove()') && spent.includes("'ultimate-spent',slot"), '유저 소진자 제물');
  const enemySpent = fn('sendEnemyUltimateToGraveyard');
  assert.ok(enemySpent.includes('beginFieldSwap(victim)') && !enemySpent.includes('victim?.remove()') && enemySpent.includes('},slot);'), '컴퓨터 소진자 제물');
  const enemy = fn('replaceEnemyUnit');
  assert.ok(enemy.includes('beginFieldSwap(target)') && enemy.includes('enemySummonUnit(lane,data,slot)') && !enemy.includes('target.remove()'), '컴퓨터 교체');
});

test('묘지 처리·소진자 복수자 판정은 옛 카드가 필드에 있을 때 끝낸다', () => {
  const retire = fn('retireFieldUnit');
  assert.ok(retire.includes('showUltimateSpentDeath(unit)') && retire.includes('registerUltimateAvengerDeath'), '기존 효과 유지');
  assert.ok(retire.includes('opts?.inPlace)return'), '같은 칸 교체는 떠다니는 복제본을 따로 만들지 않는다');
  const player = html.slice(html.indexOf('const old=pendingReplaceTarget,slot=beginFieldSwap(old)'));
  assert.ok(player.indexOf('retireFieldUnit(old,{inPlace:true})') < player.indexOf('placeSwapIncoming(slot,unit)'),
    'retire 는 detach 전에: showUltimateSpentDeath 가 closest(.summon-zone) 로 편을 가린다');
});

test('새 카드는 비운 칸에 들어오는 연출을 가지고, 칸 수는 5로 고정이다', () => {
  assert.match(html, /\.unit\.unit-swap-in\{animation:unit-swap-in/);
  assert.match(html, /const FIELD_CARD_LIMIT = 5;/);
  assert.ok(fn('summonBattleToken').includes('if(slot)placeSwapIncoming(slot,unit,true)'));
  assert.ok(fn('enemySummonUnit').includes('if(slot)placeSwapIncoming(slot,unit,true)'));
  assert.ok(html.includes('enemySummonUnitImmediate(lane,data,slot)'), '컴퓨터 등장 래퍼가 slot 을 넘긴다');
});
