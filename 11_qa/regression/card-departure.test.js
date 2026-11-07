const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

test('카드 이동 연출 헬퍼와 목적지 정의가 있다', () => {
  assert.ok(html.includes('function sendCardTo(unit,where,name)'), '이동 연출 헬퍼');
  assert.ok(html.includes('const CARD_DEPART_DEST='), '목적지 정의');
  for (const [key, label] of [['graveyard', '묘지로'], ['deck', '덱으로'], ['hand', '손패로']]) {
    assert.ok(html.includes(key + ':{label:\'' + label + '\''), key + ' 목적지와 한국어 라벨');
  }
});

test('목적지 표식이 어디로 가는지 글로 알려준다', () => {
  /* 사용자 보고: "그냥 사라지면 마법 효과로 움직이는 거라고 인지가 안 된다" */
  assert.ok(html.includes('.card-depart-dest {'), '목적지 표식 스타일');
  assert.ok(html.includes("marker.innerHTML='<small>'+dest.tag+'</small><b>'+(name?name+' · ':'')+dest.label+'</b>'"), '카드 이름과 목적지를 함께 적는다');
  assert.ok(html.includes("tag:'GRAVEYARD'") && html.includes("tag:'DECK'") && html.includes("tag:'HAND'"), '목적지 머리말');
});

test('목적지는 화면이 아니라 필드 안쪽을 기준으로 잡는다', () => {
  /* vw/vh로 잡으면 필드를 벗어난다 (CLAUDE.md 필드 기준 규칙). */
  const fn = html.slice(html.indexOf('function sendCardTo(unit,where,name)'));
  const body = fn.slice(0, fn.indexOf('flight.animate'));
  assert.ok(body.includes("num('--field-left')") && body.includes("num('--field-width')"), '필드 변수를 읽는다');
  assert.ok(body.includes('tx=fl+fw*.5'), '가로는 필드 중앙');
  assert.ok(body.includes('ty=ft+fh*(.5+dest.dy*.5)'), '세로는 필드 안쪽 비율');
  assert.ok(!/\d+vh/.test(body) && !/\d+vw/.test(body), '화면 단위를 쓰지 않는다');
});

test('묘지는 아래, 덱은 위로 가서 목적지가 구분된다', () => {
  assert.ok(html.includes("graveyard:{label:'묘지로',tag:'GRAVEYARD',color:'#c98bff',dy:.34}"), '묘지는 아래쪽(양수)');
  assert.ok(html.includes("deck:{label:'덱으로',tag:'DECK',color:'#8fd4ff',dy:-.3}"), '덱은 위쪽(음수)');
});

test('소환 무효화는 양쪽 모두 카드를 묘지로 보낸다', () => {
  /* 내 함정과 상대 함정 두 경로가 따로 있고, 상대 쪽은 즉시 사라지고 있었다. */
  const mine = html.slice(html.indexOf("negate-summon'){const name=context.unit"));
  /* 발동 리드(TRAP_EFFECT_LEAD_MS) 때문에 setTimeout 안에서 쓰므로 context.unit 을 doomed 로 잡아둔다. */
  assert.ok(/sendCardTo\((?:context\.unit|doomed),'graveyard',name\)/.test(mine.slice(0, 600)), '내 소환 무효화');
  const theirsAt = html.indexOf("'<strong>상대 함정 발동:</strong> '+trap.name");
  assert.ok(theirsAt > 0, '상대 함정 경로를 찾아야 한다');
  const theirs = html.slice(theirsAt);
  assert.ok(/sendCardTo\((?:context\.unit|doomed),'graveyard'/.test(theirs.slice(0, 500)), '상대 소환 무효화도 이동 연출을 쓴다');
  assert.ok(!html.includes("negate-summon'){context.unit?.remove();"), '즉시 제거로 되돌리지 말 것');
  /* 이동 연출 '전에' 원본을 지우면 날아갈 카드가 없어진다 — 두 경로 모두 제거가 이동 뒤에 와야 한다. */
  for (const branch of [mine, theirs]) {
    const head = branch.slice(0, 560);/* 발동 리드 래퍼가 끼어 구간이 길어졌다 */
    const removeAt = head.indexOf('.remove()');
    const sendAt = head.indexOf('sendCardTo(');
    assert.ok(sendAt >= 0, '이동 연출이 있어야 한다');
    assert.ok(removeAt < 0 || removeAt > sendAt, '원본 제거가 이동 연출보다 앞서면 안 된다');
  }
});

test('귀환 마법은 손패로 돌아가는 것으로 보여준다', () => {
  const bounce = html.slice(html.indexOf("const bounceName="));
  assert.ok(bounce.slice(0, 220).includes("sendCardTo(target,'hand',bounceName)"), '귀환은 손패 목적지');
  assert.ok(!html.includes("{transform:'translateY(-90px) scale(.2) rotate(16deg)',opacity:0}"), '목적지 없이 위로 날려보내던 연출은 제거');
});

test('전체 파괴도 카드가 묘지로 가는 것을 보여준다', () => {
  assert.ok(html.includes("sendCardTo(unit,'graveyard',wipedName)"), '전체 파괴 대상도 묘지로');
});

test('이동이 끝나기 전에 원본이 사라지지 않는다', () => {
  /* 원본을 먼저 지우면 날아가는 카드만 남아 "어디서 왔는지"가 끊긴다.
     visibility로 감추고 이동 시간만큼 기다린 뒤 제거한다. */
  for (const guard of ["Math.max(520,gone)", "Math.max(620,bounceMs)", "Math.max(650,goneMs)"]) {
    assert.ok(html.includes(guard), guard + ' — 이동 시간을 기다려야 한다');
  }
  assert.ok(/(?:context\.unit|doomed)\.style\.visibility='hidden'/.test(html), '원본은 감추고 나중에 제거');
  /* 세팅과 소멸이 같은 프레임에 겹쳐 보이지 않도록 효과를 리드만큼 늦춘다 (2026-11-07) */
  assert.ok(html.includes('TRAP_EFFECT_LEAD_MS=200'), '함정 발동 리드 0.2초가 있어야 한다');
  assert.ok(/setTimeout\(\(\)=>\{if\(!doomed\.isConnected\)return;/.test(html), '리드 후 원본이 살아있을 때만 효과를 적용한다');
});

test('이동 연출도 필드 오버레이로 등록된다', () => {
  const selector = html.slice(html.indexOf('const FIELD_OVERLAYS='));
  assert.ok(selector.slice(0, 460).includes('.card-depart'), 'FIELD_OVERLAYS 등록 (CLAUDE.md 규칙)');
  assert.ok(selector.slice(0, 460).includes('.card-depart-dest'), '목적지 표식도 등록');
});

test('모션 최소화 설정을 존중한다', () => {
  const fn = html.slice(html.indexOf('function sendCardTo(unit,where,name)'));
  assert.ok(fn.slice(0, 900).includes("matchMedia('(prefers-reduced-motion: reduce)')"), '모션 최소화 확인');
  assert.ok(fn.slice(0, 1600).includes('dur=reduced?1:combatMs(620)'), '모션을 끄면 즉시 끝낸다');
});
