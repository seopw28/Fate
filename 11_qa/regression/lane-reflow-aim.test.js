const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

/* 상대 카드가 죽으면 남은 카드가 빈 자리를 즉시 메우며 옆으로 밀린다. 그 순간 다른 카드가
   공격받고 있으면 맞는 카드가 미끄러지는 중에 맞아, 공격선이 엉뚱한 자리를 가리키는 것처럼
   보였다 (2026-11-07 실측: 조준 302px → 공격 중 141px). 피해는 정상이고 보이는 것만 어긋났다. */

test('전장 카드 제거는 교전이 멎은 뒤로 미룬다', () => {
  assert.ok(html.includes('function removeFieldUnit(unit)'), '제거를 한 곳으로 모아야 한다');
  const at = html.indexOf('function removeFieldUnit(unit)');
  const fn = html.slice(at, at + 600);
  /* 핵심 불변식: 교전이 끝나는 시각까지 기다렸다가 뺀다. */
  assert.ok(/combatBusyUntil-performance\.now\(\)/.test(fn),
    '교전이 끝나는 시각을 기준으로 기다려야 한다');
  assert.ok(/setTimeout\(\(\)=>unit\.remove\(\)/.test(fn), '기다린 뒤에 실제로 제거해야 한다');
  /* 교전 중이 아니면 기다릴 이유가 없다 — 평소 흐름까지 느려지면 안 된다. */
  assert.ok(/if\(!wait\)\{unit\.remove\(\);return;\}/.test(fn),
    '교전 중이 아니면 즉시 제거해 평소 속도를 유지한다');
});

test('전투 사망 경로가 즉시 제거로 되돌아가지 않는다', () => {
  /* defender.remove() 를 직접 부르면 공격 중에 자리가 비어 같은 어긋남이 재발한다. */
  assert.ok(!/triggerDeathrattle\(defender\);defender\.remove\(\)/.test(html),
    '전투 사망은 removeFieldUnit 을 거쳐야 한다');
  assert.ok(/triggerDeathrattle\(defender\);removeFieldUnit\(defender\)/.test(html),
    '방어자 사망이 지연 제거를 써야 한다');
  assert.ok(/triggerDeathrattle\(attacker\);setTimeout\(\(\)=>removeFieldUnit\(attacker\)/.test(html),
    '맞불 사망도 지연 제거를 써야 한다');
});

test('상대 전장 재정렬은 순간이동이 아니라 미끄러진다', () => {
  const at = html.indexOf('function arrangeEnemyLane(lane)');
  assert.ok(at > 0, '재정렬 함수가 있어야 한다');
  const fn = html.slice(at, at + 1100);
  assert.ok(/unit\.animate\(/.test(fn), '옛 자리에서 새 자리로 미끄러져야 한다');
  assert.ok(/getBoundingClientRect\(\)\.left/.test(fn), '이동 거리를 실제 좌표에서 받아야 한다');
  /* 순서가 그대로면 건드리지 않아야 쓸데없는 흔들림이 없다. */
  assert.ok(/every\(\(unit,i\)=>unit===units\[i\]\)\)return 0/.test(fn),
    '순서가 같으면 재배치하지 않는다');
  assert.ok(/prefers-reduced-motion/.test(fn), '모션 최소화 설정을 존중해야 한다');
});

test('재정렬이 끝난 뒤에 교전을 시작한다', () => {
  assert.ok(/const laneSettle=arrangeEnemyLane\(lane\);/.test(html),
    '재배치에 걸리는 시간을 받아야 한다');
  assert.ok(/if\(laneSettle\)await new Promise\(resolve=>setTimeout\(resolve,laneSettle\)\)/.test(html),
    '그 시간만큼 기다린 뒤 교전을 시작해야 한다');
});
