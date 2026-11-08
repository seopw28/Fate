const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');

/* 2026-11-08 PM 결정: 카드 뽑기·뒷면·전장 배경은 크래커로만, 쿠키조각은 강화·합성·시크릿 블록 열기에만 쓴다.
   수치는 임시값이라 상수 한 곳에 모으고, 번들 문자열로 구조를 고정한다. 동작은 마지막 테스트가 브라우저 검사로 확인한다. */

test('임시 수치는 상수 한 곳에 모여 있다(쿠키조각 10·10·50, 크래커 뒷면 1,000·배경 1,500)', () => {
  assert.ok(html.includes('const COOKIE_COST={enhance:10,synth:10,secret:50};'));
  assert.ok(html.includes('const SKIN_PRICE={back:1000,field:1500};'));
});

test('카드 뽑기는 크래커로만 한다: 쿠키조각 뽑기 상수·버튼·분기가 없다', () => {
  assert.ok(!html.includes('COOKIE_SINGLE_COST') && !html.includes('COOKIE_TEN_COST'));
  assert.ok(!html.includes("data-currency=\"cookie\"") && !html.includes('cookie-pull') && !html.includes('보상 뽑기'));
  assert.ok(html.includes('function pullCards(count){'));
  assert.ok(html.includes('collectionState.crackers-=cost;'));
});

test('쿠키조각은 강화·합성 1회 시도와 시크릿 블록 열기에서만 나간다', () => {
  assert.equal((html.match(/spendCookie\('/g) || []).length, 3, 'spendCookie 호출은 강화·합성·시크릿 블록 세 곳뿐이다');
  for (const kind of ['enhance', 'synth', 'secret']) assert.ok(html.includes(`spendCookie('${kind}')`), kind);
  assert.ok(!/collectionState\.cookieFragments-=/.test(html), '쿠키조각을 직접 깎는 곳은 spendCookie 하나뿐이다');
  assert.ok(html.includes('VICTORY_COOKIE_REWARD=10'), '쿠키조각 획득 경로(대전 승리)는 그대로다');
});

test('시크릿 블록: 승리하면 열 수 있음 상태만 기록하고, 열기는 쿠키조각을 내야 한다', () => {
  assert.ok(html.includes('state.ready[p.cardId]={at:new Date().toISOString(),avenger:p.avenger}'));
  assert.ok(!html.includes('state.unlocked[p.cardId]={at:new Date().toISOString(),avenger:p.avenger}'), '승리 정산이 바로 열면 안 된다');
  assert.ok(html.includes("window.openSecretBlock=function(cardId){"));
  assert.ok(html.includes('class="secret-open"'));
  assert.ok(html.includes('열 수 있음'));
});

test('상점: 카드 뽑기 / 꾸미기 하위 탭, 꾸미기 안에서 전장 배경과 카드 뒷면을 고른다', () => {
  for (const token of ['data-shop="pull"', 'data-shop="cosmetic"', 'id="skin-grid"', 'data-slot="field"', 'data-slot="back"', '전장 배경', '카드 뒷면']) assert.ok(html.includes(token), token);
  assert.ok(html.includes('function buySkin(id)') && html.includes('function applySkin(id)'));
});

test('스킨 라인업: 기본 무료 보유 + 불·물·나무·금속·대지 세트 5종, 배경은 필드(.arena)에만 적용한다', () => {
  assert.ok(html.includes("const SKIN_AURAS=['fire','water','wood','metal','earth']"));
  assert.ok(html.includes("owned:['back.default','field.default']"));
  assert.ok(html.includes('.arena[data-field-skin]'));
  assert.ok(html.includes('.card-back-design[data-skin]'));
});

test('저장 v11: 스킨·쿠키조각 잔액을 이어받고 덱 초기화는 version<10 에만 묶여 있다', () => {
  assert.ok(html.includes('{version:11,crackers:Math.max(0,Number(saved.crackers)||0),cookieFragments:Math.max(0,Number(saved.cookieFragments)||0)'));
  assert.ok(html.includes('skins:normalizeSkinState(saved.skins)'));
  assert.ok(html.includes('deckReset=Number(saved.version)<10'));
});

test('컴퓨터 상대는 판마다 무작위 뒷면을 상대 손패·덱 더미에 쓴다(보유 여부 무관)', () => {
  assert.ok(html.includes('const ENEMY_BACK_SKIN='));
  assert.ok(html.includes("function backSkinOf(side){return side==='enemy'?ENEMY_BACK_SKIN:"));
  assert.ok(html.includes('id="enemy-piles"') && html.includes('data-back-side="player"'));
});

test('브라우저 검사: 뽑기·구매/적용·부족 차단·강화/합성/시크릿 쿠키조각·마이그레이션·저장 유지', (t) => {
  const probe = spawnSync('python3', ['-I', '-c', 'import playwright'], { encoding: 'utf8' });
  if (probe.status !== 0) { t.skip('python playwright 가 없어 건너뜀 (npm run qa:cosmetics 로 따로 실행)'); return; }
  const run = spawnSync('python3', ['-I', path.join(root, '12_tools/qa/check-cosmetics-economy.py')], { encoding: 'utf8', timeout: 300000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /OK: 재화 사용처·꾸미기 확인/);
});
