const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

// index.html 안의 순수 함수를 그대로 꺼내 단위 테스트한다 (브라우저 없이 실행).
function extractFunction(name, endMarker) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `function ${name} must stay extractable (keep the end marker "${endMarker}")`);
  return new Function(`${html.slice(start, end)}\nreturn ${name};`)();
}

const remap = extractFunction('remapSavedByCardIds', '/* end remapSavedByCardIds */');

test('저장 데이터: 카드 목록이 같으면 그대로 둔다', () => {
  const saved = { owned: [1, 2, 3], deck: [0, 1, 2], cardIds: ['a', 'b', 'c'] };
  assert.equal(remap(saved, ['a', 'b', 'c']), saved);
});

test('저장 데이터: 중간 카드가 삭제돼도 cardId 기준으로 보유 수량과 덱이 따라간다', () => {
  const saved = { owned: [1, 2, 3, 4], deck: [0, 1, 2, 3, 3], cardIds: ['a', 'b', 'c', 'd'] };
  const result = remap(saved, ['a', 'c', 'd']);
  assert.deepEqual(result.owned, [1, 3, 4]);
  assert.deepEqual(result.deck, [0, 1, 2, 2], '삭제된 b는 덱에서 빠지고 나머지는 새 순번으로 바뀐다');
  assert.deepEqual(result.cardIds, ['a', 'c', 'd']);
});

test('저장 데이터: 카드가 중간에 끼어들면 새 카드는 0장, 기존 카드는 제 자리를 지킨다', () => {
  const saved = { owned: [5, 6], deck: [0, 1, 1], cardIds: ['a', 'c'] };
  const result = remap(saved, ['a', 'b', 'c']);
  assert.deepEqual(result.owned, [5, 0, 6]);
  assert.deepEqual(result.deck, [0, 2, 2]);
});

test('저장 데이터: 순서가 바뀌어도 같은 카드를 가리킨다', () => {
  const saved = { owned: [1, 2, 3], deck: [0, 0, 2], cardIds: ['a', 'b', 'c'] };
  const result = remap(saved, ['c', 'a', 'b']);
  assert.deepEqual(result.owned, [3, 1, 2]);
  assert.deepEqual(result.deck, [1, 1, 0]);
});

test('저장 데이터: cardIds가 없거나 길이가 어긋나면 건드리지 않는다 (예전 형식 호환)', () => {
  const legacy = { owned: [1, 2], deck: [0, 1] };
  assert.equal(remap(legacy, ['x', 'y', 'z']), legacy);
  const broken = { owned: [1, 2], deck: [0, 1], cardIds: ['a', 'b', 'c'] };
  assert.equal(remap(broken, ['a', 'b']), broken);
});

test('저장: 항상 cardIds를 함께 저장하고 불러올 때 현재 목록에 맞춘다', () => {
  assert.ok(html.includes('const COLLECTION_CARD_IDS=collectionCardDefs.map(card=>card.cardId)'), 'Card id list must be derived from the live collection');
  assert.ok(html.includes("JSON.stringify({...collectionState,cardIds:COLLECTION_CARD_IDS})"), 'Every save must stamp cardIds');
  assert.ok(html.includes('remapSavedByCardIds(saved,COLLECTION_CARD_IDS)'), 'Loading must realign saved data by cardId');
});

test('경제: 수호신 선불 100, 약자멸시 패배·기권·이탈 200', () => {
  assert.ok(html.includes('const GUARDIAN_COST=100,VICTORY_STEAL=200;'), 'Guardian cost and victory steal are tuned together');
  assert.ok(html.includes('const CHALLENGE_LOSS_COST = 200;'), 'Challenge loss must be a single named constant');
});

test('경제: 기권은 패배(finish)로 합쳐 처리하고 별도 전달분을 두지 않는다', () => {
  const surrender = html.slice(html.indexOf('function surrenderBattle('), html.indexOf('function finish('));
  assert.ok(surrender.includes("finish(false,'기권했습니다. 기권은 패배로 계산됩니다.',true)"), 'Surrender must finish as a defeat with the forfeit flag');
  assert.ok(!surrender.includes('animateCrackerTransfer'), 'Surrender must not run its own cracker transfer');
  assert.ok(html.includes('if(!win&&(challengeMode||forfeit))'), 'Defeat penalty must cover both challenge mode and forfeit');
});

test('경제: 약자멸시를 끝내지 않고 떠나면 다음 접속에서 패배로 정산한다', () => {
  assert.ok(html.includes('collectionState.pendingChallenge=true;persistCollection();'), 'Picking the challenge must persist an in-progress marker');
  assert.ok(html.includes('if(collectionState.pendingChallenge){collectionState.pendingChallenge=false;persistCollection();}'), 'Finishing the battle must clear the marker');
  assert.ok(html.includes('saved.pendingChallenge===true'), 'Loading must settle an abandoned challenge');
});

test('보안: 크래커/수호신 URL 옵션은 개발 환경에서만 동작한다', () => {
  assert.ok(html.includes("const DEV_MODE = ['localhost','127.0.0.1','[::1]',''].includes(location.hostname);"), 'DEV_MODE must be derived from the host');
  assert.ok(html.includes("requested=DEV_MODE?params.get('crackers'):null"), '?crackers must be gated by DEV_MODE');
  assert.ok(html.includes("preset=DEV_MODE?params.get('guardian'):null"), '?guardian must be gated by DEV_MODE');
});

test('필살기: 피해·버프 이펙트는 컷씬·오버레이가 끝난 뒤에 적용한다', () => {
  assert.ok(html.includes('ULTIMATE_EFFECT_DELAY=ULTIMATE_OVERLAY_MS+30'), 'Effect delay must exceed the overlay duration');
  assert.ok(html.includes('},ULTIMATE_EFFECT_DELAY);setTimeout(()=>overlay.remove(),ULTIMATE_OVERLAY_MS);'), 'Effects must be scheduled with the named delay, not a fixed 900ms');
});

test('필살기: 사용한 턴으로부터 재사용 대기 턴이 지나야 다시 쓸 수 있다', () => {
  assert.ok(html.includes('const ULTIMATE_COOLDOWN_TURNS=3;'), 'Cooldown must be a single named constant');
  assert.ok(html.includes('turnNumber<lastUltimateTurn+ULTIMATE_COOLDOWN_TURNS'), 'Lock reason must enforce the cooldown');
  assert.ok(html.includes('lastUltimateTurn=turnNumber;'), 'Activation must record the turn it was used');
});

test('필살기: 땅 필살기는 회복이 아니라 절대방어(+강한 카드는 부활)다', () => {
  assert.ok(html.includes("earth:'절대성역'"), 'Earth ultimate must be renamed to the absolute sanctuary');
  assert.ok(html.includes("else if(spec.element==='earth'){absoluteDefense=true;"), 'Earth ultimate must enable absolute defense');
  assert.ok(!html.includes("showSkillEffect('shield',unit,'성역 +'+heal)"), 'Earth ultimate must no longer heal allies');
  assert.ok(html.includes('if(absoluteDefense&&target.closest&&sideOfUnit(target)===\'player\')'), 'Allied champions must take no damage during absolute defense');
  assert.ok(html.includes("absoluteDefense=false;turnNumber++;"), 'Absolute defense must expire when the next player turn starts');
});
