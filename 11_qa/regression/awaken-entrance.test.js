const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');

/* 각성 선택 모달이 아무 맥락 없이 화면에 튀어나와 "어디서 온 건지" 읽히지 않았다.
   체력바 옆 프로필이 빛나며 필드 중앙으로 날아가고, 도착한 자리에서 패널이 피어난다 (2026-11-07). */

test('각성은 체력바 옆 프로필에서 출발한다', () => {
  assert.ok(html.includes('function flyAwakenAvatar(color)'), '비행 헬퍼가 있어야 한다');
  assert.ok(html.includes("querySelector('.duel-hud .player .avatar')"), 'HUD 프로필을 출발점으로 삼아야 한다');
  /* 좌표를 상수로 박으면 HUD 위치가 바뀔 때 엉뚱한 데서 날아온다. */
  assert.ok(html.includes('avatar.getBoundingClientRect()'), '출발 좌표는 실제 아바타에서 읽어야 한다');
});

test('도착점은 필드 중앙이며 화면(vw/vh)이 아니라 필드 기준이다', () => {
  const at = html.indexOf('function flyAwakenAvatar(color)');
  assert.ok(at > 0);
  const fn = html.slice(at, at + 1400);
  assert.ok(fn.includes("num('--field-left')") && fn.includes("num('--field-width')*.5"), '가로 중앙은 필드 기준');
  assert.ok(fn.includes("num('--field-top')") && fn.includes("num('--field-height')*.5"), '세로 중앙은 필드 기준');
  assert.ok(!/\d(vw|vh)/.test(fn), '뷰포트 단위로 도착점을 잡으면 필드 밖으로 간다');
});

test('날아가는 동안 원본 프로필은 자리를 비운다', () => {
  assert.ok(html.includes("avatar.classList.add('awaken-departing')"), '원본은 숨겨야 분신으로 안 보인다');
  assert.ok(html.includes('.duel-hud .avatar.awaken-departing'), '숨김 스타일이 있어야 한다');
});

test('패널은 비행이 끝난 뒤에 열리고 그 전에는 누를 수 없다 (A안)', () => {
  assert.ok(html.includes("overlay.classList.add('arriving')"), '비행 중에는 arriving 상태');
  assert.ok(html.includes('.aura-awaken-choice.arriving'), 'arriving 스타일이 있어야 한다');
  assert.ok(/\.aura-awaken-choice\.arriving\{[^}]*pointer-events:none/.test(html), '비행 중 클릭이 막혀야 한다');
  /* 도착 시점은 비행 시간에서 와야 한다 — 숫자를 따로 박으면 둘이 어긋난다. */
  assert.ok(html.includes("setTimeout(()=>{overlay.classList.remove('arriving')"), '도착하면 풀린다');
  assert.ok(html.includes('},flight)'), '대기 시간은 비행 시간이어야 한다');
  assert.ok(html.includes('AWAKEN_FLIGHT_MS=620'), '비행 시간 상수');
  /* 패널 자체의 bloom 애니메이션이 opacity 를 잡아 arriving 의 정적 값을 덮어쓴 적이 있다.
     도착 전에는 애니메이션을 꺼야 실제로 숨겨진다 (브라우저 실측으로 잡힌 버그). */
  assert.ok(/\.aura-awaken-choice\.arriving \.aura-awaken-choice-panel\{animation:none/.test(html),
    '도착 전에는 패널 애니메이션을 꺼야 숨김이 먹는다');
});

test('연출이 중간에 끊겨도 프로필이 사라진 채 남지 않는다', () => {
  const at = html.indexOf("fxPresent('aura-awaken-choice'");
  assert.ok(at > 0, '각성 선택은 연출 큐를 통해야 한다');
  const fn = html.slice(at, at + 1200);
  assert.ok(fn.includes('clearTimeout(landTimer)'), '타이머를 정리해야 한다');
  assert.ok(fn.includes("remove('awaken-departing')"), '원본 프로필을 되돌려야 한다');
  assert.ok(fn.includes("querySelectorAll('.awaken-flight')"), '남은 고스트를 치워야 한다');
});

test('비행 중 영웅 피격이 들어와도 떠난 프로필이 꿈틀대지 않는다', () => {
  /* damageUnit→impact() 는 연출 큐를 안 거치는 경로가 있어(화상 틱 등 예약된 setTimeout)
     비행 중에 hit-react 가 같은 transform 을 잡을 수 있다. 실측으로 확인한 경합이다. */
  assert.ok(/\.duel-hud \.avatar\.awaken-departing\.hit-react\{animation:none/.test(html),
    '비행 중에는 피격 연출이 양보해야 한다');
});

test('비행 오버레이도 필드 오버레이로 등록된다', () => {
  assert.ok(/FIELD_OVERLAYS='[^']*\.awaken-flight,/.test(html), 'FIELD_OVERLAYS 에 등록돼야 필드 좌표가 동기화된다');
});

test('모션 최소화에서는 날지 않고 바로 연다', () => {
  const at = html.indexOf('function flyAwakenAvatar(color)');
  const fn = html.slice(at, at + 1400);
  assert.ok(fn.includes("matchMedia('(prefers-reduced-motion: reduce)').matches)return 0"), '모션 최소화면 비행 시간 0');
  assert.ok(html.includes('if(!flight)overlay.classList.remove'), '비행이 없으면 즉시 열려야 한다');
});
