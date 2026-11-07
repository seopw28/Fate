/* 연출 큐 동작 검증.
   문자열 매칭이 아니라 큐 로직을 실제로 실행해 "동시에 두 개 이상이 화면에 보이지 않는다"를 증명한다.
   dist 번들에서 큐 구현부를 떼어내 평가하므로 구현이 바뀌면 이 테스트가 먼저 깨진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

/* dist 에서 연출 큐 블록만 추출해 독립 실행한다. */
function loadQueue() {
  const start = html.indexOf('const FX_PRIORITY=');
  const endMarker = 'function fxBusy(){return !!fxActive||fxQueue.length>0;}';
  const end = html.indexOf(endMarker);
  assert.ok(start > -1, '연출 큐 구현(FX_PRIORITY)이 번들에 있어야 한다');
  assert.ok(end > start, '연출 큐 구현(fxBusy)이 번들에 있어야 한다');
  const source = html.slice(start, end + endMarker.length);

  const timers = [];
  let clock = 0;
  const sandbox = {
    performance: { now: () => clock },
    matchMedia: () => ({ matches: false }),
    console,
    setTimeout: (fn, ms) => { const t = { fn, at: clock + (ms || 0), dead: false }; timers.push(t); return t; },
    clearTimeout: (t) => { if (t) t.dead = true; },
  };
  const factory = new Function(
    'performance', 'matchMedia', 'console', 'setTimeout', 'clearTimeout',
    source + '; return {fxPresent,fxRelease,fxClear,fxBusy,FX_PRIORITY,getActive:()=>fxActive};'
  );
  const api = factory(
    sandbox.performance, sandbox.matchMedia, sandbox.console,
    sandbox.setTimeout, sandbox.clearTimeout
  );
  /* 가상 시계를 ms 만큼 진행시키며 만료된 타이머를 순서대로 실행한다. */
  api.advance = (ms) => {
    const target = clock + ms;
    for (;;) {
      const due = timers.filter(t => !t.dead && t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      clock = due.at;
      due.dead = true;
      due.fn();
    }
    clock = target;
  };
  return api;
}

test('동시에 올라온 두 연출은 화면에 하나씩만 보인다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  const show = (name, priority, hold) =>
    q.fxPresent(name, () => { onScreen.add(name); return () => onScreen.delete(name); }, { priority, hold });

  show('magic', q.FX_PRIORITY.magic, 1500);
  show('cinematic', q.FX_PRIORITY.cinematic, 1700);
  assert.equal(onScreen.size, 1, '두 번째 연출은 대기해야 한다');
  assert.ok(onScreen.has('magic'), '먼저 올라온 연출이 먼저 보인다');

  q.advance(1500);
  assert.equal(onScreen.size, 1, '교체 시점에도 하나만 보인다');
  assert.ok(onScreen.has('cinematic'), '앞 연출이 끝나면 다음이 올라온다');

  q.advance(1700);
  assert.equal(onScreen.size, 0, '모두 끝나면 화면이 비어야 한다');
});

test('아주르 썬더폴과 마법카드가 같은 순간에 발현되어도 겹치지 않는다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  const show = (name, priority, hold) =>
    q.fxPresent(name, () => { onScreen.add(name); return () => onScreen.delete(name); }, { priority, hold });

  show('cinematic:lightning', q.FX_PRIORITY.cinematic, 1700);
  show('magic:역전', q.FX_PRIORITY.magic, 1500);
  show('trap:함정', q.FX_PRIORITY.trap, 2300);

  const seen = [];
  for (let i = 0; i < 8; i++) {
    assert.ok(onScreen.size <= 1, '어느 시점에도 두 개 이상 보이면 안 된다 (step ' + i + ')');
    if (onScreen.size === 1) seen.push([...onScreen][0]);
    q.advance(800);
  }
  assert.ok(seen.includes('magic:역전'), '마법 연출이 실제로 재생되어야 한다');
  assert.ok(seen.includes('cinematic:lightning'), '썬더폴 연출이 실제로 재생되어야 한다');
});

test('궁극기는 사소한 배너 뒤에서 기다리지 않고 선점한다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  const show = (name, priority, hold) =>
    q.fxPresent(name, () => { onScreen.add(name); return () => onScreen.delete(name); }, { priority, hold });

  show('banner', q.FX_PRIORITY.banner, 1400);
  assert.ok(onScreen.has('banner'));
  show('ultimate', q.FX_PRIORITY.ultimate, 2250);
  assert.equal(onScreen.size, 1, '선점 중에도 하나만 보인다');
  assert.ok(onScreen.has('ultimate'), '궁극기가 즉시 끼어들어야 한다');
  assert.ok(!onScreen.has('banner'), '선점된 배너는 화면에서 내려가야 한다');
});

test('같은 중요도는 도착 순서를 지킨다', () => {
  const q = loadQueue();
  const order = [];
  const show = (name) =>
    q.fxPresent(name, () => { order.push(name); return () => {}; }, { priority: q.FX_PRIORITY.magic, hold: 1000 });

  show('first'); show('second'); show('third');
  q.advance(3000);
  assert.deepEqual(order, ['first', 'second', 'third'], 'FIFO 순서가 유지돼야 한다');
});

test('더 중요한 연출은 덜 중요한 대기열보다 먼저 올라온다', () => {
  const q = loadQueue();
  const order = [];
  const show = (name, priority) =>
    q.fxPresent(name, () => { order.push(name); return () => {}; }, { priority, hold: 1000 });

  show('occupying', q.FX_PRIORITY.magic);
  show('banner', q.FX_PRIORITY.banner);
  show('guardian', q.FX_PRIORITY.guardian - 1);
  q.advance(4000);
  assert.deepEqual(order, ['occupying', 'guardian', 'banner'], '대기열은 중요도 순으로 비워진다');
});

test('전투가 끝나면 대기 중인 연출까지 모두 사라진다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  const show = (name) =>
    q.fxPresent(name, () => { onScreen.add(name); return () => onScreen.delete(name); }, { priority: q.FX_PRIORITY.magic, hold: 2000 });

  const played = [];
  const track = (name) =>
    q.fxPresent(name, () => { onScreen.add(name); played.push(name); return () => onScreen.delete(name); }, { priority: q.FX_PRIORITY.magic, hold: 2000 });
  track('a'); track('b'); track('c');
  assert.deepEqual(played, ['a'], '처음에는 첫 연출만 재생된다');
  q.fxClear();
  assert.equal(onScreen.size, 0, '화면이 즉시 비워져야 한다');
  assert.equal(q.fxBusy(), false, '대기열도 비어야 한다');
  q.advance(5000);
  assert.equal(onScreen.size, 0, '버려진 연출이 나중에 되살아나면 안 된다');
  assert.deepEqual(played, ['a'], '전투 종료 후 대기 중이던 연출이 뒤늦게 재생되면 안 된다');
});

test('연출이 끝나면 대기 중인 모든 연출이 빠짐없이 재생된다', () => {
  const q = loadQueue();
  const played = [];
  for (let i = 0; i < 5; i++) {
    q.fxPresent('fx' + i, () => { played.push(i); return () => {}; }, { priority: q.FX_PRIORITY.magic, hold: 500 });
  }
  q.advance(5000);
  assert.equal(played.length, 5, '큐에 넣은 연출이 유실되면 안 된다');
  assert.equal(q.fxBusy(), false);
});

test('start() 가 예외를 던져도 큐가 멈추지 않는다', () => {
  const q = loadQueue();
  const played = [];
  q.fxPresent('broken', () => { throw new Error('boom'); }, { priority: q.FX_PRIORITY.magic, hold: 500 });
  q.fxPresent('next', () => { played.push('next'); return () => {}; }, { priority: q.FX_PRIORITY.magic, hold: 500 });
  q.advance(1500);
  assert.deepEqual(played, ['next'], '앞 연출이 깨져도 다음 연출은 재생돼야 한다');
});

test('전투 종료로 버려진 연출을 기다리던 턴 진행도 멈추지 않고 풀린다', async () => {
  const q = loadQueue();
  /* 마법 발동은 fxPresent 의 Promise 를 await 해 턴 진행을 잇는다.
     fxClear 가 대기열 entry 를 resolve 하지 않으면 그 await 가 영구히 멈춘다. */
  q.fxPresent('occupying', () => () => {}, { priority: q.FX_PRIORITY.magic, hold: 2000 });
  const pending = q.fxPresent('queued', () => () => {}, { priority: q.FX_PRIORITY.magic, hold: 2000 });
  q.fxClear();
  const settled = await Promise.race([pending, new Promise(r => setImmediate(() => r('STUCK')))]);
  assert.notEqual(settled, 'STUCK', '버려진 연출의 Promise 는 반드시 resolve 돼야 한다');
  assert.equal(settled, 'cleared');
});

test('선택 연출(오라 각성)은 유저가 고를 때까지 화면을 붙잡는다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  q.fxPresent('aura-awaken-choice', () => { onScreen.add('choice'); return () => onScreen.delete('choice'); },
    { priority: q.FX_PRIORITY.choice, hold: 0 });

  assert.ok(onScreen.has('choice'));
  q.advance(60000);
  assert.ok(onScreen.has('choice'), '시간이 아무리 지나도 스스로 사라지면 안 된다');
  assert.equal(q.fxBusy(), true, '결정 전까지 필드는 멈춘 상태여야 한다');

  q.fxRelease();
  assert.equal(onScreen.size, 0, '선택하면 내려간다');
  assert.equal(q.fxBusy(), false, '선택 후 필드가 다시 움직인다');
});

test('선택을 기다리는 동안 다른 연출은 끼어들지 못하고 결정 후에 재생된다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  const show = (name, priority, hold) =>
    q.fxPresent(name, () => { onScreen.add(name); return () => onScreen.delete(name); }, { priority, hold });

  show('choice', q.FX_PRIORITY.choice, 0);
  show('ultimate', q.FX_PRIORITY.ultimate, 2250);
  q.advance(5000);
  assert.ok(onScreen.has('choice'), '궁극기도 선택 연출을 끊지 못한다');
  assert.equal(onScreen.size, 1, '선택 중에는 하나만 보인다');

  q.fxRelease();
  assert.ok(onScreen.has('ultimate'), '결정이 끝나면 대기하던 연출이 이어진다');
  q.advance(2250);
  assert.equal(onScreen.size, 0);
});

test('선택 연출이 대기열에 있으면 재생 중인 연출을 끊지 않고 기다린다', () => {
  const q = loadQueue();
  const onScreen = new Set();
  const show = (name, priority, hold) =>
    q.fxPresent(name, () => { onScreen.add(name); return () => onScreen.delete(name); }, { priority, hold });

  show('magic', q.FX_PRIORITY.magic, 1500);
  show('choice', q.FX_PRIORITY.choice, 0);
  assert.ok(onScreen.has('magic'), '재생 중인 마법 연출이 잘리면 안 된다');
  q.advance(1500);
  assert.ok(onScreen.has('choice'), '마법이 끝난 뒤 선택 연출이 올라온다');
});

test('연출이 아직 끝나지 않았으면 미뤄둔 교전이 그대로 재개되면 안 된다', () => {
  /* fieldAttack 게이트는 연출이 점유 중일 때 교전을 미룬다.
     그런데 재시도 시점에 점유가 아직 안 풀렸을 수 있다 — 6초짜리 최후의 저항이나
     유저 입력을 기다리는 각성 선택창은 160ms 뒤에도 그대로 떠 있다.
     재시도가 점유를 다시 확인하지 않으면 연출 위로 교전이 겹친다. */
  const gate = html.slice(html.indexOf('fieldAttack=function(...args)'), html.indexOf('const selectCardBeforeComebackRush'));
  const retry = gate.slice(gate.indexOf('setTimeout(()=>{'), gate.indexOf('},wait)'));
  assert.ok(
    retry.includes('fxBusy()') || retry.includes('fxAwaitingChoice()'),
    '재시도 시점에 연출 점유를 다시 확인해야 한다 (고정 대기 후 무조건 공격 금지)'
  );
});

/* 2026-11-08 PM 피드백: 공격받은 소진자는 '공격 적중 → 소진자 반격 → 죽음 컷씬 → 제거' 순서로 보여야 한다.
   판정(복수자 등록·전역 도발 해제)은 적중 시점 그대로이고 컷씬 연출만 반격 뒤로 미룬다. */
test('소진자 죽음 컷씬은 반격 연출 뒤에 재생된다 (판정은 적중 시점 그대로)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes("if(target.dataset.deferDeathCut==='true')registerUltimateSpentDeath("), '미룬 컷도 복수자 등록은 즉시');
  assert.ok(html.includes("else showUltimateSpentDeath(target);}else"), '반격이 없는 피해(마법·광역)는 바로 컷씬');
  assert.ok(html.includes("const deferCut=defender.dataset.ultimateSpent==='true'&&!options.noCounter&&returnDamage>0;"), '반격이 있는 공격만 컷을 미룬다');
  assert.ok(html.includes('playPendingCut(combatMs(300));}});},COMBAT_TIMING.counterDelay);'), '반격 적중 뒤에 컷씬을 띄운다');
  assert.ok(html.includes("if(defender.dataset.deferDeathCut==='true')playPendingCut();},combatMs(COMBAT_TIMING.counterDelay)+4000)"), '반격이 끊겨도 컷씬은 반드시 재생된다');
});
