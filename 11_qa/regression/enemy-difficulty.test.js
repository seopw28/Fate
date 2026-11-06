const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require('node:path').resolve(__dirname, '../../dist/index.html'), 'utf8');

test('컴퓨터 난이도는 초보자·나이트메어·헬 3단계다', () => {
  assert.ok(html.includes("normal:{label:'초보자',mistakeRate:.35,searchDepth:0}"));
  assert.ok(html.includes("nightmare:{label:'나이트메어',mistakeRate:.10,searchDepth:1}"));
  assert.ok(html.includes("hell:{label:'헬',mistakeRate:0,searchDepth:2}"));
  assert.ok(!html.includes('35% 확률로 차선 선택'), '내부 AI 로직을 노출하지 않아야 한다');
});

test('난이도는 유저가 고르지 않고 티어 실력에 맞춰 자동 결정된다', () => {
  assert.ok(!html.includes('difficulty-select'), '난이도 선택 화면이 남아 있으면 안 된다');
  assert.ok(!html.includes('function openDifficultySelect'));
  assert.ok(!html.includes('예상 승률'), '승률 선택 카드가 남아 있으면 안 된다');
  assert.ok(html.includes('function matchEnemyDifficulty()'));
  assert.ok(html.includes("const DIFFICULTY_LADDER=['normal','nightmare','hell']"));
  assert.ok(html.includes('function applyMatchedDifficulty()'));
  assert.ok(html.includes('function applyEnemyDifficulty(key)'));
  assert.ok(html.includes('openGuardianSelect()'), '난이도 적용 후 바로 오라 선택으로 넘어가야 한다');
});

test('배치 전에는 초보자로 시작하고 티어·최근 전적으로 단계를 조정한다', () => {
  assert.ok(html.includes("if(rankState.placementPlayed<5)return 'normal'"));
  assert.ok(html.includes('let step=score>=800?2:score>=600?1:0'));
  assert.ok(html.includes('if(wins===recent.length)step=Math.min(2,step+1)'));
  assert.ok(html.includes('else if(wins===0)step=Math.max(0,step-1)'));
});

test('난이도는 자원 보정 없이 판단력과 실수율로만 구분된다', () => {
  assert.ok(html.includes('enemyMana=ENEMY_AI.manaMirrorsPlayer?Math.min(MANA_CAP,maxMana)'));
  assert.ok(html.includes("if(enemyDifficulty==='normal')return targets[Math.floor(engineAdapter.random()*targets.length)]"));
  assert.ok(html.includes("if(enemyDifficulty==='hell')writeLog('<strong>헬 AI 판단:"));
  assert.ok(html.includes("enemyDifficulty==='normal'?(engineAdapter.random()<.5?'A':'B'):tactical[enemyGuardian]"));
  assert.ok(html.includes("unit.classList.add('exhausted')"), '상대도 소환한 턴에는 공격하지 않아야 한다');
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
