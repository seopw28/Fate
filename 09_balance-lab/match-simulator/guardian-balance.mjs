#!/usr/bin/env node
/**
 * 수호신 밸런스 시뮬레이터 (헤드리스).
 *
 * dist/index.html 의 전투 규칙을 그대로 옮겨 수천 판을 자동 대전시킨다.
 *   - 카드 능력치: dist/runtime/cards.js (챔피언 풀)
 *   - 수호신 수치: dist/index.html 의 `const GUARDIANS={...}` 를 직접 읽는다 (단일 출처)
 *
 * 모델링한 규칙: 영웅 체력 100, 마나 3→10(+1/라운드), 등급 롤(A 15% +2 / B 35% +1 / C 50%), 선공권(체력↓ → 필드 카드↓ → 나),
 *   소환 직후 공격 불가(플레이어) / 즉시 공격(상대), 가장 왼쪽 카드 공격, 반격 없음, 
 *   수호신 4종(청룡=마나 회복·백호=살아남으면 즉시 반격·주작=뽑을 때 S급 +3·현무=치명타 생존)과 상대 수호신 무작위 배정(내가 고른 것 제외).
 * 모델링하지 않은 것: 마법/함정/필살기, 챔피언 개별 능력, 혈마나, 추가 드로우. (모든 카드를 바닐라 능력치로 취급)
 *
 * 모드:
 *   --mode symmetric (기본) 양쪽이 동일한 규칙·동일한 봇을 쓰는 대칭 대전. 기본 승률이 50%라서 '수호신 자체의 힘'을 비교할 수 있다.
 *       (소환 즉시 공격, 마나 환급 후 재계획, 앞줄은 공격-체력/2가 낮은 카드, 화상은 공격 턴 직후 정산)
 *   --mode game  실제 게임의 비대칭을 그대로 재현(상대는 소환 즉시 공격, 내 유닛은 한 턴 대기). 마법·필살기·혈마나가 빠져 있어
 *       내 승률이 거의 0%로 나오므로 절대 승률 용도로는 쓸 수 없다.
 *
 * 사용: node 09_balance-lab/match-simulator/guardian-balance.mjs [--games 20000] [--seed 1] [--mode symmetric|game] [--override cheongryong.chance=0.25,...]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, i, all) => (arg.startsWith('--') ? [...acc, [arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
const GAMES = Number(args.games) || 20000;
const SEED = Number(args.seed) || 1;
const SYM = (args.mode || 'symmetric') !== 'game';
const INITIATIVE = !args['no-initiative'];
const HEAL_COUNTS_FOR_INITIATIVE = !!args['heal-counts'];/* 기본: 현무 회복분은 선공권 판정에서 제외(게임과 동일). --heal-counts 로 회복분도 포함 *//* --no-initiative: 선공권 규칙을 끄고 항상 내가 선공(상호 교대 없음) */

// ── 데이터 로드 ──────────────────────────────────────────────
const sandbox = { globalThis: {} };
vm.runInNewContext(readFileSync(resolve(root, 'dist/runtime/cards.js'), 'utf8'), sandbox);
const POOL = sandbox.globalThis.PrimalCardSet.cards
  .filter(c => c.cardType === 'champion' && c.collectible !== false && c.releaseState !== 'prototype')
  .map(c => ({ cost: c.cost, atk: c.stats.attack, hp: c.stats.health }));
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const GUARDIANS = vm.runInNewContext('(' + html.match(/const GUARDIANS=(\{[\s\S]*?\n    \});/)[1] + ')');
for (const override of String(args.override || '').split(',').filter(Boolean)) {
  const [path, value] = override.split('=');
  const [id, key] = path.split('.');
  GUARDIANS[id][key] = Number(value);
}
const IDS = Object.keys(GUARDIANS);

// ── 난수 ────────────────────────────────────────────────────
function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── 규칙 상수 (dist/index.html 과 동일) ─────────────────────
const HERO_HP = 100, MANA_CAP = 10, START_MANA = 3, FIELD_LIMIT = 6, HAND_LIMIT = 8, ROUND_CAP = 40;
const AI = { atkWeight: 1, hpWeight: 0.7, manaWeight: 0.35 };
const grade = rnd => { const r = rnd(); return r < 0.15 ? 2 : r < 0.5 ? 1 : 0; };
// 주작: 카드를 뽑을 때 chance 확률로 S급(+3). 시작 손패 5장은 수호신 선택 전에 정해지므로 제외.
const mkCard = (base, rnd, jujak = false) => ({ cost: base.cost, atk: base.atk + (jujak && rnd() < GUARDIANS.jujak.chance ? 3 : grade(rnd)), hp: base.hp });
const value = c => c.atk * AI.atkWeight + c.hp * AI.hpWeight;

function plan(hand, mana, slots) {
  let best = null; const n = Math.min(hand.length, 12);
  for (let mask = 1; mask < (1 << n); mask++) {
    let cost = 0, count = 0, v = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { cost += hand[i].cost; count++; v += value(hand[i]); }
    if (cost > mana || count > slots) continue;
    const score = v + cost * AI.manaWeight;
    if (!best || score > best.score) best = { score, mask };
  }
  return best ? hand.slice(0, n).map((_, i) => i).filter(i => best.mask & (1 << i)) : [];
}

function playGame(playerGuardian, enemyGuardian, rnd) {
  const mkSide = (guardian) => ({
    guardian, hp: HERO_HP, healed: 0, prevented: 0, procs: 0,
    deck: shuffle(POOL, rnd).slice(0, 60).map((b, i) => mkCard(b, rnd, guardian === 'jujak' && i >= 5)),
    hand: [], field: [],
  });
  const P = mkSide(playerGuardian), E = mkSide(enemyGuardian);
  P.hand = P.deck.splice(0, 5); E.hand = E.deck.splice(0, 5);
  const proc = (side, id) => side.guardian === id && rnd() < GUARDIANS[id].chance;
  const alive = side => side.field.filter(u => u.hp > 0);
  let winner = null;

  function damageUnit(side, unit, dmg) {
    if (dmg >= unit.hp && !unit.saved && (!GUARDIANS.hyeonmu.maxProcs || side.procs < GUARDIANS.hyeonmu.maxProcs) && proc(side, 'hyeonmu')) { unit.saved = true; side.procs++; dmg = unit.hp - 1; }
    unit.hp -= dmg;
    if (unit.hp <= 0) side.field = side.field.filter(u => u !== unit);
  }
  function hitHero(side, dmg) {
    side.hp -= dmg; if (side.hp <= 0 && !winner) winner = side === P ? 'enemy' : 'player'; }
  function attack(attackerSide, defenderSide, unit) {
    if (winner || unit.hp <= 0) return;
    const targets = alive(defenderSide);
    if (!targets.length) { hitHero(defenderSide, unit.atk); return; }
    const target = targets[0];
    damageUnit(defenderSide, target, unit.atk);
    // 백호: 공격을 받고 살아남으면 chance 확률로 즉시 반격(자기 공격력만큼 공격자에게 피해)
    if (target.hp > 0 && proc(defenderSide, 'baekho')) damageUnit(attackerSide, unit, target.atk);
  }
  function healHero(side) { const before = side.hp; side.hp = Math.min(HERO_HP, side.hp + GUARDIANS.hyeonmu.amount); side.healed += side.hp - before; }

  // ── 대칭 모드: 한 쪽의 한 턴 ──
  function symHalf(S, F, round, maxMana) {
    if (round >= 2) {
      if (!S.deck.length) { winner = S === P ? 'enemy' : 'player'; return; }
      const card = S.deck.shift(); if (S.hand.length < HAND_LIMIT) S.hand.push(card);
      if (GUARDIANS.hyeonmu.amount > 0 && proc(S, 'hyeonmu')) healHero(S);
    }
    let mana = maxMana;
    for (let guard = 0; guard < 12; guard++) {
      const picks = plan(S.hand, mana, FIELD_LIMIT - S.field.length);
      if (!picks.length) break;
      const card = S.hand.splice(picks[0], 1)[0];
      mana -= card.cost;
      S.field.push({ ...card });
      if (card.cost >= 2 && proc(S, 'cheongryong')) mana = Math.min(maxMana, mana + (GUARDIANS.cheongryong.mana || 1));
    }
    S.field.sort((a, b) => (a.atk - a.hp * 0.5) - (b.atk - b.hp * 0.5));
    S.field.slice().forEach(u => attack(S, F, u));
    if (winner) return;
    F.field.slice().forEach(u => { if (u.burn) { const b = u.burn; u.burn = 0; damageUnit(F, u, b); } });
  }

  // ── 게임 모드: 실제 게임의 비대칭 ──
  function playerHalf(round, maxMana) {
    if (round >= 2) {
      if (!P.deck.length) { winner = 'enemy'; return; }
      const card = P.deck.shift(); if (P.hand.length < HAND_LIMIT) P.hand.push(card);
      P.field.forEach(u => { u.exhausted = false; });
      if (GUARDIANS.hyeonmu.amount > 0 && proc(P, 'hyeonmu')) healHero(P);
    }
    let mana = maxMana;
    for (let guard = 0; guard < 12; guard++) {
      const picks = plan(P.hand, mana, FIELD_LIMIT - P.field.length);
      if (!picks.length) break;
      const card = P.hand.splice(picks[0], 1)[0];
      mana -= card.cost;
      P.field.push({ ...card, exhausted: true });
      if (card.cost >= 2 && proc(P, 'cheongryong')) mana = Math.min(maxMana, mana + (GUARDIANS.cheongryong.mana || 1));
    }
    P.field.filter(u => !u.exhausted).forEach(u => attack(P, E, u));
    if (winner) return;
    [P, E].forEach(side => side.field.slice().forEach(u => { if (u.burn) { const b = u.burn; u.burn = 0; damageUnit(side, u, b); } }));
  }

  function enemyHalf(maxMana) {
    if (E.deck.length) { const card = E.deck.shift(); if (E.hand.length < HAND_LIMIT) E.hand.push(card); }
    if (GUARDIANS.hyeonmu.amount > 0 && proc(E, 'hyeonmu')) healHero(E);
    let mana = Math.min(MANA_CAP, maxMana);
    if (maxMana < MANA_CAP && proc(E, 'cheongryong')) mana = Math.min(MANA_CAP, maxMana + (GUARDIANS.cheongryong.mana || 1));
    const picks = plan(E.hand, mana, FIELD_LIMIT - E.field.length);
    picks.slice().sort((a, b) => b - a).map(i => E.hand.splice(i, 1)[0]).reverse().forEach(card => E.field.push({ ...card }));
    E.field.sort((a, b) => (a.atk - a.hp * 0.5) - (b.atk - b.hp * 0.5));
    E.field.slice().forEach(u => attack(E, P, u));
  }

  let first = 'player', round = 1;
  while (!winner && round <= ROUND_CAP) {
    const maxMana = Math.min(MANA_CAP, START_MANA + round - 1);
    const turnP = () => (SYM ? symHalf(P, E, round, maxMana) : playerHalf(round, maxMana));
    const turnE = () => (SYM ? symHalf(E, P, round, maxMana) : enemyHalf(maxMana));
    if (first === 'player') { turnP(); if (!winner) turnE(); }
    else { turnE(); if (!winner) turnP(); }
    if (winner) break;
    // 선공권: 체력이 낮은 쪽 → 필드 카드가 적은 쪽 → 나
    if (!INITIATIVE) { first = 'player'; round++; continue; }
    const off = x => (HEAL_COUNTS_FOR_INITIATIVE ? 0 : x.healed + (args['prevented-counts'] ? 0 : x.prevented));
    const php = P.hp - off(P), ehp = E.hp - off(E);
    first = php !== ehp ? (php < ehp ? 'player' : 'enemy') : (P.field.length !== E.field.length ? (P.field.length < E.field.length ? 'player' : 'enemy') : 'player');
    round++;
  }
  return { winner: winner || 'draw', rounds: round };
}

// ── 실행 ────────────────────────────────────────────────────
const rnd = makeRng(SEED);
const pct = x => (x * 100).toFixed(1).padStart(5) + '%';
const ci = (w, n) => 1.96 * Math.sqrt((w / n) * (1 - w / n) / n) * 100;

function batch(playerGuardian, enemyPicker, games) {
  let win = 0, draw = 0, rounds = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame(playerGuardian, enemyPicker(), rnd);
    if (r.winner === 'player') win++; else if (r.winner === 'draw') draw++;
    rounds += r.rounds;
  }
  return { rate: (win + draw * 0.5) / games, win, games, rounds: rounds / games };
}

if (args.sweep) {
  // 수호신 하나의 수치를 바꿔가며 '수호신 없는 상대'에 대한 승률 곡선을 그린다. (--sweep 청룡id 예: --sweep cheongryong)
  const id = String(args.sweep), keys = id === 'hyeonmu' && (GUARDIANS.hyeonmu.unitRatio || GUARDIANS.hyeonmu.unitFlat) ? [['unitChance', [0.03, 0.05, 0.08, 0.1, 0.15, 0.25, 0.35, 0.5, 0.7, 1]]] : id === 'hyeonmu' && !GUARDIANS.hyeonmu.ratio ? [['amount', [2, 3, 4, 5, 6, 8, 10, 12, 15]], ['chance', [0.4, 0.6, 0.8, 1]]] : [['chance', [0.02, 0.03, 0.04, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.45, 0.6, 0.8, 1]]];
  console.log(`[스윕] ${GUARDIANS[id].name} vs 수호신 없음 (판수 ${GAMES})`);
  for (const [key, values] of keys) {
    const original = GUARDIANS[id][key];
    for (const v of values) { GUARDIANS[id][key] = v; const r = batch(id, () => null, GAMES); console.log(`  ${key}=${v}`.padEnd(16) + pct(r.rate) + ` ±${ci(r.win, r.games).toFixed(1)}`); }
    GUARDIANS[id][key] = original;
  }
  process.exit(0);
}

console.log(`카드 풀 ${POOL.length}장 · 판수 ${GAMES}/항목 · seed ${SEED} · 모드 ${SYM ? 'symmetric(대칭)' : 'game(실제 비대칭)'}`);
console.log('수호신 수치:', IDS.map(id => `${GUARDIANS[id].name} ${Math.round(GUARDIANS[id].chance * 100)}%${GUARDIANS[id].amount ? '×' + GUARDIANS[id].amount : ''}`).join(' · '));

console.log('\n[1] 실제 게임 조건: 내가 고른 수호신 vs 상대(나머지 3종 중 무작위)  → 내 승률');
const real = {};
for (const id of [...IDS, null]) {
  const others = id ? IDS.filter(x => x !== id) : IDS;
  const r = batch(id, () => others[Math.floor(rnd() * others.length)], GAMES);
  real[id || 'none'] = r;
  console.log(`  ${(id ? GUARDIANS[id].name : '수호신 없음').padEnd(8)} ${pct(r.rate)} ±${ci(r.win, r.games).toFixed(1)}  (평균 ${r.rounds.toFixed(1)}라운드)`);
}

console.log('\n[2] 1:1 상성표 (행 = 내 수호신, 열 = 상대 수호신, 값 = 내 승률)');
console.log('          ' + IDS.map(id => GUARDIANS[id].name.padStart(6)).join(' ') + '   수호신없음');
for (const a of IDS) {
  const cells = [...IDS, null].map(b => (a === b ? '   -  ' : pct(batch(a, () => b, Math.round(GAMES / 2)).rate)));
  console.log('  ' + GUARDIANS[a].name.padEnd(8) + cells.join(' '));
}
const rates = IDS.map(id => real[id].rate);
console.log(`\n수호신 간 승률 격차(최대−최소): ${((Math.max(...rates) - Math.min(...rates)) * 100).toFixed(1)}%p`);
