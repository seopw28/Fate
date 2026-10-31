#!/usr/bin/env node
/**
 * 피해 마법 코스트/데미지 밸런스 시뮬레이터 (헤드리스).
 *
 * 한쪽 시작 손패에만 마법 K장을 추가로 주고(--replace면 덱의 챔피언 K장과 교체) 상대는 마법 없이 대칭 대전을 시켜, 그 마법이 주는 승률 이득을 잰다.
 * 같은 코스트 구간에서 데미지를 바꿔가며 이득이 목표(기본 +4%p)가 되는 데미지를 찾는다.
 *
 * 마법 유형: board(아군 포함 전체 유닛) · aoe(적 전체 유닛) · single(적 가장 강한 유닛)
 * 규칙: 실제 게임처럼 세트한 마법은 '다음 내 필드 시작'에 발동한다(세트 시점에 마나를 낸다).
 * AI: 세트 시점의 예상 순이득(적 손실 − 아군 손실)이 코스트×0.9 이상일 때만 세트한다.
 * 한계: 영웅 직접 피해 마법은 영웅 체력이 승패를 거의 바꾸지 못하는 모델이라 다루지 않는다. 마법/함정의 부가 효과(동결·화상)는 무시한다.
 *
 * 사용: node 09_balance-lab/match-simulator/spell-balance.mjs [--games 8000] [--seed 5] [--copies 2] [--type board|aoe|single] [--target 0.535] [--replace]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, i, all) => (arg.startsWith('--') ? [...acc, [arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
const GAMES = Number(args.games) || 8000, SEED = Number(args.seed) || 5, COPIES = Number(args.copies) || 2, TARGET = Number(args.target) || 0.535;

const sandbox = { globalThis: {} };
vm.runInNewContext(readFileSync(resolve(root, 'dist/runtime/cards.js'), 'utf8'), sandbox);
const POOL = sandbox.globalThis.PrimalCardSet.cards.filter(c => c.cardType === 'champion' && c.collectible !== false && c.releaseState !== 'prototype').map(c => ({ cost: c.cost, atk: c.stats.attack, hp: c.stats.health }));

function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const HERO_HP = 100, MANA_CAP = 10, START_MANA = 3, FIELD_LIMIT = 6, HAND_LIMIT = 8, ROUND_CAP = 40;
const grade = rnd => { const r = rnd(); return r < 0.15 ? 2 : r < 0.5 ? 1 : 0; };
const value = c => c.atk + c.hp * 0.7;
function plan(hand, mana, slots) {
  let best = null; const champs = hand.map((c, i) => [c, i]).filter(([c]) => !c.spell).slice(0, 12);
  for (let mask = 1; mask < (1 << champs.length); mask++) {
    let cost = 0, count = 0, v = 0;
    for (let i = 0; i < champs.length; i++) if (mask & (1 << i)) { cost += champs[i][0].cost; count++; v += value(champs[i][0]); }
    if (cost > mana || count > slots) continue;
    const score = v + cost * 0.35;
    if (!best || score > best.score) best = { score, mask };
  }
  return best ? champs.map(([, idx], i) => idx).filter((_, i) => best.mask & (1 << i)) : [];
}

function playGame(spell, rnd) {
  const mkSide = (withSpell) => {
    const deck = shuffle(POOL, rnd).slice(0, 60).map(b => ({ cost: b.cost, atk: b.atk + grade(rnd), hp: b.hp }));
    const card = { spell: true, cost: spell.cost, dmg: spell.dmg, type: spell.type };
    // 기본(hand): 실제 게임처럼 마법은 덱이 아니라 시작 손패에 '추가'로 주어진다. --replace: 덱의 챔피언 K장을 마법으로 교체(카드 한 장의 가치 비교용)
    if (withSpell && args.replace) for (let k = 0; k < COPIES; k++) deck[5 + Math.floor(rnd() * 55)] = { ...card };
    const hand = deck.splice(0, 5);
    if (withSpell && !args.replace) for (let k = 0; k < COPIES; k++) hand.push({ ...card });
    return { hp: HERO_HP, deck, hand, field: [], pending: [] };
  };
  const P = mkSide(true), E = mkSide(false);
  let winner = null;
  const alive = side => side.field.filter(u => u.hp > 0);
  const hit = (side, unit, dmg) => { unit.hp -= dmg; if (unit.hp <= 0) side.field = side.field.filter(u => u !== unit); };
  const loss = (u, d) => (d >= u.hp ? value(u) : value(u) * (d / u.hp) * 0.5);
  function netValue(S, F, sp) {
    const enemy = alive(F), ally = alive(S);
    if (sp.type === 'board') return enemy.reduce((a, u) => a + loss(u, sp.dmg), 0) - ally.reduce((a, u) => a + loss(u, sp.dmg), 0);
    if (sp.type === 'aoe') return enemy.reduce((a, u) => a + loss(u, sp.dmg), 0);
    const t = enemy.slice().sort((a, b) => b.atk - a.atk)[0];
    return t ? loss(t, sp.dmg) : 0;
  }
  function resolve(S, F, sp) {
    if (sp.type === 'board') { [...alive(F)].forEach(u => hit(F, u, sp.dmg)); [...alive(S)].forEach(u => hit(S, u, sp.dmg)); }
    else if (sp.type === 'aoe') [...alive(F)].forEach(u => hit(F, u, sp.dmg));
    else { const t = alive(F).sort((a, b) => b.atk - a.atk)[0]; if (t) hit(F, t, sp.dmg); }
  }
  function attack(AS, DS, unit) {
    if (winner || unit.hp <= 0) return;
    const targets = alive(DS);
    if (!targets.length) { DS.hp -= unit.atk; if (DS.hp <= 0 && !winner) winner = DS === P ? 'enemy' : 'player'; return; }
    hit(DS, targets[0], unit.atk);
  }
  function half(S, F, round, maxMana) {
    if (round >= 2) {
      if (!S.deck.length) { winner = S === P ? 'enemy' : 'player'; return; }
      const c = S.deck.shift(); if (S.hand.length < HAND_LIMIT) S.hand.push(c);
      S.pending.splice(0).forEach(sp => resolve(S, F, sp));
    }
    let mana = maxMana;
    for (const card of S.hand.filter(c => c.spell).slice()) {
      if (card.cost <= mana && S.pending.length < 2 && netValue(S, F, card) >= card.cost * 0.9) { mana -= card.cost; S.hand.splice(S.hand.indexOf(card), 1); S.pending.push(card); }
    }
    for (let guard = 0; guard < 12; guard++) {
      const picks = plan(S.hand, mana, FIELD_LIMIT - S.field.length);
      if (!picks.length) break;
      const c = S.hand.splice(picks[0], 1)[0]; mana -= c.cost; S.field.push({ ...c });
    }
    S.field.sort((a, b) => (a.atk - a.hp * 0.5) - (b.atk - b.hp * 0.5));
    S.field.slice().forEach(u => attack(S, F, u));
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
const rate = (spell, games = GAMES) => { let w = 0; for (let i = 0; i < games; i++) w += playGame(spell, rnd); return w / games; };
const pct = x => (x * 100).toFixed(1).padStart(5) + '%';

if (args.eval) {
  // --eval type:cost:dmg,type:cost:dmg  : 지정한 마법들의 승률 이득만 출력
  for (const item of String(args.eval).split(',')) { const [type, cost, dmg] = item.split(':'); console.log(`${type} 코스트 ${cost} 피해 ${dmg}: ${pct(rate({ type, cost: Number(cost), dmg: Number(dmg) }))}`); }
  process.exit(0);
}

const types = args.type ? [String(args.type)] : ['board', 'aoe', 'single'];
console.log(`카드 풀 ${POOL.length}장 · 마법 ${COPIES}장 · ${GAMES}판/항목 · 목표 승률 ${pct(TARGET)} (마법 없는 상대 기준, 마법이 죽은 카드면 50%)\n`);
for (const type of types) {
  console.log(`[${type}] 코스트별 피해량 → 승률`);
  for (const cost of [2, 3, 4, 5, 6]) {
    const row = [];
    let pick = null;
    for (const dmg of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = rate({ type, cost, dmg });
      row.push(`${dmg}:${(r * 100).toFixed(1)}`);
      if (pick === null && r >= TARGET) pick = dmg;
    }
    console.log(`  코스트 ${cost}  ${row.join('  ')}   → 목표 도달 피해 ${pick ?? '8 초과'}`);
  }
  console.log('');
}
