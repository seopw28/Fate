#!/usr/bin/env node
/**
 * 성격 오라 밸런스 시뮬레이터 (헤드리스).
 *
 * dist/index.html 의 전투 규칙을 그대로 옮겨 수천 판을 자동 대전시킨다.
 *   - 카드 능력치: dist/runtime/cards.js (챔피언 풀)
 *   - 성격 오라 수치: dist/index.html 의 `const GUARDIANS={...}` 를 직접 읽는다 (단일 출처)
 *
 * 모델링한 규칙: 영웅 체력 100, 마나 3→10(+1/라운드), 등급 롤(A 15% +2 / B 35% +1 / C 50%), 선공권(체력↓ → 필드 카드↓ → 나),
 *   소환 직후 공격 불가(플레이어) / 즉시 공격(상대), 가장 왼쪽 카드 공격,
 *   성격 오라 5종(물=마나 회복·금속=살아남으면 즉시 반격·불=공격 시 확률 추가 공격·대지=치명타 생존·나무=체력 성장)과 상대 성격 오라 무작위 배정(내가 고른 것 제외).
 * 모델링하지 않은 것: 마법/함정/궁극기, 챔피언 개별 능력, 혈마나, 추가 드로우. (모든 카드를 바닐라 능력치로 취급)
 *
 * 모드:
 *   --mode symmetric (기본) 양쪽이 동일한 규칙·동일한 봇을 쓰는 대칭 대전. 기본 승률이 50%라서 '성격 오라 자체의 힘'을 비교할 수 있다.
 *       (소환 즉시 공격, 마나 환급 후 재계획, 앞줄은 공격-체력/2가 낮은 카드, 화상은 공격 턴 직후 정산)
 *   --mode game  실제 게임의 비대칭을 그대로 재현(상대는 소환 즉시 공격, 내 유닛은 한 턴 대기). 마법·궁극기·혈마나가 빠져 있어
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
const AWAKENING_SIM = !!args.awakening;
const AWAKENING_MATCHUP = args['awakening-matchup'] ? String(args['awakening-matchup']) : '';

// ── 데이터 로드 ──────────────────────────────────────────────
const sandbox = { globalThis: {} };
vm.runInNewContext(readFileSync(resolve(root, 'dist/runtime/cards.js'), 'utf8'), sandbox);
const POOL = sandbox.globalThis.PrimalCardSet.cards
  .filter(c => c.cardType === 'champion' && c.collectible !== false && c.releaseState !== 'prototype')
  .map(c => ({ cost: c.cost, atk: c.stats.attack, hp: c.stats.health }));
const html = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
const auraSource = html.match(/const PERSONALITY_AURAS=(\{[\s\S]*?\n    \});/);
if (!auraSource) throw new Error('dist/index.html에서 PERSONALITY_AURAS 정의를 찾지 못했습니다.');
const GUARDIANS = vm.runInNewContext('(' + auraSource[1] + ')');
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
const AWAKEN_HP = 70;
const AWAKENING_OPTIONS = {
  jujak: {
    A: { label: '폭열', chance: 0.044, extraStrikes: 2 },
    B: { label: '연격', chance: 0.075, extraStrikes: 1 },
  },
  cheongryong: {
    A: { label: '범람', chance: 0.15, manaMin: 8, manaMax: 8 },
    B: { label: '순환', chance: 0.99, manaMin: 2, manaMax: 2 },
  },
  namu: {
    A: { label: '숲의 생명', chance: 1.00, hpGain: 1 },
    B: { label: '거목 수호', chance: 0.30, hpGain: 5, leftmostOnly: true },
  },
  baekho: {
    A: { label: '절단 반격', chance: 0.70, ratio: 0.30, minDamage: 1, maxDamage: 3 },
    B: { label: '파쇄 공명', chance: 0.14, aoeDamage: 3 },
  },
  hyeonmu: {
    A: { label: '암반 피부', chance: 0.70, damageReduction: 1 },
    B: { label: '절대방어', chance: 0.05, avoidDamage: true },
  },
};
for (const override of String(args['awakening-override'] || '').split(',').filter(Boolean)) {
  const [path, value] = override.split('=');
  const [id, option, key] = path.split('.');
  if (!AWAKENING_OPTIONS[id]?.[option] || !(key in AWAKENING_OPTIONS[id][option])) throw new Error(`알 수 없는 각성 override: ${path}`);
  AWAKENING_OPTIONS[id][option][key] = Number(value);
}
const AI = { atkWeight: 1, hpWeight: 0.7, manaWeight: 0.35 };
const grade = rnd => { const r = rnd(); return r < 0.15 ? 2 : r < 0.5 ? 1 : 0; };
const mkCard = (base, rnd) => ({ cost: base.cost, atk: base.atk + grade(rnd), hp: base.hp });
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

function playGame(playerGuardian, enemyGuardian, rnd, playerAwakening = null, enemyAwakening = null) {
  const mkSide = (guardian, awakeningChoice) => ({
    guardian, hp: HERO_HP, healed: 0, prevented: 0, procs: 0,
    awakeningChoice, awakened: false,
    deck: shuffle(POOL, rnd).slice(0, 60).map(b => mkCard(b, rnd)),
    hand: [], field: [],
  });
  const P = mkSide(playerGuardian, playerAwakening), E = mkSide(enemyGuardian, enemyAwakening);
  P.hand = P.deck.splice(0, 5); E.hand = E.deck.splice(0, 5);
  const auraConfig = (side, id) => side.awakened && side.guardian === id && AWAKENING_OPTIONS[id]?.[side.awakeningChoice] ? AWAKENING_OPTIONS[id][side.awakeningChoice] : GUARDIANS[id];
  const proc = (side, id) => side.guardian === id && rnd() < auraConfig(side, id).chance;
  const poseidonMana = side => { const cfg = auraConfig(side, 'cheongryong'); return cfg.manaMin + Math.floor(rnd() * (cfg.manaMax - cfg.manaMin + 1)); };
  const alive = side => side.field.filter(u => u.hp > 0);
  let winner = null;

  function damageUnit(side, unit, dmg) {
    const earth = auraConfig(side, 'hyeonmu');
    if (earth.damageReduction && proc(side, 'hyeonmu')) dmg = Math.max(1, dmg - earth.damageReduction);
    if (earth.avoidDamage && proc(side, 'hyeonmu')) return;
    if (earth.maxProcs && dmg >= unit.hp && side.procs < earth.maxProcs && proc(side, 'hyeonmu')) {
      side.procs++;
      if (earth.reviveRatio) { unit.hp = Math.max(1, Math.ceil(unit.maxHp * earth.reviveRatio)); return; }
      unit.saved = true; dmg = unit.hp - 1;
    }
    unit.hp -= dmg;
    if (unit.hp <= 0) side.field = side.field.filter(u => u !== unit);
  }
  function hitHero(side, dmg) {
    side.hp -= dmg;
    if (AWAKENING_SIM && !side.awakened && side.awakeningChoice && side.hp <= AWAKEN_HP && side.hp > 0) side.awakened = true;
    if (side.hp <= 0 && !winner) winner = side === P ? 'enemy' : 'player'; }
  function strike(attackerSide, defenderSide, unit) {
    if (winner || unit.hp <= 0) return;
    const targets = alive(defenderSide);
    if (!targets.length) { hitHero(defenderSide, unit.atk); return; }
    const target = targets[0];
    damageUnit(defenderSide, target, unit.atk);
    // 아테나: 공격을 받고 살아남으면 chance 확률로 저위력 반격(실게임과 동일한 ratio·최소 1·maxDamage 상한)
    if (target.hp > 0 && proc(defenderSide, 'baekho')) {
      const athena = auraConfig(defenderSide, 'baekho');
      if (athena.aoeDamage) alive(attackerSide).slice().forEach(enemy => damageUnit(attackerSide, enemy, athena.aoeDamage));
      else {
        const counterDamage = Math.max(athena.minDamage || 1, Math.min(athena.maxDamage || Infinity, Math.ceil(target.atk * (athena.ratio || 1))));
        damageUnit(attackerSide, unit, counterDamage);
      }
    }
  }
  function attack(attackerSide, defenderSide, unit) {
    strike(attackerSide, defenderSide, unit);
    // 불의 오라: 첫 공격 뒤 공격자가 살아 있으면 확률적으로 즉시 한 번 더 공격한다.
    // 첫 대상이 쓰러졌다면 두 번째 타격은 새 앞줄(없으면 영웅)을 다시 지정한다.
    if (!winner && unit.hp > 0 && proc(attackerSide, 'jujak')) {
      const extraStrikes = auraConfig(attackerSide, 'jujak').extraStrikes || 1;
      for (let i = 0; i < extraStrikes && !winner && unit.hp > 0; i++) strike(attackerSide, defenderSide, unit);
    }
  }
  // 나무의 오라: 자기 턴 시작에 필드의 카드마다 독립적으로 chance 확률로 체력 +1
  function growNamu(side) { if (side.guardian !== 'namu' || !GUARDIANS.namu) return; const cfg = auraConfig(side, 'namu'), targets = cfg.leftmostOnly ? side.field.slice(0, 1) : side.field; targets.forEach(u => { if (rnd() < cfg.chance) { const gain = cfg.hpGain || 1; u.hp += gain; u.maxHp += gain; } }); }
  function healHero(side) { const before = side.hp; side.hp = Math.min(HERO_HP, side.hp + GUARDIANS.hyeonmu.amount); side.healed += side.hp - before; }

  // ── 대칭 모드: 한 쪽의 한 턴 ──
  function symHalf(S, F, round, maxMana) {
    if (round >= 2) {
      if (!S.deck.length) { winner = S === P ? 'enemy' : 'player'; return; }
      const card = S.deck.shift(); if (S.hand.length < HAND_LIMIT) S.hand.push(card);
      if (GUARDIANS.hyeonmu.amount > 0 && proc(S, 'hyeonmu')) healHero(S);
    }
    growNamu(S);
    let mana = maxMana;
    for (let guard = 0; guard < 12; guard++) {
      const picks = plan(S.hand, mana, FIELD_LIMIT - S.field.length);
      if (!picks.length) break;
      const card = S.hand.splice(picks[0], 1)[0];
      mana -= card.cost;
      S.field.push({ ...card, maxHp: card.hp });
      if (card.cost >= 2 && proc(S, 'cheongryong')) mana = Math.min(maxMana, mana + poseidonMana(S));
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
    growNamu(P);
    let mana = maxMana;
    for (let guard = 0; guard < 12; guard++) {
      const picks = plan(P.hand, mana, FIELD_LIMIT - P.field.length);
      if (!picks.length) break;
      const card = P.hand.splice(picks[0], 1)[0];
      mana -= card.cost;
      P.field.push({ ...card, maxHp: card.hp, exhausted: true });
      if (card.cost >= 2 && proc(P, 'cheongryong')) mana = Math.min(maxMana, mana + poseidonMana(P));
    }
    P.field.filter(u => !u.exhausted).forEach(u => attack(P, E, u));
    if (winner) return;
    [P, E].forEach(side => side.field.slice().forEach(u => { if (u.burn) { const b = u.burn; u.burn = 0; damageUnit(side, u, b); } }));
  }

  function enemyHalf(maxMana) {
    if (E.deck.length) { const card = E.deck.shift(); if (E.hand.length < HAND_LIMIT) E.hand.push(card); }
    if (GUARDIANS.hyeonmu.amount > 0 && proc(E, 'hyeonmu')) healHero(E);
    growNamu(E);
    let mana = Math.min(MANA_CAP, maxMana);
    if (maxMana < MANA_CAP && proc(E, 'cheongryong')) mana = Math.min(MANA_CAP, maxMana + poseidonMana(E));
    const picks = plan(E.hand, mana, FIELD_LIMIT - E.field.length);
    picks.slice().sort((a, b) => b - a).map(i => E.hand.splice(i, 1)[0]).reverse().forEach(card => E.field.push({ ...card, maxHp: card.hp }));
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

function batch(playerGuardian, enemyPicker, games, playerAwakening = null, enemyAwakeningPicker = () => null) {
  let win = 0, draw = 0, rounds = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame(playerGuardian, enemyPicker(), rnd, playerAwakening, enemyAwakeningPicker());
    if (r.winner === 'player') win++; else if (r.winner === 'draw') draw++;
    rounds += r.rounds;
  }
  return { rate: (win + draw * 0.5) / games, win, games, rounds: rounds / games };
}

function seatAdjustedAwakeningPool(targetGuardian, targetOption, games) {
  const others = IDS.filter(id => id !== targetGuardian);
  const half = Math.floor(games / 2);
  let score = 0, rounds = 0;
  for (let i = 0; i < games; i++) {
    const otherGuardian = others[Math.floor(rnd() * others.length)];
    const otherOption = rnd() < 0.5 ? 'A' : 'B';
    const targetIsPlayer = i < half;
    const result = targetIsPlayer
      ? playGame(targetGuardian, otherGuardian, rnd, targetOption, otherOption)
      : playGame(otherGuardian, targetGuardian, rnd, otherOption, targetOption);
    if (result.winner === 'draw') score += 0.5;
    else if ((targetIsPlayer && result.winner === 'player') || (!targetIsPlayer && result.winner === 'enemy')) score++;
    rounds += result.rounds;
  }
  return { rate: score / games, win: score, games, rounds: rounds / games };
}

function seatAdjustedAwakeningMatchup(targetGuardian, targetOption, opponentGuardian, opponentOption, games) {
  const half = Math.floor(games / 2);
  let score = 0, rounds = 0;
  for (let i = 0; i < games; i++) {
    const targetIsPlayer = i < half;
    const result = targetIsPlayer
      ? playGame(targetGuardian, opponentGuardian, rnd, targetOption, opponentOption)
      : playGame(opponentGuardian, targetGuardian, rnd, opponentOption, targetOption);
    if (result.winner === 'draw') score += 0.5;
    else if ((targetIsPlayer && result.winner === 'player') || (!targetIsPlayer && result.winner === 'enemy')) score++;
    rounds += result.rounds;
  }
  return { rate: score / games, win: score, games, rounds: rounds / games };
}

if (AWAKENING_MATCHUP) {
  const [targetGuardian, targetOption] = AWAKENING_MATCHUP.split('.');
  if (!AWAKENING_OPTIONS[targetGuardian]?.[targetOption]) throw new Error(`각성 매치업은 guardian.A 또는 guardian.B 형식이어야 합니다: ${AWAKENING_MATCHUP}`);
  console.log(`[각성 1:1 상성] ${GUARDIANS[targetGuardian].name} ${targetOption} ${AWAKENING_OPTIONS[targetGuardian][targetOption].label} · 판수 ${GAMES}/상대 선택지 · seed ${SEED} · 좌석 50:50 보정`);
  for (const opponentGuardian of IDS.filter(id => id !== targetGuardian)) {
    const rates = [];
    for (const opponentOption of ['A', 'B']) {
      const result = seatAdjustedAwakeningMatchup(targetGuardian, targetOption, opponentGuardian, opponentOption, GAMES);
      rates.push(result.rate);
      console.log(`  vs ${GUARDIANS[opponentGuardian].name} ${opponentOption} ${AWAKENING_OPTIONS[opponentGuardian][opponentOption].label.padEnd(8)} ${pct(result.rate)} ±${ci(result.win, result.games).toFixed(2)}`);
    }
    console.log(`  → ${GUARDIANS[opponentGuardian].name} A/B 균등 평균 ${pct((rates[0] + rates[1]) / 2)}`);
  }
  process.exit(0);
}

if (AWAKENING_SIM) {
  console.log(`[오라 지속 각성] 영웅 체력 ${AWAKEN_HP} 이하 자동 발동 · 판수 ${GAMES}/선택지 · seed ${SEED} · ${SYM ? '대칭 모드' : '게임 모드'}`);
  console.log('상대: 나머지 4개 오라 무작위 · 상대 A/B 균등 선택 · 양쪽 좌석 50:50 보정');
  const awakeningResults = {};
  for (const id of IDS) {
    awakeningResults[id] = {};
    for (const option of ['A', 'B']) {
      const result = seatAdjustedAwakeningPool(id, option, GAMES);
      awakeningResults[id][option] = result;
      console.log(`  ${GUARDIANS[id].name.padEnd(8)} ${option} ${AWAKENING_OPTIONS[id][option].label.padEnd(8)} ${pct(result.rate)} ±${ci(result.win, result.games).toFixed(2)}  (평균 ${result.rounds.toFixed(1)}라운드)`);
    }
  }
  console.log('\n[같은 오라 A vs B 직접 대결]');
  for (const id of IDS) {
    const aFirst = batch(id, () => id, GAMES, 'A', () => 'B');
    const bFirst = batch(id, () => id, GAMES, 'B', () => 'A');
    const seatAdjustedA = (aFirst.rate + (1 - bFirst.rate)) / 2;
    console.log(`  ${GUARDIANS[id].name.padEnd(8)} A ${AWAKENING_OPTIONS[id].A.label} vs B ${AWAKENING_OPTIONS[id].B.label}: A ${pct(seatAdjustedA)} (A가 플레이어 ${pct(aFirst.rate)} · B가 플레이어 ${pct(bFirst.rate)})`);
  }
  process.exit(0);
}

if (args.sweep) {
  // 성격 오라 하나의 수치를 바꿔가며 나머지 오라 4종을 무작위로 만났을 때의 승률 곡선을 그린다.
  const id = String(args.sweep), keys = id === 'jujak' ? [['chance', [0.04, 0.045, 0.05, 0.055, 0.06, 0.065, 0.07, 0.075, 0.08]]] : id === 'hyeonmu' && (GUARDIANS.hyeonmu.unitRatio || GUARDIANS.hyeonmu.unitFlat) ? [['unitChance', [0.03, 0.05, 0.08, 0.1, 0.15, 0.25, 0.35, 0.5, 0.7, 1]]] : id === 'hyeonmu' && !GUARDIANS.hyeonmu.ratio ? [['amount', [2, 3, 4, 5, 6, 8, 10, 12, 15]], ['chance', [0.4, 0.6, 0.8, 1]]] : [['chance', [0.02, 0.03, 0.04, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.45, 0.6, 0.8, 1]]];
  const opponents = IDS.filter(other => other !== id);
  console.log(`[스윕] ${GUARDIANS[id].name} vs 나머지 오라 4종 무작위 (판수 ${GAMES})`);
  for (const [key, values] of keys) {
    const original = GUARDIANS[id][key];
    for (const v of values) { GUARDIANS[id][key] = v; const r = batch(id, () => opponents[Math.floor(rnd() * opponents.length)], GAMES); console.log(`  ${key}=${v}`.padEnd(16) + pct(r.rate) + ` ±${ci(r.win, r.games).toFixed(1)}`); }
    GUARDIANS[id][key] = original;
  }
  process.exit(0);
}

console.log(`카드 풀 ${POOL.length}장 · 판수 ${GAMES}/항목 · seed ${SEED} · 모드 ${SYM ? 'symmetric(대칭)' : 'game(실제 비대칭)'}`);
console.log('성격 오라 수치:', IDS.map(id => `${GUARDIANS[id].name} ${Math.round(GUARDIANS[id].chance * 100)}%${GUARDIANS[id].amount ? '×' + GUARDIANS[id].amount : ''}`).join(' · '));

console.log('\n[1] 실제 게임 조건: 내가 고른 성격 오라 vs 상대(나머지 4종 중 무작위)  → 내 승률');
const real = {};
for (const id of IDS) {
  const others = IDS.filter(x => x !== id);
  const r = batch(id, () => others[Math.floor(rnd() * others.length)], GAMES);
  real[id] = r;
  console.log(`  ${GUARDIANS[id].name.padEnd(8)} ${pct(r.rate)} ±${ci(r.win, r.games).toFixed(1)}  (평균 ${r.rounds.toFixed(1)}라운드)`);
}

console.log('\n[2] 1:1 상성표 (행 = 내 성격 오라, 열 = 상대 성격 오라, 값 = 내 승률)');
console.log('          ' + IDS.map(id => GUARDIANS[id].name.padStart(6)).join(' '));
for (const a of IDS) {
  const cells = IDS.map(b => (a === b ? '   -  ' : pct(batch(a, () => b, Math.round(GAMES / 2)).rate)));
  console.log('  ' + GUARDIANS[a].name.padEnd(8) + cells.join(' '));
}
const rates = IDS.map(id => real[id].rate);
console.log(`\n성격 오라 간 승률 격차(최대−최소): ${((Math.max(...rates) - Math.min(...rates)) * 100).toFixed(1)}%p`);
