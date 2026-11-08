#!/usr/bin/env node
/**
 * 고코스트 하수인 '다수 공격' 효과의 가치 시뮬레이터 (헤드리스).
 *
 * 양쪽에 같은 코스트의 하수인을 K장씩 시작 손패에 추가로 준다.
 *   - 내 쪽: 특수 하수인(능력치 합 S, 다수 공격 효과)
 *   - 상대: 표준 능력치 하수인(코스트 곡선대로, 효과 없음)
 * 내 승률이 50%가 되는 S(능력치 합)가 '그 효과의 가치만큼 깎아야 하는 능력치'다.
 *
 * 효과 유형
 *   barrage:N  세팅(소환) 시 적 하수인 전체에게 N 피해 (소환사 제외, 아군 제외)
 *   sweep:P    기본 공격이 적 하수인 전체를 공격력의 P% 피해로 때린다 (적이 없으면 소환사에게 전체 공격력)
 * 표준 능력치: 코스트별 실제 카드 평균(능력치 합)을 공격:체력 ≈ 1:1 로 나눈 값.
 *
 * 사용: node champion-balance.mjs [--games 8000] [--seed 3] [--copies 2] [--cost 8] [--effect barrage:3]
 *       node champion-balance.mjs --solve --cost 8 --effect barrage:3   (S를 찾아 50% 되는 능력치 합 출력)
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, i, all) => (arg.startsWith('--') ? [...acc, [arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
const GAMES = Number(args.games) || 8000, SEED = Number(args.seed) || 3, COPIES = Number(args.copies) || 2;

const sandbox = { globalThis: {} };
vm.runInNewContext(readFileSync(resolve(root, 'dist/runtime/cards.js'), 'utf8'), sandbox);
const POOL = sandbox.globalThis.PrimalCardSet.cards.filter(c => c.cardType === 'champion' && c.collectible !== false && c.releaseState !== 'prototype').map(c => ({ cost: c.cost, atk: c.stats.attack, hp: c.stats.health }));
// 코스트별 평균 능력치 합(표준 곡선)
const STD = {};
for (const cost of new Set(POOL.map(c => c.cost))) { const L = POOL.filter(c => c.cost === cost); STD[cost] = L.reduce((a, c) => a + c.atk + c.hp, 0) / L.length; }

function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const HERO_HP = 100, MANA_CAP = 10, START_MANA = 3, FIELD_LIMIT = 6, HAND_LIMIT = 8, ROUND_CAP = 40;
const grade = rnd => { const r = rnd(); return r < 0.15 ? 2 : r < 0.5 ? 1 : 0; };
const value = c => c.atk + c.hp * 0.7;
const split = sum => { const atk = Math.round(sum / 2); return { atk, hp: Math.max(1, Math.round(sum) - atk) }; };

function plan(hand, mana, slots) {
  let best = null; const n = Math.min(hand.length, 12);
  for (let mask = 1; mask < (1 << n); mask++) {
    let cost = 0, count = 0, v = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { cost += hand[i].cost; count++; v += value(hand[i]); }
    if (cost > mana || count > slots) continue;
    const score = v + cost * 0.35;
    if (!best || score > best.score) best = { score, mask };
  }
  return best ? hand.slice(0, n).map((_, i) => i).filter(i => best.mask & (1 << i)) : [];
}

function playGame(special, rnd) {
  const mkSide = (card) => {
    const deck = shuffle(POOL, rnd).slice(0, 60).map(b => ({ cost: b.cost, atk: b.atk + grade(rnd), hp: b.hp }));
    const hand = deck.splice(0, 5);
    for (let k = 0; k < COPIES; k++) hand.push({ ...card, atk: card.atk + grade(rnd) });
    return { hp: HERO_HP, deck, hand, field: [] };
  };
  const S = split(STD[special.cost]);
  const P = mkSide({ cost: special.cost, ...split(special.sum), fx: special.fx });
  const E = mkSide({ cost: special.cost, ...S });
  let winner = null;
  const alive = side => side.field.filter(u => u.hp > 0);
  const hit = (side, unit, dmg) => { unit.hp -= dmg; if (unit.hp <= 0) side.field = side.field.filter(u => u !== unit); };
  function attack(AS, DS, unit) {
    if (winner || unit.hp <= 0) return;
    const targets = alive(DS);
    if (!targets.length) { DS.hp -= unit.atk; if (DS.hp <= 0 && !winner) winner = DS === P ? 'enemy' : 'player'; return; }
    if (unit.fx?.type === 'sweep') { const dmg = Math.max(1, Math.ceil(unit.atk * unit.fx.value / 100)); targets.forEach(t => hit(DS, t, dmg)); return; }
    hit(DS, targets[0], unit.atk);
  }
  function half(Sd, F, round, maxMana) {
    if (round >= 2) {
      if (!Sd.deck.length) { winner = Sd === P ? 'enemy' : 'player'; return; }
      const c = Sd.deck.shift(); if (Sd.hand.length < HAND_LIMIT) Sd.hand.push(c);
    }
    let mana = maxMana;
    for (let guard = 0; guard < 12; guard++) {
      const picks = plan(Sd.hand, mana, FIELD_LIMIT - Sd.field.length);
      if (!picks.length) break;
      const card = Sd.hand.splice(picks[0], 1)[0]; mana -= card.cost;
      const unit = { ...card }; Sd.field.push(unit);
      if (unit.fx?.type === 'barrage') alive(F).forEach(t => hit(F, t, unit.fx.value));
    }
    Sd.field.sort((a, b) => (a.atk - a.hp * 0.5) - (b.atk - b.hp * 0.5));
    Sd.field.slice().forEach(u => attack(Sd, F, u));
  }
  let first = 'player', round = 1;
  while (!winner && round <= ROUND_CAP) {
    const maxMana = Math.min(MANA_CAP, START_MANA + round - 1);
    if (first === 'player') { half(P, E, round, maxMana); if (!winner) half(E, P, round, maxMana); }
    else { half(E, P, round, maxMana); if (!winner) half(P, E, round, maxMana); }
    if (winner) break;
    first = P.hp !== E.hp ? (P.hp < E.hp ? 'player' : 'enemy') : (P.field.length !== E.field.length ? (P.field.length < E.field.length ? 'player' : 'enemy') : 'player');
    round++;
  }
  return winner === 'player' ? 1 : winner === 'enemy' ? 0 : 0.5;
}

const rnd = makeRng(SEED);
const rate = (special, games = GAMES) => { let w = 0; for (let i = 0; i < games; i++) w += playGame(special, rnd); return w / games; };
const parseFx = text => { if (!text || text === 'none') return null; const [type, value] = String(text).split(':'); return { type, value: Number(value) }; };
const pct = x => (x * 100).toFixed(1).padStart(5) + '%';

console.log(`카드 풀 ${POOL.length}장 · 코스트별 표준 능력치 합: ` + Object.keys(STD).sort((a, b) => a - b).map(k => `${k}:${STD[k].toFixed(1)}`).join(' '));
const costs = args.cost ? [Number(args.cost)] : [5, 6, 7, 8, 9];
for (const cost of costs) {
  const fx = parseFx(args.effect);
  if (args.solve) {
    // 능력치 합을 줄여가며 50%에 가장 가까운 합을 찾는다
    const base = STD[cost]; let best = null;
    for (let sum = Math.round(base * 0.45); sum <= Math.round(base * 1.25); sum += 1) {
      const r = rate({ cost, sum, fx }, Math.round(GAMES / 2)); if (!best || Math.abs(r - 0.5) < Math.abs(best.r - 0.5)) best = { sum, r };
    }
    console.log(`코스트 ${cost} ${args.effect}: 표준 ${base.toFixed(1)} → 균형 능력치 합 ${best.sum} (승률 ${pct(best.r)}, 표준 대비 ${(best.sum / base * 100).toFixed(0)}%)`);
  } else {
    const effects = fx ? [fx] : [null, { type: 'barrage', value: 2 }, { type: 'barrage', value: 3 }, { type: 'sweep', value: 50 }, { type: 'sweep', value: 70 }];
    for (const e of effects) {
      const sum = Number(args.sum) || Math.round(STD[cost]);
      console.log(`코스트 ${cost} 능력치합 ${sum} ${e ? e.type + ':' + e.value : '효과 없음'} → 내 승률 ${pct(rate({ cost, sum, fx: e }))}`);
    }
  }
}
