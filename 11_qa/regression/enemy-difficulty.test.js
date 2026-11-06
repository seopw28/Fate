const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require('node:path').resolve(__dirname, '../../dist/index.html'), 'utf8');

test('컴퓨터 난이도는 초보자·나이트메어·헬 3단계다', () => {
  assert.ok(html.includes("normal:{label:'초보자',mistakeRate:.35,searchDepth:0}"));
  assert.ok(html.includes("nightmare:{label:'나이트메어',mistakeRate:.10,searchDepth:1}"));
  assert.ok(html.includes("hell:{label:'헬',mistakeRate:0,searchDepth:2}"));
  assert.ok(html.includes("data-difficulty=\"'+key+'\""), '전투 전에 난이도 선택 버튼을 표시해야 한다');
  assert.ok(html.includes("['normal','초보자','설명과 함께 천천히','72%'"));
  assert.ok(html.includes("['nightmare','나이트메어','전술 대응','24%'"));
  assert.ok(html.includes("['hell','헬','최선수 탐색','4%'"));
  assert.ok(html.includes('<small>예상 승률</small>'));
  assert.ok(!html.includes('35% 확률로 차선 선택'), '내부 AI 로직을 난이도 카드에 노출하지 않아야 한다');
});

test('초보자 난이도는 설명을 기본으로 켜고 상단 토글로 제어한다', () => {
  assert.ok(html.includes("beginnerHelpEnabled=key==='normal'"));
  assert.ok(html.includes("document.querySelector('.top-actions')?.prepend(toggle)"));
  assert.ok(html.includes('function toggleBeginnerHelp'));
  assert.ok(html.includes("overview.className='beginner-overview'"));
  for (const label of ['남은 마나 확인', '비용이 낮은 챔프 선택', '준비가 끝나면 턴 종료']) assert.ok(html.includes(label));
});

test('난이도 선택지는 가로 카드열이 아닌 세로 3단 선택 박스다', () => {
  assert.ok(html.includes('.difficulty-options{width:min(820px,100%);margin:0 auto;grid-template-columns:minmax(0,1fr)'));
  assert.ok(html.includes('.difficulty-card{display:grid;grid-template-columns:minmax(150px,1fr) minmax(190px,1.5fr) 120px'));
});

test('난이도는 자원 보정 없이 판단력과 실수율로만 구분된다', () => {
  assert.ok(html.includes('enemyMana=ENEMY_AI.manaMirrorsPlayer?Math.min(MANA_CAP,maxMana)'));
  assert.ok(html.includes("if(enemyDifficulty==='normal')return targets[Math.floor(engineAdapter.random()*targets.length)]"));
  assert.ok(html.includes("if(enemyDifficulty==='hell')writeLog('<strong>헬 AI 판단:"));
  assert.ok(html.includes("enemyDifficulty==='normal'?(engineAdapter.random()<.5?'A':'B'):tactical[enemyGuardian]"));
  assert.ok(html.includes("unit.classList.add('exhausted')"), '상대도 소환한 턴에는 공격하지 않아야 한다');
  assert.ok(html.includes("document.querySelector('#enemy-difficulty').textContent=config.label"));
  assert.ok(!html.includes('manaOffset'));
  assert.ok(!html.includes('aChance'));
  assert.ok(!html.includes('difficultyDamageMultiplier'));
});

test('상대도 챔프 능력·마법·함정·궁극기를 같은 자원 규칙으로 사용한다', () => {
  assert.ok(html.includes('function triggerEnemyBattlecry(unit,data)'));
  assert.ok(html.includes('function resolveEnemySpell(card)'));
  assert.ok(html.includes('function triggerEnemyTrap(event,context={})'));
  assert.ok(html.includes('function castEnemyUltimate()'));
  assert.ok(html.includes("enemyMana-=card.cost;enemySetMagic.push"));
  assert.ok(html.includes('turnNumber<spec.minTurn||enemyMana<spec.cost'));
  assert.ok(html.includes('turnNumber<enemyLastUltimateTurn+cooldown'));
  assert.ok(html.includes("triggerEnemyTrap('player_summon',{unit})"));
  assert.ok(html.includes("triggerEnemyTrap('enemy_hero_attacked',{attacker:selected,damage})"));
});

test('상대 필드가 비어 있으면 마법·궁극기보다 챔피언 소환을 우선한다', () => {
  assert.ok(html.includes('function summonEnemyPriorityChampion(lane)'));
  assert.ok(html.includes("if(lane.querySelector(':scope > .unit:not([data-destroyed=\"true\"])'))return false"));
  const turn = html.slice(html.indexOf('function enemyTurn(){'), html.indexOf('function selectUnit('));
  assert.ok(turn.indexOf('summonEnemyPriorityChampion(lane)') < turn.indexOf('equipEnemyUltimate()'));
  assert.ok(turn.indexOf('summonEnemyPriorityChampion(lane)') < turn.indexOf('setEnemyMagic()'));
});
