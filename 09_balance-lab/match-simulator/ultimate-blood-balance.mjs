#!/usr/bin/env node
/**
 * 혈마나 궁극기 밸런스 시뮬레이터 (헤드리스).
 *
 * 한쪽 시작 손패에만 마법 K장을 추가로 주고() 상대는 마법 없이 대칭 대전을 시켜, 그 마법이 주는 승률 이득을 잰다.
 * 같은 코스트 구간에서 데미지를 바꿔가며 이득이 목표(기본 +4%p)가 되는 데미지를 찾는다.
 *
 * 마법 유형: board(아군 포함 전체 유닛) · aoe(적 전체 유닛) · single(적 가장 강한 유닛) · chain(적 공격력 상위 3장에 d, d-1, d-2 피해) · wipe(양쪽 필드 전체 파괴, --eval wipe:코스트:0:대기턴수)
 * 규칙: 실제 게임처럼 세트한 마법은 '다음 내 필드 시작'에 발동한다(세트 시점에 마나를 낸다).
 * AI: 세트 시점의 예상 순이득(적 손실 − 아군 손실)이 코스트×0.9 이상일 때만 세트한다.
 * 한계: 소환사 직접 피해 마법은 소환사 체력이 승패를 거의 바꾸지 못하는 모델이라 다루지 않는다. 마법/함정의 부가 효과(동결·화상)는 무시한다.
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

function playGame(ult, rnd) {
  // 양쪽 모두 같은 궁극기를 장착한다. 내 쪽(P)만 체력 BLOOD를 내고 'N턴부터'·재사용 대기를 무시하는 혈마나 발동을 쓸 수 있다.
  const mkSide = () => { const deck = shuffle(POOL, rnd).slice(0, 60).map(b => ({ cost: b.cost, atk: b.atk + grade(rnd), hp: b.hp })); const hand = deck.splice(0, 5); return { hp: HERO_HP, deck, hand, field: [], lastUlt: -99 }; };
  const P = mkSide(), E = mkSide();
  let winner = null;
  const alive = side => side.field.filter(u => u.hp > 0);
  const hit = (side, unit, dmg) => { unit.hp -= dmg; if (unit.hp <= 0) side.field = side.field.filter(u => u !== unit); };
  const loss = (u, d) => (d >= u.hp ? value(u) : value(u) * (d / u.hp) * 0.5);
  const lose = side => { if (side.hp <= 0 && !winner) winner = side === P ? 'enemy' : 'player'; };
  const condOk = (S, F) => ult.type === 'hero' ? F.hp <= 75 : alive(F).length >= (ult.type === 'thunder' ? 1 : 2);
  const gain = (S, F) => ult.type === 'hero' ? ult.dmg * 0.6 : alive(F).reduce((a, u) => a + loss(u, ult.dmg), 0) + (ult.type === 'thunder' ? ult.dmg * 0.6 : 0);
  function fire(S, F) { if (ult.type === 'hero') F.hp -= ult.dmg; else { alive(F).forEach(u => hit(F, u, ult.dmg)); if (ult.type === 'thunder') F.hp -= ult.dmg; } lose(F); }
  function attack(AS, DS, unit) {
    if (winner || unit.hp <= 0) return;
    const targets = alive(DS);
    if (!targets.length) { DS.hp -= unit.atk; lose(DS); return; }
    hit(DS, targets[0], unit.atk);
  }
  function half(S, F, round, maxMana) {
    if (round >= 2) {
      if (!S.deck.length) { winner = S === P ? 'enemy' : 'player'; return; }
      const c = S.deck.shift(); if (S.hand.length < HAND_LIMIT) S.hand.push(c);
    }
    let mana = maxMana;
    const normalOpen = round >= ult.minTurn && round >= S.lastUlt + ULT_COOLDOWN;
    if (mana >= ult.cost && condOk(S, F)) {
      const g = gain(S, F);
      if (normalOpen && g >= ult.cost * 0.9) { mana -= ult.cost; S.lastUlt = round; fire(S, F); }
      else if (!normalOpen && S === P && BLOOD > 0 && S.hp > BLOOD && g >= ult.cost * 0.9 + BLOOD * THR) { mana -= ult.cost; S.hp -= BLOOD; S.lastUlt = round; fire(S, F); }
    }
    if (winner) return;
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

const ULT_COOLDOWN = 3;
const BLOOD_LIST = String(args.blood ?? '0,15,25,40').split(',').map(Number), THR = Number(args.thr ?? 0.3);
let BLOOD = 0;
const rnd = makeRng(SEED);
const rate = (ult, games = GAMES) => { let w = 0; for (let i = 0; i < games; i++) w += playGame(ult, rnd); return w / games; };
const pct = x => (x * 100).toFixed(1).padStart(5) + '%';
console.log(`혈마나 궁극기 · ${GAMES}판/항목 · AI 발동 기준: 예상 이득 ≥ 마나×0.9 + 체력×${THR}\n(혈마나 0 = 혈마나 없음 → 50%에 가까워야 정상)`);
// 일반 카드(코스트 4: 마나 6·피해 8, 6턴부터)와 강한 카드(코스트 6: 마나 10·피해 10, 8턴부터)
for (const ult of [
  { type: 'aoe', cost: 6, dmg: 8, minTurn: 6 }, { type: 'aoe', cost: 10, dmg: 10, minTurn: 8 },
  { type: 'thunder', cost: 6, dmg: 8, minTurn: 6 }, { type: 'hero', cost: 7, dmg: 12, minTurn: 6 },
]) {
  console.log(`[${ult.type} 마나 ${ult.cost} 피해 ${ult.dmg} ${ult.minTurn}턴부터]`);
  console.log('  ' + BLOOD_LIST.map(b => { BLOOD = b; return `혈마나 ${b}: ${pct(rate(ult))}`; }).join('   '));
}
