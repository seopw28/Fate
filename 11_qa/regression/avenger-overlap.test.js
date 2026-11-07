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
  /* 강림 중 unit.visibility='hidden'으로 숨기므로, cleanup에서 반드시 되돌려야 한다.
     cleanup 시그니처는 reason 을 받는 형태로 바뀔 수 있어 괄호 안을 고정하지 않는다. */
  const fn = html.slice(html.indexOf("fxPresent('avenger-arrival:'+partner.name"));
  const cleanup = fn.slice(fn.search(/return (?:\(\)|reason|[a-zA-Z]+)=>\{/), fn.indexOf('{priority:FX_PRIORITY.ultimate'));
  assert.ok(cleanup.includes("unit.style.visibility=''"), 'cleanup에서 유닛을 되살려야 한다');
  assert.ok(cleanup.includes('clearTimeout(sfxTimer)'), '예약해둔 타이머는 정리해야 한다');
  /* 전투가 치워진 경우에도 '보이게 되돌리기'는 먼저 해야 한다 — return 보다 앞에 와야 한다. */
  assert.ok(cleanup.indexOf("unit.style.visibility=''") < cleanup.indexOf("reason==='cleared'"), '되돌리기가 조기 반환보다 앞서야 한다');
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

/* 사용자 보고: "등장 컷씬 때문에 광역공격 이펙트를 시각적으로 놓친다".
   고정 3050ms 로 띄우면 컷신이 큐에서 밀렸을 때 피해가 컷신 뒤에 가려진다. */
test('복수 충격파는 등장 컷신이 끝난 뒤에 터진다', () => {
  assert.ok(!html.includes('resolveAvengerArrivalDamage(partner),3050'), '고정 지연으로 되돌리지 말 것');
  assert.ok(!html.includes('resolveEnemyAvengerArrivalDamage(partner),3050'), '상대 쪽도 고정 지연 금지');
  assert.ok(html.includes('afterAvengerArrival(showAvengerArrival(partner,firstUltimateSpec,unit)'), '내 강림은 컷신 종료에 이어 붙인다');
  assert.ok(html.includes('afterAvengerArrival(showAvengerArrival(partner,enemyFirstUltimateSpec,unit)'), '상대 강림도 마찬가지');
  const fn = html.slice(html.indexOf('function afterAvengerArrival'));
  assert.ok(/presented\.then\(fire\)/.test(fn.slice(0, 700)), 'fxPresent 가 끝날 때를 기다려야 한다');
  assert.ok(/reason==='cleared'\)return/.test(fn.slice(0, 700)), '전투가 치워졌으면 피해를 넣지 않는다');
});

test('컷신이 큐에서 밀려도 충격파는 컷신 뒤에 온다', async () => {
  /* 핵심 회귀: 강림 앞에 다른 연출이 있으면 고정 지연은 컷신 '도중'에 터진다. */
  const q = loadQueue();
  const order = [];
  q.fxPresent('앞선 연출', () => {order.push('앞선연출:시작'); return () => order.push('앞선연출:끝');},
    {priority: 40, hold: 2000});
  const arrival = q.fxPresent('avenger-arrival:복수자', () => {order.push('컷신:시작'); return () => order.push('컷신:끝');},
    {priority: 40, hold: 2850});
  arrival.then(reason => {if (reason !== 'cleared') order.push('충격파(' + reason + ')');});

  q.advance(3050);/* 예전 고정 지연 시점 — 이 때는 아직 컷신이 돌고 있어야 한다 */
  await Promise.resolve();
  assert.ok(!order.some(e => e.startsWith('충격파')), '3050ms 에는 아직 터지면 안 된다: ' + order.join(' > '));
  q.advance(5000);
  await Promise.resolve();/* then 은 마이크로태스크라 가상 시계 진행만으론 안 돈다 */
  assert.deepEqual(order, ['앞선연출:시작','앞선연출:끝','컷신:시작','컷신:끝','충격파(done)']);
});

test('전투가 치워지면 충격파는 터지지 않는다', async () => {
  const q = loadQueue();
  const order = [];
  const arrival = q.fxPresent('avenger-arrival:복수자', () => () => order.push('컷신:끝'), {priority: 40, hold: 2850});
  arrival.then(reason => {if (reason !== 'cleared') order.push('충격파');});
  q.advance(100);
  q.fxClear();
  q.advance(5000);
  await Promise.resolve();
  assert.ok(!order.includes('충격파'), '보드가 치워진 뒤에는 피해가 없어야 한다');
});

/* 사용자 보고: "등장을 먼저 하고 컷씬을 보여주면 이미 등장을 다했는데 뒷북치는것 같다".
   컷신 → 등장 순서를 고정한다. */
test('복수자는 컷신이 끝난 뒤에 등장한다', () => {
  const fn = html.slice(html.indexOf('function showAvengerArrival'));
  const head = fn.slice(0, fn.indexOf("fxPresent('avenger-arrival:"));
  assert.ok(head.includes("unit.style.visibility='hidden'"), '큐에 넣기 전에 숨겨야 큐가 밀려도 카드가 안 보인다');
  const body = fn.slice(0, fn.indexOf('{priority:FX_PRIORITY.ultimate'));
  assert.ok(!/setTimeout\([^)]*showAvengerLandingImpact/.test(body), '착지를 컷신 도중 타이머로 띄우지 말 것');
  const cleanup = body.slice(body.search(/return (?:\(\)|reason|[a-zA-Z]+)=>\{/));
  assert.ok(cleanup.includes('showAvengerLandingImpact'), '착지 연출은 컷신이 끝난 뒤(cleanup)에 와야 한다');
});

test('충격파는 착지 연출이 읽힌 뒤에 터진다', () => {
  assert.ok(html.includes('const AVENGER_LANDING_MS=720'), '착지 길이를 상수로 둬야 한다');
  const fn = html.slice(html.indexOf('function afterAvengerArrival'));
  assert.ok(/AVENGER_LANDING_MS\s*\+\s*\d+\)/.test(fn.slice(0, 700)), '충격파는 착지 길이만큼 기다려야 한다');
});

test('컷신이 큐에 밀려도 카드가 먼저 보이지 않는다', async () => {
  /* 핵심 회귀: 숨기기가 start 콜백 안에 있으면 큐 대기 동안 카드가 전장에 그대로 보인다. */
  const q = loadQueue();
  const order = [];
  q.fxPresent('앞선 연출', () => {order.push('앞선연출:시작'); return () => order.push('앞선연출:끝');},
    {priority: 40, hold: 2000});
  order.push('카드 숨김');/* 소스상 fxPresent 호출 전에 숨긴다 */
  const arrival = q.fxPresent('avenger-arrival:복수자', () => {order.push('컷신:시작'); return () => {order.push('컷신:끝'); order.push('카드 등장');};},
    {priority: 40, hold: 2850});
  arrival.then(() => {});
  q.advance(8000);
  await Promise.resolve();
  assert.deepEqual(order, ['앞선연출:시작','카드 숨김','앞선연출:끝','컷신:시작','컷신:끝','카드 등장']);
  assert.ok(order.indexOf('카드 숨김') < order.indexOf('컷신:시작'), '숨김이 컷신 시작보다 앞서야 한다');
  assert.ok(order.indexOf('카드 등장') > order.indexOf('컷신:끝'), '등장은 컷신이 끝난 뒤여야 한다');
});

/* 사용자 요청: 최후의 저항 중앙 컷인을 걷고 복수자 등장에 초점을 맞춘다.
   버프 설명은 작은 토스트로만 남긴다. */
test('최후의 저항은 중앙 컷인 대신 작은 토스트로 알린다', () => {
  assert.ok(!html.includes("class=\"desperate-notice\"") && !html.includes("'desperate-notice'"), '중앙 컷인을 되살리지 말 것');
  assert.ok(!html.includes('dn-explain') && !html.includes('dn-slash'), '컷인 설명 블록도 남기지 말 것');
  assert.ok(html.includes("toast.className='desperate-toast'"), '토스트로 알려야 한다');
  /* 버프가 작동하는데 알 길이 없으면 안 된다 — 문장은 남긴다. */
  assert.ok(html.includes('소환한 턴에 바로 공격하고') && html.includes('카드를 1장 더'), '역전 돌진·추가 드로우를 문장으로 알려야 한다');
  assert.ok(html.includes('.desperate-toast'), 'FIELD_OVERLAYS 에 등록돼야 한다 (CLAUDE.md 필드 기준 규칙)');
});

test('복수자 대기는 안내가 떠 있는 동안으로 맞춘다', () => {
  /* 중앙 컷인(6초) 기준 3600ms 를 그대로 두면 토스트가 끝나고 빈 화면을 기다린다. */
  assert.ok(html.includes('const DESPERATE_TOAST_MS=2000'), '안내 길이를 상수로 둬야 한다');
  assert.ok(html.includes('desperateNoticeUntil=performance.now()+DESPERATE_TOAST_MS'), '복수자 대기는 안내 길이를 따라야 한다');
  assert.ok(!/desperateNoticeUntil=performance\.now\(\)\+3600/.test(html), '옛 고정 3600ms 로 되돌리지 말 것');
});
