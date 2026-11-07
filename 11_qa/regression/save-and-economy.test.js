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

test('경제: 성격 오라는 재화 비용 없이 선택한다', () => {
  assert.ok(!html.includes('GUARDIAN_COST'), 'Guardian selection must not have a currency price');
  assert.ok(!html.includes('CHALLENGE_LOSS_COST'), 'Challenge mode must not have a separate defeat penalty');
  assert.ok(html.includes('별도 재화 비용 없이'), 'Guardian selection must explain that it is free');
});

test('오라 선택: 성격의 오라 5종을 오각형 꼭짓점에 배치하고 프로필에도 같은 문양을 표시한다', () => {
  for (const [id, label] of [['cheongryong', '물'], ['jujak', '불'], ['namu', '나무'], ['baekho', '금속'], ['hyeonmu', '대지']]) {
    assert.ok(html.includes(id + ":{name:'" + label + "의 오라',label:'" + label + "'"), `${label} aura must exist`);
  }
  assert.ok(html.includes("['jujak','cheongryong','namu','baekho','hyeonmu'].map(card)"), 'Aura choices must follow 화·수·목·금·토 order');
  assert.ok(html.includes(".guardian-select.gs-aura .gs-jujak{left:35%;top:12%}"), 'Fire aura must anchor the top vertex');
  assert.ok(html.includes(".guardian-select.gs-aura .gs-cheongryong{left:68%;top:34%}"), 'Water aura must anchor the upper-right vertex');
  assert.ok(html.includes(".guardian-select.gs-aura .gs-namu{left:56%;top:70%}"), 'Wood aura must anchor the lower-right vertex');
  assert.ok(html.includes(".guardian-select.gs-aura .gs-baekho{left:14%;top:70%}"), 'Metal aura must anchor the lower-left vertex');
  assert.ok(html.includes(".guardian-select.gs-aura .gs-hyeonmu{left:2%;top:34%}"), 'Earth aura must anchor the upper-left vertex');
  assert.ok(html.includes('class="aura-pentagon-core"'), 'Aura choice must include a central pentagon core');
  assert.ok(!html.includes('<button class="gs-skip" data-guardian="none">'), 'The challenge (no aura) option must not be offered on the aura screen');
  assert.ok(html.includes('<h2>성격의 오라</h2>'), 'Aura screen title must be 성격의 오라');
  for (const child of ['열정의 아이', '포용의 아이', '성장의 아이', '냉철의 아이', '무던의 아이']) assert.ok(html.includes("child:'" + child + "'"), `${child} must be the aura persona name`);
  assert.ok(html.includes('avatar.innerHTML=auraMark(id);'), 'Selected aura profile must keep the same mark');
  assert.ok(html.includes('ghost.innerHTML=auraMark(id);'), 'Selection flight must carry the mark into the profile');
  for (const asset of ['fire-sigil.svg', 'water-sigil.svg', 'wood-sigil.svg', 'metal-sigil.svg', 'earth-sigil.svg']) assert.ok(html.includes('assets/auras/' + asset), `${asset} must be wired into the aura model`);
  assert.ok(html.includes("<img src=\"'+aura.sigil+'\" alt=\"'+aura.name+' 문양\">"), 'Aura marks must use images instead of letter glyphs');
});

test('금속의 오라: 맨 왼쪽 챔프가 생존 경험으로 공격력을 한 번 성장시킨다', () => {
  assert.ok(html.includes("survivalStep:.26,maxChance:.90,attackGain:4,short:'생존 경험'"));
  assert.ok(html.includes("unit.dataset.metalSurvivalTurns=String((Number(unit.dataset.metalSurvivalTurns)||0)+1)"));
  assert.ok(html.includes("front.dataset.metalExperienced='true'"), 'Metal attack growth must be limited to once per champion');
  /* 배지 글자를 어느 노드에 넣는지(badge 직접 / 안쪽 span)는 레이아웃 사정으로 바뀐다.
     불변식만 본다 — 현재 생존 턴수와 확률이 글자로 나오고, 단련이 끝나면 완료로 바뀐다. */
  assert.ok(/\.textContent=front\.dataset\.metalExperienced==='true'\?'단련 완료':'생존 '\+turns\+'턴 · '\+Math\.round\(chance\*100\)\+'%'/.test(html), 'The current survival chance must be visible');
});

test('오라 밸런스: 불 공격·반격 화상 30%, 대지 치명타 생존 1.5%, 나무 체력 성장 78%', () => {
  assert.ok(html.includes("chance:.30,burnDamage:1,burnTurns:2,short:'화상'"));
  assert.ok(html.includes("target.dataset.auraBurn=String(Math.max(Number(target.dataset.auraBurn)||0,damage))"), 'Fire burn damage must persist without additive stacking');
  assert.ok(html.includes("target.dataset.auraBurnTurns=String(Math.max(Number(target.dataset.auraBurnTurns)||0,turns))"), 'Reapplying burn must refresh rather than stack its duration');
  assert.ok(html.includes("afterHp>0&&afterHp<beforeHp)applyAuraBurn(attackerSide,defender)"), 'Burn requires actual combat damage and a surviving champion');
  assert.ok(html.includes("hyeonmu:{name:'대지의 오라',label:'대지',title:'무던',seal:'땅',color:'#d9a35b',sigil:'assets/auras/earth-sigil.svg',chance:.015,maxProcs:1"));
  assert.ok(html.includes("namu:{name:'나무의 오라',label:'나무',title:'발전',seal:'목',color:'#5fd38a',sigil:'assets/auras/wood-sigil.svg',chance:.78,short:'체력 성장'"));
  assert.ok(html.includes("growNamuField('player')") && html.includes("growNamuField('enemy')"), 'Wood growth must work for both sides');
  assert.ok(html.includes("if(!guardianProc(side,'namu'))return;grown++"), 'Each field card must roll independently');
});

test('물의 오라: 27% 확률로 마나 1~2를 회복한다', () => {
  assert.ok(html.includes("chance:.27,manaMin:1,manaMax:2,short:'마나 회복'"));
  assert.ok(html.includes("const rollPoseidonMana=side=>{const config=guardianAuraConfig(side,'cheongryong');return engineAdapter.randomInt(config.manaMin,config.manaMax);}"), 'Runtime recovery must roll the base or awakened configured range');
});

test('오라 각성: 체력 80 이하에서 양자택일하고 배틀 종료까지 유지한다', () => {
  assert.ok(html.includes('ULTIMATE_UNLOCK_HP=80') && html.includes('const GUARDIAN_AWAKEN_HP=ULTIMATE_UNLOCK_HP;'), 'Awakening must unlock at 80 hero HP');
  assert.ok(html.includes('playerHp<=GUARDIAN_AWAKEN_HP'), 'Runtime must detect the awakening health threshold');
  assert.ok(html.includes("guardianAwakenChoice=choice"), 'The selected awakening branch must be stored');
  assert.ok(html.includes('const guardianAwakenActive=side=>Boolean(guardianAwakenChoiceOf(side))'), 'Awakening must remain active for either side after selection');
  assert.ok(html.includes("jujak:{A:{name:'불길 확산',chance:.40,burnDamage:1,burnTurns:5"));
  assert.ok(html.includes("B:{name:'업화',chance:.20,burnDamage:3,burnTurns:2"));
  assert.ok(html.includes("A:{name:'범람',chance:.045,manaMin:7,manaMax:7"));
  assert.ok(html.includes("B:{name:'순환',chance:.27,manaMin:2,manaMax:2"));
  assert.ok(html.includes("A:{name:'숲의 생명',chance:1,hpGain:2"));
  assert.ok(html.includes("B:{name:'거목 수호',chance:.35,hpGain:5,leftmostOnly:true"));
  assert.ok(html.includes("A:{name:'숙련 가속',survivalStep:.42,maxChance:1,attackGain:4"));
  assert.ok(html.includes("B:{name:'연속베기',continuousSlashChance:.10,continuousSlashRatio:.5"));
  assert.ok(html.includes("engineAdapter.random()<(metal.continuousSlashChance??1)"), 'Continuous Slash must use the shared seeded RNG at its configured chance');
  assert.ok(html.includes("opponents.find(unit=>unit!==defender)||opponents.find(unit=>unit===defender)"), 'Continuous Slash must prefer a different champion and fall back to the original target');
  assert.ok(html.includes("{ratio:metal.continuousSlashRatio,noCounter:true,continuousSlash:true}"), 'The follow-up slash must deal reduced damage without causing a second counterattack');
  assert.ok(html.includes('if(options.noCounter)return'), 'Combat must support a counter-free awakening follow-up');
  assert.ok(html.includes("A:{name:'암반 피부',chance:.12,damageReduction:1,minCost:4"));
  assert.ok(html.includes("B:{name:'절대방어',chance:.012,avoidDamage:true"));
  assert.ok(html.includes("eligibleCost=Number(target.dataset.cost||0)>=(earth.minCost||0)"), 'Rock skin must enforce its cost eligibility in combat');
  assert.ok(!html.includes('GUARDIAN_AWAKEN_DURATION=1'), 'Persistent awakening must not retain the old one-turn duration');
  assert.ok(html.includes('left:var(--field-left);top:var(--field-top);width:var(--field-width);height:var(--field-height)'), 'Awakening choices must be constrained to the battlefield');
  assert.ok(html.includes('.awaken-field-sigil{position:absolute'), 'The selected aura sigil must be engraved inside its card lane');
  assert.ok(html.includes("GUARDIANS[id].sigil"), 'Each field engraving must use that side selected aura asset');
  assert.ok(html.includes("sigil.className='awaken-field-sigil engraving'"), 'The field sigil must enter with an engraving animation');
  assert.ok(html.includes('@keyframes awaken-field-sigil-engrave'), 'The engraving animation must stamp the aura into field center');
  assert.ok(html.includes("typeSkillTitle(fx.querySelector('.gdx-title'),g.name+' · 각성')"), 'Awakening title must not repeat the aura word');
  assert.ok(html.includes("chooseEnemyGuardianAwakening()"), 'The enemy must choose an awakening after crossing 70 HP');
  assert.ok(html.includes("syncLaneSigil('enemy',enemyGuardian,arena.querySelector('.lane:first-child'))"), 'Enemy awakening must engrave its aura under the enemy card lane');
  assert.ok(html.includes("syncLaneSigil('player',playerGuardian,arena.querySelector('.lane:nth-child(2)'))"), 'Player awakening must engrave its aura under the player card lane');
  assert.ok(html.includes("arena.classList.add('guardian-awakened','guardian-awakened-'+playerGuardian)"), 'Awakening must add a guardian-specific field aura');
  assert.ok(html.includes('.arena.guardian-awakened.guardian-awakened-cheongryong'), 'Guardian field aura must provide guardian-specific colors');
  assert.ok(html.includes("if(!playerGuardian)return '성격 오라 필요'"), 'No-aura mode must not receive an aura awakening');
  assert.ok(html.includes("fieldGuardianUltimate.id='field-guardian-ultimate'"), 'Guardian awakening must render beside the field ultimate condition');
  assert.ok(html.includes('.arena.guardian-awakened.guardian-awakened-namu'), 'Wood awakening must have its own field aura color');
  assert.ok(html.includes("showAwakeningProc(side,'jujak',label,turns+'턴간 턴 시작마다 피해 '+damage,target)"), 'Fire awakening must visibly announce damage and duration');
  assert.ok(html.includes("guardianOfSide(defenderSide)==='jujak')applyAuraBurn(defenderSide,attacker)"), 'Fire aura must also roll burn from mutual-damage counters');
  assert.ok(html.includes("className='aura-burn-vfx'"));
  assert.ok(html.includes("className='aura-burn-badge'"));
  assert.ok(html.includes("delete target.dataset.auraBurnTurns"), 'Burn duration must clear after expiry or cleanse');
  assert.ok(html.includes("unit.dataset[eternal?'eternalBurnTurns':'auraBurnTurns']=String(remaining)"), 'Burn duration must count down once per owner turn, including eternal black flame');
  assert.ok(html.includes("showAwakeningProc('player','cheongryong',name,'마나 +'+gain"), 'Water awakening must visibly announce recovered mana');
  assert.ok(html.includes("showAwakeningProc(side,'namu',config.name||'나무의 오라'"), 'Wood awakening must visibly announce health growth');
  assert.ok(html.includes("showAwakeningProc(side,'baekho',config.name||'생존 경험'"), 'Metal awakening must announce attack growth');
  assert.ok(html.includes("showAwakeningProc(side,'hyeonmu','암반 피부'"), 'Rock Skin must visibly announce damage reduction');
  assert.ok(html.includes("showAwakeningProc(side,'hyeonmu','절대방어'"), 'Absolute Defense must visibly announce damage nullification');
});

test('경제: 기권은 패배로 처리하되 성격 오라 선택에 따른 별도 재화 차감은 없다', () => {
  const surrender = html.slice(html.indexOf('function surrenderBattle('), html.indexOf('function finish('));
  assert.ok(surrender.includes("showBattleResult(false,'기권했습니다. 기권은 패배로 계산됩니다.')"), 'Surrender must show the shared defeat and tier result');
  assert.ok(surrender.includes('settleRank(false)'), 'Surrender must settle as a defeat');
  assert.ok(!html.includes('setTimeout(restartBattleToAuraSelect,1600)'), 'A surrender must wait for the replay choice');
  assert.ok(html.includes("next.searchParams.delete('guardian')") && html.includes("next.searchParams.delete('skipIntro')"), 'A new battle must clear QA options that bypass aura selection');
  assert.ok(!surrender.includes('animateCrackerTransfer'), 'Surrender must not run its own cracker transfer');
  assert.ok(!html.includes('if(!win&&(challengeMode||forfeit))'), 'Guardian choice and surrender must not add a defeat currency penalty');
});

test('오라 선택: 오라 미선택 경로를 제공하지 않는다', () => {
  assert.ok(!html.includes("id==='none'"), 'Aura selection must not accept a no-aura value');
  assert.ok(!html.includes("preset==='none'"), 'Development preset must not restore a no-aura mode');
  assert.ok(!html.includes('challengeMode'), 'Removed no-aura mode must not remain in runtime state');
});

test('보안: 크래커/오라 URL 옵션은 개발 환경에서만 동작한다', () => {
  assert.ok(html.includes("const DEV_MODE = ['localhost','127.0.0.1','[::1]',''].includes(location.hostname);"), 'DEV_MODE must be derived from the host');
  assert.ok(html.includes("requested=DEV_MODE?params.get('crackers'):null"), '?crackers must be gated by DEV_MODE');
  assert.ok(html.includes("preset=DEV_MODE?params.get('guardian'):null"), '?guardian must be gated by DEV_MODE');
});

test('공개 목업: 상점·소환 시연은 체험 재화 부족으로 막히지 않는다', () => {
  assert.ok(html.includes('const DEMO_CRACKER_FLOOR=1000000,DEMO_COOKIE_FLOOR=50000;'), 'The public demo must have generous named currency floors');
  assert.ok(html.includes('if(collectionState.crackers<DEMO_CRACKER_FLOOR)'), 'Crackers must be topped up on every demo host');
  assert.ok(html.includes('if(collectionState.cookieFragments<DEMO_COOKIE_FLOOR)'), 'Cookie fragments must be topped up on every demo host');
});

test('강화 슬롯: 카드를 선택하면 비행·점등 장착 연출을 재생한다', () => {
  assert.ok(html.includes('function animateEnhancementEquip(index,from)'), 'Enhancement selection needs a named equip animation');
  assert.ok(html.includes("className='enhance-equip-fly'"), 'The selected card must fly to the enhancement slot');
  assert.ok(html.includes("slot.classList.add('enh-equip-land')"), 'The enhancement slot must react when the card lands');
  assert.ok(html.includes("onclick=\"selectEnhancement('+index+',this)\""), 'A regular click must provide the source card to the animation');
});

test('핵심가치: 상점 획득은 캐릭터별 어필 영상과 다시 보기를 제공한다', () => {
  assert.ok(html.includes('function showCharacterAppeal(index'), 'Character acquisition needs a named appeal sequence');
  assert.ok(html.includes('CHARACTER ENCOUNTER'), 'The shop reveal must identify the character encounter');
  assert.ok(html.includes('획득 어필 영상 다시 보기'), 'Owned character results must allow replaying the appeal');
  assert.ok(html.includes("if(collectionIsSpell[index])return"), 'Magic and traps must not be treated as character videos');
});

test('전투 결과는 티어 현황과 다시 하기 선택을 제공한다', () => {
  assert.ok(html.includes('캐릭터 체험전 · 오라 역전'), 'Battle chrome must emphasize the character and aura experience');
  assert.ok(html.includes('이전 티어') && html.includes('현재 티어'), 'Result alert must show tier movement');
  assert.ok(html.includes('한 판 더 플레이하시겠습니까?'), 'Result alert must ask whether to replay');
  assert.ok(!html.includes("openCollection('codex');},2000)"), 'Result alert must not open the codex automatically');
});

test('핵심가치: 도감은 캐릭터별 4차 강화 완결 진척을 보여준다', () => {
  assert.ok(html.includes('function highestEnhancementLevel(index)'), 'Codex needs enhancement progress per character');
  assert.ok(html.includes('캐릭터 완결'), 'Codex summary must prioritize completed characters');
  assert.ok(html.includes('강화 목표 이어가기'), 'Codex detail must continue into enhancement');
});

test('PRD: 카드 소환 가격은 1회 200, 10회 2,000이다', () => {
  assert.ok(html.includes('const GACHA_SINGLE_COST=200,GACHA_TEN_COST=2000,COOKIE_SINGLE_COST=10,COOKIE_TEN_COST=100;'), 'Gacha costs must use named PRD values');
  assert.ok(html.includes('count===10?GACHA_TEN_COST:GACHA_SINGLE_COST'), 'Pull settlement must use the PRD costs');
});

test('PRD: 카드 뽑기는 전체 카드 풀·10회 보장·51번째 전설 보장을 적용한다', () => {
  assert.ok(html.includes("forceRare?(roll<.10?'legendary':'rare')"), 'Guaranteed slot must be 90% rare and 10% legendary');
  assert.ok(html.includes('Number(collectionState.legendaryMisses||0)>=50'), 'The 51st consecutive miss must force a legendary');
  assert.ok(html.includes('collectionState.legendaryMisses=isLegendary?0:'), 'A legendary result must reset the miss counter');
  assert.ok(html.includes('챔프·마법·함정 카드를 획득합니다.'), 'The shop must disclose the complete card pool');
});

test('PRD: 합성은 서로 다른 카드와 같은 카드 중복을 모두 허용한다', () => {
  assert.ok(html.includes('const SYNTH_BASE_CHANCE=[0,10,18,25,31,36,40,43,46,48],SYNTH_MAX_CHANCE=48,SYNTH_MAX_MATERIALS=9;'), 'PRD 1.26: materials 2~9 (3x3), 9 materials = 48%, final cap 48%');
  assert.ok(html.includes('Math.min(SYNTH_MAX_CHANCE,(SYNTH_BASE_CHANCE[count]||0)+synthFailureStreak*5)'), 'Failure compensation must add 5%p and cap at SYNTH_MAX_CHANCE (48%)');
  assert.ok(html.includes('grid-template-columns:repeat(3,minmax(0,1fr))/* 3×3 = 재료 9칸'), 'Synthesis material slots must be a 3x3 grid');
  assert.ok(html.includes('const slots=[...synthSlots],count=slots.length,used=new Map()'), 'A synthesis attempt must aggregate mixed materials');
  assert.ok(html.includes('used.forEach((amount,index)=>collectionState.owned[index]-=amount)'), 'Materials must be consumed regardless of success');
});

test('PRD: 강화는 0~4차, 재료 3장, 단계별 50%·45%·40%·35%를 적용한다', () => {
  assert.ok(html.includes("const ENHANCE_MATERIAL_COUNT=3,ENHANCE_RULES={0:{chance:50,label:'0차 → 1차',attackMax:1,healthMax:0},1:{chance:45,label:'1차 → 2차',attackMax:2,healthMax:0},2:{chance:40,label:'2차 → 3차',attackMax:2,healthMax:1},3:{chance:35,label:'3차 → 4차',attackMax:2,healthMax:2}}"), 'Enhancement stages and chances must match the PRD');
  assert.ok(html.includes('enhancementCount(index,level)<ENHANCE_MATERIAL_COUNT'), 'An enhancement attempt must require three matching-stage cards');
  assert.ok(html.includes('collectionState.owned[index]-=ENHANCE_MATERIAL_COUNT-1'), 'Three input cards must consume two and leave one result card');
  assert.ok(html.includes('return roll<60?0:roll<90?1:2'), 'A +0~2 bonus must use the 60%·30%·10% distribution');
  assert.ok(html.includes('if(max===1)return roll<60?0:1'), 'A +0~1 bonus must use the 60%·40% distribution');
});

test('쿠키조각은 젠돈·게임 승리에서 얻어 카드 뽑기에 직접 쓰는 공통 재화다', () => {
  assert.ok(html.includes("window.grantCookieFragmentsFromGenerateDone"), 'Generate-done integration must grant cookie fragments');
  assert.ok(html.includes('VICTORY_COOKIE_REWARD=10'), 'A valid game win must grant the prototype cookie reward');
  assert.ok(html.includes("pullCards(1,'cookie')"), 'The shop must spend cookie fragments directly on card pulls');
  assert.ok(html.includes('cookieRewardEvents'), 'Reward event IDs must be stored for duplicate prevention');
  assert.ok(html.includes('부족한 카드 얻기 · 크래커 / 쿠키조각 뽑기'), 'Enhancement must link back to both direct pull currencies');
  assert.ok(!html.includes('작품 쿠키조각 교환소'), 'The removed work-bound exchange must not remain');
});

test('PvC 승리는 상대 재화를 갈취하지 않고 고정 클리어 보상을 지급한다', () => {
  assert.ok(html.includes('const PVC_CLEAR_CRACKER_REWARD=200'));
  assert.ok(html.includes("collectionState.crackers=(collectionState.crackers||0)+PVC_CLEAR_CRACKER_REWARD"));
  assert.ok(html.includes('PvC 클리어 보상으로 크래커'));
  assert.ok(!html.includes('enemyCrackers'));
  assert.ok(!html.includes('VICTORY_STEAL'));
  assert.ok(!html.includes('const stolen='));
  assert.ok(!html.includes('크래커 200</div>'), '상대 HUD에 재화를 표시하지 않아야 한다');
});

test('궁극기: 피해·버프 이펙트는 컷씬·오버레이가 끝난 뒤에 적용한다', () => {
  assert.ok(html.includes('ULTIMATE_EFFECT_DELAY=ULTIMATE_OVERLAY_MS+30'), 'Effect delay must exceed the overlay duration');
  assert.ok(html.includes('},ULTIMATE_EFFECT_DELAY);setTimeout(()=>overlay.remove(),ULTIMATE_OVERLAY_MS);'), 'Effects must be scheduled with the named delay, not a fixed 900ms');
});

test('궁극기: 사용 가능 턴·재사용 대기·강한 카드 분류가 없고, 비용은 발동 시점의 최대 마나다', () => {
  for (const gone of ['ULTIMATE_BASE_MIN_TURN', 'ULTIMATE_STRONG_TURN_DELAY', 'ULTIMATE_COOLDOWN_TURNS', 'AURA_ULTIMATE_COOLDOWN_REDUCTION', 'AURA_ULTIMATE_TURN_REDUCTION', 'ULTIMATE_RESET_TURNS', 'strong=baseCost>=5']) {
    assert.ok(!html.includes(gone), `${gone}: 폐지된 규칙이 남아 있다`);
  }
  assert.ok(html.includes('function ultimateManaCost(spec){return spec?Math.max(1,maxMana-(auraUltimateMatch(spec)?ULTIMATE_RESONANCE_COST:0)):0;}'), '비용 = 최대 마나, 오라 공명이면 −2');
  assert.ok(html.includes('ULTIMATE_RESONANCE_COST=2') && html.includes('ULTIMATE_RESONANCE_STAT=2'), '오라 공명: 비용 −2, 소진자 공격 +2 · 체력 +2');
  /* 혈마나 궁극기는 2026-11-07 제거했고, 게임 규칙으로 금지다 — 체력으로 궁극기의 마나를 대신할 수 없다.
     이름을 바꿔 되살아나도 잡히도록 식별자가 아니라 불변식을 본다. */
  assert.ok(!html.includes('ultimateBloodOverride') && !html.includes('fireBloodUltimate'), '혈마나 궁극기 우회 경로를 되살리지 말 것');
  assert.ok(html.includes("if(mana<cost)return '마나 '+cost+' 필요'"), '궁극기는 마나가 모자라면 그대로 막혀야 한다 (혈마나 대납 금지)');
  {
    /* activateUltimate 은 일반 마나만 차감한다. 체력을 깎는 코드가 섞이면 혈마나 대납이다. */
    const fn = html.slice(html.indexOf('function activateUltimate()'));
    const body = fn.slice(0, fn.indexOf('sendUltimateToGraveyard'));
    assert.ok(body.includes('mana-=cost'), '궁극기 비용은 일반 마나에서만 나간다');
    assert.ok(!/playerHp\s*-=/.test(body), '궁극기 발동이 영웅 체력을 지불하면 안 된다');
    assert.ok(!/bloodMana/i.test(body), '궁극기 발동 경로에 혈마나가 끼어들면 안 된다');
  }
  {
    /* 잠금 사유 판정에도 체력으로 푸는 예외가 없어야 한다. */
    const fn = html.slice(html.indexOf('function ultimateLockReason()'));
    const body = fn.slice(0, fn.indexOf('function armUltimateSetting'));
    assert.ok(!/playerHp/.test(body), '궁극기 잠금 판정이 영웅 체력을 조건으로 쓰면 안 된다');
  }
});

test('궁극기: 맨 오른쪽 아군을 제물로 순서 고정·전역 도발 소진자(기본 공격력 +15 / 체력 1)를 즉시 공격 가능하게 배치한다', () => {
  assert.ok(!html.includes("if(fieldCount>=FIELD_CARD_LIMIT)return '내 전장 6장 · 궁극기 사용 불가'"));
  assert.ok(html.includes("if(fieldCount<1)return '제물로 삼을 아군 챔프 필요'"));
  assert.ok(html.includes("ULTIMATE_SPENT_ATTACK_BONUS=15,ULTIMATE_SPENT_HP=1"));
  assert.ok(html.includes("attack:(Number(spec.baseAttack)||0)+ULTIMATE_SPENT_ATTACK_BONUS+bonus,hp:ULTIMATE_SPENT_HP+bonus"), '소진자 = 카드 기본 공격력 +15 / 체력 1 (공명 +2/+2)');
  assert.ok(html.includes("summonBattleToken(spec.name,stats.attack,stats.hp,spec.element,'ultimate-spent')"));
  assert.ok(html.includes("unit.dataset.ultimateSpent='true'"));
  assert.ok(html.includes("unit.dataset.rush='true';unit.classList.remove('exhausted');unit.querySelector('.emoji').innerHTML"), '내려놓은 즉시 공격할 수 있다');
  assert.ok(html.includes('.unit[data-effect="ultimate-spent"]{scale:1.1'), '소진자는 110% 크기');
  assert.ok(html.includes("unit.dataset.ultimateAggro='true'"));
  assert.ok(html.includes("unit.dataset.orderLocked='true'"));
  assert.ok(html.includes("unit.draggable=battlePhase==='setup'&&!locked"));
  assert.ok(html.includes("unit.dataset.orderLocked==='true'"));
  assert.ok(html.includes("target?.dataset.orderLocked==='true'"));
  assert.ok(html.includes("if(locked&&summonDropZone.lastElementChild!==locked)summonDropZone.append(locked)"));
  assert.ok(html.includes("const ultimateAggro=targets.find(u=>u.dataset.ultimateAggro==='true');if(ultimateAggro){showUltimateAggroIntercept(ultimateAggro);return ultimateAggro;}"));
  assert.ok(html.includes('.unit[data-ultimate-aggro="true"]::after{content:none!important;display:none!important}'), '전역 도발 텍스트 배지는 카드 경계 밖으로 노출되면 안 된다');
  assert.ok(!html.includes('1/1 · 전역 도발') && !html.includes('공격력 1 · 체력 1의'), '소진자가 1/1이라는 옛 문구가 남아 있다');
});

test('궁극기 소진 카드가 죽을 때마다 복수의 중앙 확대·분할 소멸 연출을 재생한다', () => {
  assert.ok(html.includes('function showUltimateSpentDeath(unit)'));
  assert.ok(html.includes("target.dataset.ultimateSpent==='true')showUltimateSpentDeath(target)"));
  assert.ok(html.includes("unit.dataset.ultimateSpent!=='true'"));
  assert.ok(html.includes("unit.dataset.ultimateDeathFx==='true'"));
  assert.ok(html.includes('spent-death-half left'));
  assert.ok(html.includes('spent-death-half right'));
  assert.ok(html.includes('<strong>복수의 시작</strong><b></b>'), '연출 제목과 소진자 이름은 별도 행이어야 한다');
  assert.ok(html.includes("fx.querySelector('.spent-death-copy b').textContent=name"), '소진자 이름은 독립된 이름 행에 표시해야 한다');
  assert.ok(html.includes('소진자의 죽음이 복수를 부릅니다'));
  assert.ok(!html.includes('단 한 번의 복수'), '복수는 궁극기마다 생기므로 최초 한정 문구는 지운다');
  assert.ok(html.includes('performance.now()+4050'));
  assert.ok(html.includes('@keyframes spent-half-left'));
  assert.ok(html.includes('@keyframes spent-half-right'));
});

test('복수자: 궁극기마다 소진자 기본 능력치 +7/+15 로 강림하고 외형은 대전 덱 구성에서 무작위로 빌린다', () => {
  assert.ok(html.includes('AVENGER_ATTACK_BONUS=7,AVENGER_HP_BONUS=15'));
  assert.ok(html.includes('function pickAvengerAppearance(side,rec)'));
  assert.ok(html.includes("collectionState.deck.map(deckEntry):enemyOriginalDeck"), '내 덱 구성 / 컴퓨터 원래 덱 리스트에서 고른다');
  assert.ok(html.includes('pool=source.filter(card=>!card.spell&&card.art)'), '오라 구분 없이 챔프 카드 한 장');
  assert.ok(html.includes("attack=rec.baseAttack+AVENGER_ATTACK_BONUS,hp=rec.baseHp+AVENGER_HP_BONUS"), '능력치는 소진자 원래(강화 전) 능력치 기준');
  assert.ok(html.includes("summonBattleToken(partner.name,attack,hp,partner.el,'ultimate-avenger')"));
  assert.ok(html.includes("if(units.length>=FIELD_CARD_LIMIT){const replace=units.at(-1);"), '전장이 가득 차면 기존 챔프 1장을 교체해 강림한다');
  assert.ok(html.includes('function showAvengerArrival(partner,source,unit)'));
  assert.ok(html.includes("source.name+'의 복수를 하고 말겠어!'"));
  assert.ok(html.includes('AVENGER DESCENT'));
  assert.ok(html.includes('function showAvengerLandingImpact(unit,color)'));
  assert.ok(html.includes('showAvengerLandingImpact(unit,colors[partner.el]||colors.neutral)'));
  assert.ok(html.includes('.unit[data-effect="ultimate-avenger"]'), '복수자 카드만 전용 테두리와 오라를 사용해야 한다');
  assert.ok(html.includes('.arena .unit[data-effect="ultimate-avenger"]>h4'), '복수자도 기존 카드 이름 영역을 유지해야 한다');
  assert.ok(html.includes('z-index:6;scale:1.1;border:3px solid var(--avenger-accent)'), '복수자는 전장에서 10% 확대하고 오라색 굵은 테두리를 사용해야 한다');
  assert.equal(html.includes('avenger-crown-vfx'), false, '복수자 카드에 왕관 장식을 다시 붙이면 안 된다');
  assert.equal(html.includes('decorateAvengerUnit'), false, '왕관 장식용 DOM 로직을 다시 사용하면 안 된다');
  assert.equal(html.includes('crown-body'), false, 'CSS 도형 왕관을 다시 사용하면 안 된다');
  assert.ok(html.includes("wave.className='avenger-landing-impact'"));
  assert.ok(html.includes("arena?.animate([{transform:'none'},{transform:'translateY(13px) scale(.985)'"));
  assert.ok(!html.includes('damageUnit(target,5,partner.el)'), '강림 시 상대 전장 5 피해는 폐지됐다');
  for (const gone of ['firstUltimateSpec', 'firstUltimateCompanion', 'avengerSummoned', 'matchEnemyUltimateCompanion', 'seedAvengerFromLatestFallenUltimate']) {
    assert.ok(!html.includes(gone), `${gone}: 최초 궁극기·같은 오라 동료·배틀당 1회 규칙은 폐지됐다`);
  }
});

test('궁극기: 속성별 전장·체력·성격 조합 조건 없이 역전 수단으로 사용할 수 있다', () => {
  assert.ok(html.includes("condition:'추가 조건 없음'"));
  assert.ok(html.includes('function ultimateCondition(){return true;}'));
  assert.ok(html.includes('function enemyUltimateCondition(){return true;}'));
  assert.ok(!html.includes("return new Set(allies.map(getElement)).size>=3"));
});

test('손패: 사용 가능 여부 우선, 같은 등급 안에서는 가치(비용>공격력>체력) 높은 카드가 위', () => {
  assert.ok(html.includes('Number(a.dataset.usabilityRank)-Number(b.dataset.usabilityRank)||handCardValue(b)-handCardValue(a)'), 'Hand sort must rank usability first, then card value');
  assert.ok(html.includes('function handCardValue(card)'), 'Card value must be a named helper');
});

test('복수자가 두 번째로 등장한 뒤부터 내 턴 시작에 덱에서 카드를 1장 더 받는다 (최후의 저항 추가 드로우는 폐지)', () => {
  assert.ok(!html.includes('최후의 저항: 내 턴 시작에 덱에서 1장 더 받는다'), '체력 40 이하 추가 드로우는 폐지됐다');
  assert.ok(html.includes('AVENGER_EXTRA_DRAW_AT=2'));
  assert.ok(html.includes("if(avengerExtraDrawActive('player')&&deck.length&&document.querySelectorAll('.hand .card').length<8){drawCard();"), 'Extra draw must respect deck and hand limits');
  assert.ok(html.includes('function avengerExtraDrawActive(side){return ultimateLedger[side].arrived>=AVENGER_EXTRA_DRAW_AT;}'));
  assert.ok(html.includes("advanceUltimateLedger('player');"), '내 턴 시작에 복수자 시계가 흐른다');
});

test('영웅 본체 회복은 체력 수준과 무관하게 항상 가능하다 (회복 잠금 폐지)', () => {
  assert.ok(html.includes('function healPlayerHero(amount){const requested=Math.max(0,Number(amount)||0);if(!requested)return 0;const healed=Math.min(requested,HERO_MAX_HP-playerHp);'));
  assert.ok(html.includes('heroHealed=healPlayerHero(amount)'));
  assert.ok(html.includes('healed=healPlayerHero(8)'));
  assert.ok(html.includes('heroHealed=healPlayerHero(6)'));
  assert.ok(html.includes('healed=healPlayerHero(heal)'));
  assert.ok(html.includes('if(refund.hp){ playerHp = Math.min(HERO_MAX_HP'));
  assert.ok(!html.includes('HealingLocked') && !html.includes('healingLocked'));
});

test('최후의 저항: 마법카드 즉시 발동 보상은 제거하고 기존 세팅 규칙을 유지한다', () => {
  assert.ok(!html.includes('desperateQuickCast'));
  assert.ok(!html.includes('quick-cast-badge'));
  assert.ok(!html.includes('if(quickCast)'));
  assert.ok(html.includes("if(isTrap||isSpell){setMagic(card);}"));
});
