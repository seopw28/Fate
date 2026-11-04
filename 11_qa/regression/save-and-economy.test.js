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

test('경제: 정상 수호신은 100, 약자멸시 패배·기권·이탈은 200', () => {
  assert.ok(html.includes('const GUARDIAN_COST=100,VICTORY_STEAL=200;'), 'Guardian selection must follow the PRD price');
  assert.ok(html.includes('const CHALLENGE_LOSS_COST = 200;'), 'Challenge loss must be a single named constant');
});

test('수호신 선택: 최초 선택 화면과 프로필에 인물 대신 전용 문양을 표시한다', () => {
  const sigils = ['zeus-sigil-v1.png', 'poseidon-sigil-v1.png', 'hades-sigil-v1.png', 'athena-sigil-v1.png'];
  for (const file of sigils) {
    assert.ok(html.includes(`assets/guardians/${file}`), `${file} must be connected`);
    assert.ok(fs.existsSync(path.resolve(__dirname, '../../dist/assets/guardians', file)), `${file} must be shipped`);
  }
  assert.ok(html.includes('.gs-jujak .gs-face::before') && html.includes('.gs-baekho .gs-face::before'), 'Initial guardian choices must render sigils');
  assert.ok(html.includes("avatar.innerHTML=challenge?'약':'<img src=\"'+GUARDIANS[id].sigil"), 'Selected guardian profile must keep the same sigil');
  assert.ok(html.includes("ghost.innerHTML='<img src=\"'+GUARDIANS[id].sigil"), 'Selection flight must carry the sigil into the profile');
});

test('아테나: 낮은 피해로 자주 반격하며 고공격력 폭주를 제한한다', () => {
  assert.ok(html.includes("chance:.60,ratio:.15,maxDamage:2,short:'연속 반격'"), 'Athena must trade damage for a 60% proc rate');
  assert.ok(html.includes('Math.max(1,Math.min(athena.maxDamage,Math.ceil(attack*athena.ratio)))'), 'Counter damage must scale down and stay between 1 and 2');
  assert.ok(html.includes("athena.name+' · 연속 반격 '+power"), 'Frequent counters must have an explicit combat cue');
});

test('수호신 밸런스: 제우스 S급 25%, 하데스 치명타 생존 5%', () => {
  assert.ok(html.includes("jujak:{name:'제우스',title:'천공의 왕',seal:'제',sigil:'assets/guardians/zeus-sigil-v1.png',chance:.25"), 'Zeus proc rate must be 25%');
  assert.ok(html.includes("hyeonmu:{name:'하데스',title:'저승의 왕',seal:'하',sigil:'assets/guardians/hades-sigil-v1.png',chance:.05,maxProcs:1"), 'Hades survival rate must be 5% with one proc per battle');
});

test('포세이돈: 60% 확률로 마나 1~2를 회복한다', () => {
  assert.ok(html.includes("chance:.60,manaMin:1,manaMax:2,short:'마나 회복'"), 'Poseidon must proc at 60% with a 1-2 mana range');
  assert.ok(html.includes('const rollPoseidonMana=()=>engineAdapter.randomInt(GUARDIANS.cheongryong.manaMin,GUARDIANS.cheongryong.manaMax)'), 'Runtime recovery must roll the configured range');
});

test('수호신 궁극기: 5턴부터 마나 7로 3턴간 발동 확률을 1.5배 강화한다', () => {
  assert.ok(html.includes('GUARDIAN_AWAKEN_COST=7,GUARDIAN_AWAKEN_MIN_TURN=5,GUARDIAN_AWAKEN_DURATION=3,GUARDIAN_AWAKEN_MULTIPLIER=1.5'), 'Guardian awakening constants must stay explicit');
  assert.ok(html.includes("Math.min(1,GUARDIANS[id].chance*(guardianAwakenActive(side)?GUARDIAN_AWAKEN_MULTIPLIER:1))"), 'Awakening must boost and cap proc chance');
  assert.ok(html.includes('guardianAwakenUntil=turnNumber+GUARDIAN_AWAKEN_DURATION'), 'Awakening must expire after its configured turns');
  assert.ok(html.includes("if(!playerGuardian)return '수호신 필요'"), 'Challenge mode must not receive a guardian ultimate');
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

test('개발 환경: 상점·소환 시연은 크래커 부족으로 막히지 않는다', () => {
  assert.ok(html.includes('const DEV_CRACKER_FLOOR=999999;'), 'Local demo balance must have a generous named floor');
  assert.ok(html.includes('if(DEV_MODE&&collectionState.crackers<DEV_CRACKER_FLOOR)'), 'The refill must be restricted to development hosts');
});

test('PRD: 티어·배치·시즌 현황과 PvP 승패 점수 정산을 제공한다', () => {
  assert.ok(html.includes("const RANK_KEY='fate-rank-v1'"), 'Rank progression must persist independently');
  assert.ok(html.includes("delta=ranked?(win?20:-20):0"), 'PvP wins and losses must change score by 20');
  assert.ok(html.includes("rankState.placementPlayed=Math.min(5,rankState.placementPlayed+1)"), 'Placement must complete after five ranked matches');
  assert.ok(html.includes('시즌 리더보드 <small>· 목업 데이터</small>'), 'Simulated leaderboard data must be disclosed');
});

test('승패 연출: 2초 뒤 티어 화면으로 전환하고 점수를 굴려 정산한다', () => {
  assert.ok(html.includes("setTimeout(()=>{resultNode.classList.remove('show','auto-transition');openTierStatus(rank);},2000)"), 'Result alert must hand off to rank status after two seconds');
  assert.ok(html.includes('function animateTierScore(rank)'), 'Rank settlement must have a named score animation');
  assert.ok(html.includes("value.classList.add('rolling')"), 'Score must visibly roll before settling');
  assert.ok(html.includes("value.classList.add('settled')"), 'Score animation must land on the final value');
});

test('PRD: 카드 소환 가격은 1회 200, 10회 2,000이다', () => {
  assert.ok(html.includes('const GACHA_SINGLE_COST=200,GACHA_TEN_COST=2000;'), 'Gacha costs must use named PRD values');
  assert.ok(html.includes('count===10?GACHA_TEN_COST:GACHA_SINGLE_COST'), 'Pull settlement must use the PRD costs');
});

test('궁극기: 피해·버프 이펙트는 컷씬·오버레이가 끝난 뒤에 적용한다', () => {
  assert.ok(html.includes('ULTIMATE_EFFECT_DELAY=ULTIMATE_OVERLAY_MS+30'), 'Effect delay must exceed the overlay duration');
  assert.ok(html.includes('},ULTIMATE_EFFECT_DELAY);setTimeout(()=>overlay.remove(),ULTIMATE_OVERLAY_MS);'), 'Effects must be scheduled with the named delay, not a fixed 900ms');
});

test('궁극기: 사용한 턴으로부터 재사용 대기 턴이 지나야 다시 쓸 수 있다', () => {
  assert.ok(html.includes('const ULTIMATE_COOLDOWN_TURNS=3;'), 'Cooldown must be a single named constant');
  assert.ok(html.includes('turnNumber<lastUltimateTurn+ULTIMATE_COOLDOWN_TURNS'), 'Lock reason must enforce the cooldown');
  assert.ok(html.includes('lastUltimateTurn=turnNumber;'), 'Activation must record the turn it was used');
});

test('궁극기: 땅 궁극기는 회복이 아니라 절대방어(+강한 카드는 부활)다', () => {
  assert.ok(html.includes("earth:'절대성역'"), 'Earth ultimate must be renamed to the absolute sanctuary');
  assert.ok(html.includes("else if(spec.element==='earth'){absoluteDefense=true;"), 'Earth ultimate must enable absolute defense');
  assert.ok(!html.includes("showSkillEffect('shield',unit,'성역 +'+heal)"), 'Earth ultimate must no longer heal allies');
  assert.ok(html.includes('if(absoluteDefense&&target.closest&&sideOfUnit(target)===\'player\')'), 'Allied champions must take no damage during absolute defense');
  assert.ok(html.includes("absoluteDefense=false;turnNumber++;"), 'Absolute defense must expire when the next player turn starts');
});

test('손패: 사용 가능 여부 우선, 같은 등급 안에서는 가치(비용>공격력>체력) 높은 카드가 위', () => {
  assert.ok(html.includes('Number(a.dataset.usabilityRank)-Number(b.dataset.usabilityRank)||handCardValue(b)-handCardValue(a)'), 'Hand sort must rank usability first, then card value');
  assert.ok(html.includes('function handCardValue(card)'), 'Card value must be a named helper');
});

test('최후의 발악: 내 턴 시작에 덱에서 카드를 1장 더 받는다', () => {
  assert.ok(html.includes("drawCard();/* 최후의 발악: 내 턴 시작에 덱에서 1장 더 받는다"), 'Turn start must draw an extra card while desperate');
  assert.ok(html.includes("if(desperateActive('player')&&deck.length&&document.querySelectorAll('.hand .card').length<8){drawCard();"), 'Extra draw must respect deck and hand limits');
});

test('운명 걸기: 건 마나의 2배 피해, 50% 확률', () => {
  assert.ok(html.includes('const FATE_GAMBLE_MULTIPLIER=2;'), 'Multiplier must be a named constant');
  assert.ok(html.includes('damage=stake*FATE_GAMBLE_MULTIPLIER,hitEnemy=Math.random()<.5'), 'Damage must be stake x2 with a coin flip');
});

test('최후의 발악: 처음 발동된 내 턴에 한해 마법카드 1장을 즉시 발동', () => {
  assert.ok(html.includes("desperateQuickCastTurn=battlePhase==='setup'?turnNumber:turnNumber+1"), 'Window must be the first player turn of desperation');
  assert.ok(html.includes("return desperateQuickCastTurn===turnNumber&&!desperateQuickCastUsed&&battlePhase==='setup';"), 'Quick cast is once, only in that turn');
  assert.ok(html.includes("if(quickCast){desperateQuickCastUsed=true;"), 'Playing a spell in the window must cast it instead of setting it');
});
