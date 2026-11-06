const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

function loadQueue() {
  const start = html.indexOf('const FX_PRIORITY=');
  const endMark = 'function fxAwaitingChoice(){return !!fxActive&&fxActive.hold===0;}';
  const src = html.slice(start, html.indexOf(endMark) + endMark.length);
  let now = 0; const timers = [];
  const api = new Function('sandbox', `
    const {setTimeout, clearTimeout, performance, console} = sandbox;
    ${src}
    return {fxPresent, fxRelease, fxClear, fxBusy, fxAwaitingChoice};
  `)({
    performance: {now: () => now},
    setTimeout: (fn, ms) => {const t = {fn, at: now + (ms||0), dead: false}; timers.push(t); return t;},
    clearTimeout: t => {if (t) t.dead = true;},
    console,
  });
  api.advance = ms => {
    const target = now + ms;
    for (;;) {
      const due = timers.filter(t => !t.dead && t.at <= target).sort((a,b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at; due.dead = true; due.fn();
    }
    now = target;
  };
  return api;
}

test('복수자 강림은 연출 큐를 탄다', () => {
  /* 큐 밖에 있으면 큐가 직렬화할 수 없어 오라 각성 모달이 위에 덮인다. */
  assert.ok(html.includes("fxPresent('avenger-arrival:'+partner.name"), '강림은 fxPresent를 거쳐야 한다');
  assert.ok(html.includes('hold:2850}'), '연출 길이를 큐에 알려야 한다');
  const fn = html.slice(html.indexOf("fxPresent('avenger-arrival:'+partner.name"));
  assert.ok(fn.slice(0, 1800).includes('priority:FX_PRIORITY.ultimate'), '사망 컷과 같은 우선순위여야 FIFO로 순서가 보장된다');
  assert.ok(!html.includes("fx.querySelector('.avenger-copy q').textContent=source.name+'의 복수를 하고 말겠어!';document.body.appendChild(fx)"), '큐를 우회해 직접 띄우던 경로는 없어야 한다');
});

test('강림이 끊겨도 유닛이 안 보이는 채로 남지 않는다', () => {
  /* 강림 중 unit.visibility='hidden'으로 숨기므로, cleanup에서 반드시 되돌려야 한다. */
  const fn = html.slice(html.indexOf("fxPresent('avenger-arrival:'+partner.name"));
  const cleanup = fn.slice(fn.indexOf('return ()=>{'), fn.indexOf('{priority:FX_PRIORITY.ultimate'));
  assert.ok(cleanup.includes("unit.style.visibility=''"), 'cleanup에서 유닛을 되살려야 한다');
  assert.ok(cleanup.includes('clearTimeout(landTimer)') && cleanup.includes('clearTimeout(sfxTimer)'), '내부 타이머도 정리해야 한다');
});

test('강림도 필드 오버레이로 등록된다', () => {
  const selector = html.slice(html.indexOf('const FIELD_OVERLAYS='));
  assert.ok(selector.slice(0, 500).includes('.avenger-arrival'), 'FIELD_OVERLAYS 등록 (CLAUDE.md 규칙)');
});

test('오라 각성 모달은 재생 중인 강림을 덮지 않고 기다린다', () => {
  const q = loadQueue();
  const live = [];
  const show = (name, pri, hold) => q.fxPresent(name, () => {
    live.push(name); return () => live.splice(live.indexOf(name), 1);
  }, {priority: pri, hold});
  show('avenger-arrival', 100, 2850);
  show('aura-awaken-choice', 200, 0);
  assert.deepEqual(live, ['avenger-arrival'], '모달이 강림을 덮으면 안 된다');
  q.advance(2849);
  assert.deepEqual(live, ['avenger-arrival'], '강림이 끝나기 전에는 모달이 뜨지 않는다');
  q.advance(2);
  assert.deepEqual(live, ['aura-awaken-choice'], '강림이 끝난 뒤 각성 선택이 뜬다');
});

test('사망 컷 → 강림 순서가 뒤집히지 않는다 (같은 우선순위 FIFO)', () => {
  const q = loadQueue();
  const order = [];
  const show = (name, hold) => q.fxPresent(name, () => {
    order.push(name); return () => {};
  }, {priority: 100, hold});
  show('ultimate-spent-death', 3000);
  show('avenger-arrival', 2850);
  q.advance(10000);
  assert.deepEqual(order, ['ultimate-spent-death', 'avenger-arrival'], '사망 컷이 먼저 재생돼야 한다');
});

test('강림·사망 컷·각성이 한 화면에 겹치지 않는다', () => {
  const q = loadQueue();
  let onScreen = 0, peak = 0;
  const show = (name, pri, hold) => q.fxPresent(name, () => {
    onScreen++; peak = Math.max(peak, onScreen); return () => {onScreen--;};
  }, {priority: pri, hold});
  show('ultimate-spent-death', 100, 3000);
  show('avenger-arrival', 100, 2850);
  show('aura-awaken-choice', 200, 0);
  show('magic', 60, 1200);
  q.advance(6000);
  q.fxRelease();
  q.advance(4000);
  assert.equal(peak, 1, '동시에 1개만 보여야 한다 (최대 ' + peak + '개였음)');
});

test('각성 모달이 이미 떠 있으면 강림은 모달 뒤에 깔리지 않고 대기한다', () => {
  /* 체력이 먼저 80 이하로 떨어져 모달이 열린 뒤 소진자가 죽는 순서.
     z-index가 430 < 520이라 큐가 막아주지 않으면 강림이 모달 뒤에서 묻힌다. */
  const q = loadQueue();
  const live = [];
  const show = (name, pri, hold) => q.fxPresent(name, () => {
    live.push(name); return () => live.splice(live.indexOf(name), 1);
  }, {priority: pri, hold});
  show('aura-awaken-choice', 200, 0);
  show('avenger-arrival', 100, 2850);
  assert.deepEqual(live, ['aura-awaken-choice'], '강림이 모달 뒤로 들어가면 안 된다');
  q.advance(10000);
  assert.deepEqual(live, ['aura-awaken-choice'], '선택 전까지 강림은 시작되지 않는다');
  q.fxRelease();
  assert.deepEqual(live, ['avenger-arrival'], '선택 후 강림이 온전히 재생된다');
});
